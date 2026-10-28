class AddBundlePositionToMaterials < ActiveRecord::Migration[8.1]
  def up
    # まとめの中での並び順（0 始まり。まとめに入っていない教材は NULL）
    add_column :materials, :bundle_position, :integer

    # 既存のまとめは、これまでの表示（教材名の順）のまま番号を振る
    execute <<~SQL
      UPDATE materials SET bundle_position = ranked.position
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY bundle_id ORDER BY title, id) - 1 AS position
        FROM materials
        WHERE bundle_id IS NOT NULL
      ) AS ranked
      WHERE materials.id = ranked.id
    SQL
  end

  def down
    remove_column :materials, :bundle_position
  end
end
