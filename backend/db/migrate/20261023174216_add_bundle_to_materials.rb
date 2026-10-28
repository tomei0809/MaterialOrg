class AddBundleToMaterials < ActiveRecord::Migration[8.1]
  def change
    # まとめを解除・削除しても教材は残す
    add_reference :materials, :bundle, null: true, foreign_key: { on_delete: :nullify }
  end
end
