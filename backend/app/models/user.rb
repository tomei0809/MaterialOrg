# アプリの利用者。教材・フォルダ・まとめ・タグは利用者ごとに持ち、ほかの利用者とは共有しない
class User < ApplicationRecord
  MIN_PASSWORD_LENGTH = 8

  has_secure_password
  has_many :sessions, dependent: :destroy
  has_many :materials, dependent: :destroy
  has_many :bundles, dependent: :destroy
  has_many :folders, dependent: :destroy
  has_many :tags, dependent: :destroy

  normalizes :email_address, with: ->(e) { e.strip.downcase }

  validates :email_address, presence: true,
                            length: { maximum: 255 },
                            format: { with: URI::MailTo::EMAIL_REGEXP },
                            uniqueness: true
  validates :password, length: { minimum: MIN_PASSWORD_LENGTH }, allow_nil: true

  # 登録できる人数の上限（環境変数 MAX_USERS。既定 10 人）
  def self.max_users
    ENV.fetch("MAX_USERS", 10).to_i
  end

  def self.registration_open?
    count < max_users
  end
end
