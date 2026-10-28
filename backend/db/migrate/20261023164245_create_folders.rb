class CreateFolders < ActiveRecord::Migration[8.1]
  def change
    create_table :folders do |t|
      t.string :name, null: false
      t.string :color, null: false, default: "blue"

      t.timestamps
    end
    add_index :folders, :name, unique: true
  end
end
