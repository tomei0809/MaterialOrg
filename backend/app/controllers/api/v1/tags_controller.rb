module Api
  module V1
    class TagsController < ApplicationController
      # GET /api/v1/tags
      # 教材に使われているタグを、使用数の多い順に返す
      def index
        tags = Tag.joins(:material_tags)
                  .group(:id)
                  .select("tags.*, COUNT(material_tags.id) AS materials_count")
                  .order("materials_count DESC", :name)

        render json: tags.map { |tag|
          { id: tag.id, name: tag.name, materials_count: tag.materials_count }
        }
      end
    end
  end
end
