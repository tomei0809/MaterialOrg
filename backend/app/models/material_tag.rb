# 教材とタグを結ぶ中間テーブル
class MaterialTag < ApplicationRecord
  belongs_to :material
  belongs_to :tag

  validates :tag_id, uniqueness: { scope: :material_id }
end
