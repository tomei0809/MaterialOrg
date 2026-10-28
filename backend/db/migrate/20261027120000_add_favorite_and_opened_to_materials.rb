class AddFavoriteAndOpenedToMaterials < ActiveRecord::Migration[8.1]
  def change
    # お気に入りに入れた日時（null はお気に入りでない）
    add_column :materials, :favorited_at, :datetime
    # 最後に開いた日時（「最近使った資料」に使う。null はまだ開いていない）
    add_column :materials, :last_opened_at, :datetime
    add_index :materials, :favorited_at
    add_index :materials, :last_opened_at
  end
end
