class AddPositionToFolders < ActiveRecord::Migration[8.1]
  def up
    # 同じ親の中での並び順（0 始まり。ドラッグで並び替える）
    add_column :folders, :position, :integer, null: false, default: 0

    # 既存のフォルダは、これまでの表示（名前の順）のまま番号を振る
    execute <<~SQL
      UPDATE folders SET position = ranked.position
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY name, id) - 1 AS position
        FROM folders
      ) AS ranked
      WHERE folders.id = ranked.id
    SQL
  end

  def down
    remove_column :folders, :position
  end
end
