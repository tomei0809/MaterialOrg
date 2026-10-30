# アプリの利用者。教材・フォルダ・まとめ・タグは利用者ごとに持ち、ほかの利用者とは共有しない。
# demo が true の利用者はポートフォリオ用のデモアカウント（DemoAccount で作成・初期化する）
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

  # 新規登録を受け付けるか。本番は環境変数 REGISTRATION_OPEN=true のときだけ開く（既定は閉じる）。
  # 開発・テストは既定で開く。どちらも MAX_USERS の上限は残す
  def self.registration_open?
    open = ENV.fetch("REGISTRATION_OPEN") { Rails.env.production? ? "false" : "true" }
    ActiveModel::Type::Boolean.new.cast(open) && count < max_users
  end
end
