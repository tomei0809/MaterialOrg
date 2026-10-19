module Api
  module V1
    class MaterialsController < ApplicationController
      # GET /api/v1/materials
      def index
        materials = Material.order(created_at: :desc)
        
        if params[:title].present?
          materials = materials.where(
            "title ILIKE ?", "%#{params[:title]}%"
            )
        end
          
        if params[:subject].present?
          materials = materials.where(
            "subject ILIKE ?", "%#{params[:subject]}%"
            )
        end
        
        if params[:material_type].present?
          materials = materials.where(
            material_type: params[:material_type]
            )
        end
        
        render json: materials.map { |material| material_json(material) }
      end
      
      # POST /api/v1/materials
      def create
        material = Material.new(material_params)

        if material.save
          render json: material_json(material), status: :createdd
        else
          render json: {
            errors: material.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/materials/:id
      def update
        material = Material.find(params[:id])

        if material.update(material_params)
          render json: material_json(material), status: :ok
        else
          render json: {
            errors: material.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/materials/:id
      def destroy
        material = Material.find(params[:id])
        material.destroy!
        head :no_content
      end

      def material_json(material) 
        material.as_json.merge(
          file_attached: material.file.attached?,
          file_url: (
            rails_blob_url(
              material.file,
              host: "localhost",
              port: 3000,
              protocol: "http"
            ) if material.file.attached?
          ),
          file_name: (
            material.file.filename.to_s if material.file.attached?
          )
        )
      end


      private

      def material_params
        params.require(:material).permit(
          :title,
          :subject,
          :material_type,
          :description,
          :file
        )
      end
    end
  end
end