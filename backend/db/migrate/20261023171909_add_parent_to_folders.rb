class AddParentToFolders < ActiveRecord::Migration[8.1]
  def change
    # フォルダの階層化（NULL は最上位）。削除時の付け替えはモデル側で行う
    add_reference :folders, :parent, null: true, foreign_key: { to_table: :folders }

    # 名前の重複禁止を「全体」から「同じ親フォルダの中」に変更する
    # （NULLS NOT DISTINCT で最上位どうしの重複も防ぐ）
    remove_index :folders, :name, unique: true
    add_index :folders, %i[parent_id name], unique: true, nulls_not_distinct: true
  end
end
