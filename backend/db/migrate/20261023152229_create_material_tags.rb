class CreateMaterialTags < ActiveRecord::Migration[8.1]
  def change
    create_table :material_tags do |t|
      t.references :material, null: false, foreign_key: true
      t.references :tag, null: false, foreign_key: true

      t.timestamps
    end
    # 同じ教材に同じタグを二重に付けない
    add_index :material_tags, %i[material_id tag_id], unique: true
  end
end
