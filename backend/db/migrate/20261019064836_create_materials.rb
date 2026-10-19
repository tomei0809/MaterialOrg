class CreateMaterials < ActiveRecord::Migration[8.1]
  def change
    create_table :materials do |t|
      t.string :title
      t.string :subject
      t.string :material_type
      t.text :description

      t.timestamps
    end
  end
end
