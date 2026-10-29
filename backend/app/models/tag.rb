# 科目・教材の種類とは別に、教材へ自由に付けられる分類（例：試験対策、復習用）
class Tag < ApplicationRecord
  MAX_NAME_LENGTH = 30

  belongs_to :user, optional: true
  has_many :material_tags, dependent: :destroy
  has_many :materials, through: :material_tags

  validates :name, presence: true,
                   length: { maximum: MAX_NAME_LENGTH },
                   uniqueness: { scope: :user_id }
end
