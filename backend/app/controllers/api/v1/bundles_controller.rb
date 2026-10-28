module Api
  module V1
    class BundlesController < ApplicationController
      # GET /api/v1/bundles
      def index
        bundles = Bundle.left_joins(:materials)
                        .group(:id)
                        .select("bundles.*, COUNT(materials.id) AS materials_count")
                        .order(:name)

        render json: bundles.map { |bundle| bundle_json(bundle, bundle.materials_count) }
      end

      # POST /api/v1/bundles
      # { bundle: { name:, material_ids: [...] } } で作成と同時に教材をまとめる
      def create
        bundle = Bundle.new(name: bundle_params[:name])
        ids = Array(bundle_params[:material_ids]).map(&:to_i)

        if ids.empty?
          return render json: {
            errors: [ "まとめる教材を選択してください" ]
          }, status: :unprocessable_entity
        end

        saved = Bundle.transaction do
          next false unless bundle.save

          # 渡された順に並べる。別のまとめから移ってきた教材があれば、空になった元のまとめを消す
          bundle.append(ids)
          Bundle.remove_empty
          true
        end

        if saved
          render json: bundle_json(bundle, bundle.materials.count), status: :created
        else
          render json: { errors: bundle.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/bundles/:id（名前の変更）
      def update
        bundle = Bundle.find(params[:id])

        if bundle.update(name: bundle_params[:name])
          render json: bundle_json(bundle, bundle.materials.count), status: :ok
        else
          render json: { errors: bundle.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/bundles/:id/reorder
      # { material_ids: [...] } の順に中身を並べ替える（中身すべての ID を渡す）
      def reorder
        bundle = Bundle.find(params[:id])

        if bundle.reorder(Array(params[:material_ids]))
          render json: bundle_json(bundle, bundle.materials.count), status: :ok
        else
          render json: {
            errors: [ "並び替える教材が、まとめの中身と一致しません" ]
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/bundles/:id
      # まとめを解除する（教材は削除しない）
      def destroy
        Bundle.find(params[:id]).destroy!
        head :no_content
      end

      private

      def bundle_json(bundle, materials_count)
        { id: bundle.id, name: bundle.name, materials_count: materials_count }
      end

      def bundle_params
        params.require(:bundle).permit(:name, material_ids: [])
      end
    end
  end
end
