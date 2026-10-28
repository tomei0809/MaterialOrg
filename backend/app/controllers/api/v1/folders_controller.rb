module Api
  module V1
    class FoldersController < ApplicationController
      # GET /api/v1/folders
      # 中身が空のフォルダも含めて並び順（position → 名前）で返す（階層は parent_id で表す）
      # materials_count はそのフォルダ直下の教材数（サブフォルダの分は含まない）
      def index
        folders = Folder.left_joins(:materials)
                        .group(:id)
                        .select("folders.*, COUNT(materials.id) AS materials_count")
                        .ordered

        render json: folders.map { |folder| folder_json(folder, folder.materials_count) }
      end

      # PATCH /api/v1/folders/arrange
      # { parent_id, folder_ids }：parent_id（空なら最上位）の中を folder_ids の順に並べる。
      # 別の親から移ってくるフォルダを含めれば、そのフォルダの移動（階層の変更）になる
      def arrange
        Folder.arrange(params[:parent_id], Array(params[:folder_ids]))
        index
      rescue ArgumentError => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # POST /api/v1/folders
      def create
        folder = Folder.new(folder_params)

        if folder.save
          render json: folder_json(folder, 0), status: :created
        else
          render json: { errors: folder.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/folders/:id
      def update
        folder = Folder.find(params[:id])

        if folder.update(folder_params)
          render json: folder_json(folder, folder.materials.count), status: :ok
        else
          render json: { errors: folder.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/folders/:id
      # 中のサブフォルダと教材は削除せず、1つ上のフォルダ（最上位なら未分類）へ移す
      def destroy
        Folder.transaction { Folder.find(params[:id]).destroy! }
        head :no_content
      end

      private

      def folder_json(folder, materials_count)
        {
          id: folder.id,
          name: folder.name,
          color: folder.color,
          parent_id: folder.parent_id,
          position: folder.position,
          materials_count: materials_count
        }
      end

      def folder_params
        params.require(:folder).permit(:name, :color, :parent_id)
      end
    end
  end
end
