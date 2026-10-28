module Api
  module V1
    class MaterialsController < ApplicationController
      # GET /api/v1/materials
      def index
        materials = Material.kept
                            .includes(:tags, file_attachment: :blob)
                            .order(created_at: :desc)

        if params[:title].present?
          materials = materials.where(
            "title ILIKE ?", "%#{params[:title]}%"
            )
        end

        if params[:material_type].present?
          materials = materials.where(
            material_type: params[:material_type]
            )
        end

        # フォルダで絞り込む（"none" なら未分類）
        if params[:folder_id].present?
          materials = materials.where(
            folder_id: params[:folder_id] == "none" ? nil : params[:folder_id]
            )
        end

        # タグ名で絞り込む（JOIN すると includes したタグまで絞られるため、サブクエリで ID を求める）
        if params[:tag].present?
          materials = materials.where(
            id: MaterialTag.joins(:tag)
                           .where(tags: { name: params[:tag] })
                           .select(:material_id)
            )
        end

        render json: materials.map { |material| material_json(material) }
      end

      # POST /api/v1/materials
      def create
        material = Material.new

        if save_in_transaction(material)
          render json: material_json(material), status: :created
        else
          render json: {
            errors: material.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/materials/:id
      def update
        material = Material.kept.find(params[:id])

        if save_in_transaction(material)
          render json: material_json(material), status: :ok
        else
          render json: {
            errors: material.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/materials/:id
      # ゴミ箱へ移す（TRASH_RETENTION のあいだは restore で元に戻せる）
      def destroy
        Material.transaction { Material.kept.find(params[:id]).trash! }
        head :no_content
      end

      # GET /api/v1/materials/trash
      # ゴミ箱の教材を、削除した日時の新しい順に返す。期限を過ぎたものはここでも消しておく
      def trash
        Material.purge_expired
        materials = Material.trashed
                            .includes(:tags, file_attachment: :blob)
                            .order(deleted_at: :desc)
        render json: materials.map { |material| material_json(material) }
      end

      # PATCH /api/v1/materials/restore
      # { ids } の教材をゴミ箱から元に戻す
      def restore
        materials = Material.trashed.where(id: Array(params[:ids]).map(&:to_i))
        restored = materials.update_all(deleted_at: nil)
        render json: { restored: restored }
      end

      # DELETE /api/v1/materials/purge
      # { ids } または { all: true } で、ゴミ箱の教材を完全に削除する（元に戻せない）
      def purge
        materials = Material.trashed
        unless ActiveModel::Type::Boolean.new.cast(params[:all])
          materials = materials.where(id: Array(params[:ids]).map(&:to_i))
        end
        purged = Material.transaction { materials.find_each.map(&:destroy!).size }
        render json: { purged: purged }
      end

      # PATCH /api/v1/materials/move
      # 複数の教材をまとめてフォルダへ移動する（folder_id が空なら未分類へ）
      def move
        ids = Array(params[:ids]).map(&:to_i)
        folder_id = params[:folder_id].presence

        if folder_id && !Folder.exists?(id: folder_id)
          return render json: {
            errors: [ "移動先のフォルダが見つかりません" ]
          }, status: :unprocessable_entity
        end

        moved = Material.kept.where(id: ids).update_all(folder_id: folder_id)
        render json: { moved: moved }
      end

      # PATCH /api/v1/materials/assign_bundle
      # 複数の教材をまとめに入れる（bundle_id が空ならまとめから外す）
      def assign_bundle
        # ゴミ箱の教材はまとめに入れない
        ids = Material.kept_ids_in_order(params[:ids])
        bundle_id = params[:bundle_id].presence

        if bundle_id && !Bundle.exists?(id: bundle_id)
          return render json: {
            errors: [ "まとめが見つかりません" ]
          }, status: :unprocessable_entity
        end

        updated = Material.transaction do
          # まとめに入れるときは末尾に並べ、外すときは並び順も消す
          count = bundle_id ? Bundle.find(bundle_id).append(ids) : Bundle.release(ids)
          Bundle.remove_empty
          count
        end
        render json: { updated: updated }
      end

      # PATCH /api/v1/materials/favorite
      # 複数の教材をお気に入りに入れる／外す（favorite が false なら外す）。
      # 更新日（updated_at）は変えない（並び替えの「更新日順」に影響させないため）
      def favorite
        ids = Array(params[:ids]).map(&:to_i)
        materials = Material.kept.where(id: ids)
        updated =
          if ActiveModel::Type::Boolean.new.cast(params[:favorite])
            # すでにお気に入りのものは、入れた日時をそのまま残す
            materials.where(favorited_at: nil).update_all(favorited_at: Time.current)
          else
            materials.where.not(favorited_at: nil).update_all(favorited_at: nil)
          end
        render json: { updated: updated }
      end

      # PATCH /api/v1/materials/:id/opened
      # 教材を開いたことを記録する（「最近使った資料」）。更新日は変えない
      def opened
        material = Material.kept.find(params[:id])
        material.update_columns(last_opened_at: Time.current)
        render json: { id: material.id, last_opened_at: material.last_opened_at }
      end

      private

      # タグの付け替えは代入時に DB へ書き込まれるため、
      # 他の項目の検証エラーで保存できなかったときに一緒に巻き戻す
      def save_in_transaction(material)
        saved = false

        Material.transaction do
          material.assign_attributes(material_params)
          saved = material.save
          raise ActiveRecord::Rollback unless saved
        end

        saved
      end

      def material_json(material)
        material.as_json.merge(
          tags: material.tag_names.sort,
          file_attached: material.file.attached?,
          # ホストを含まない相対パスを返し、フロント(Next.js)の rewrites 経由で配信する
          file_url: (
            rails_storage_proxy_path(material.file) if material.file.attached?
          ),
          file_name: (
            material.file.filename.to_s if material.file.attached?
          ),
          # 詳細パネルのプレビューとサイズ表示に使う
          file_size: (material.file.byte_size if material.file.attached?),
          file_content_type: (material.file.content_type if material.file.attached?),
          # ゴミ箱の教材だけ：完全に削除される日時
          purge_at: material.purge_at
        )
      end

      def material_params
        params.require(:material).permit(
          :title,
          :material_type,
          :description,
          :folder_id,
          :file,
          tag_names: []
        )
      end
    end
  end
end
