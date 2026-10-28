class RemoveSubjectFromMaterials < ActiveRecord::Migration[8.1]
  def change
    # 科目による分類はフォルダで行うため、科目の列を削除する（値も削除される）
    remove_column :materials, :subject, :string
  end
end
