class CreateBundles < ActiveRecord::Migration[8.1]
  def change
    # 一覧で複数の教材を1行にまとめて表示するための「まとめ」（保存場所のフォルダとは別）
    create_table :bundles do |t|
      t.string :name, null: false

      t.timestamps
    end
  end
end
