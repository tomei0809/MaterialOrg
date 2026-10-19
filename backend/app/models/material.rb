class Material < ApplicationRecord
  has_one_attached :file
  validates :title, presence: true
  validates :subject, presence: true
  validates :material_type, presence: true

  validates :material_type,
            inclusion: {
              in: %w[slide assignment past_exam notes other]
            }
end