# 教材のゴミ箱：削除した日時を記録し、30日間は元に戻せるようにする
class AddDeletedAtToMaterials < ActiveRecord::Migration[8.1]
  def change
    add_column :materials, :deleted_at, :datetime
    add_index :materials, :deleted_at
  end
end
