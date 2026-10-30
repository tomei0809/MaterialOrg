# ポートフォリオ用のデモアカウントを、個人用のアカウントと区別する
class AddDemoToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :demo, :boolean, default: false, null: false
  end
end
