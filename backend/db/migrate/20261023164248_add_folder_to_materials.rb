class AddFolderToMaterials < ActiveRecord::Migration[8.1]
  def change
    # フォルダを削除しても教材は残し、「未分類」(NULL) に戻す
    add_reference :materials, :folder, null: true, foreign_key: { on_delete: :nullify }
  end
end
