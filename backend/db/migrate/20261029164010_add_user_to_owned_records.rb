# 教材・フォルダ・まとめ・タグを利用者ごとに分ける。
# 既存の行は持ち主がいないため NULL を許し、bin/rails users:claim_orphans で割り当てる
class AddUserToOwnedRecords < ActiveRecord::Migration[8.1]
  def change
    %i[materials folders bundles tags].each do |table|
      add_reference table, :user, foreign_key: true, null: true
    end

    # タグ名・フォルダ名の重複は、利用者ごとに判定する
    remove_index :tags, :name, unique: true
    add_index :tags, %i[user_id name], unique: true

    remove_index :folders, %i[parent_id name], unique: true, nulls_not_distinct: true,
                                               name: "index_folders_on_parent_id_and_name"
    add_index :folders, %i[user_id parent_id name], unique: true, nulls_not_distinct: true
  end
end
