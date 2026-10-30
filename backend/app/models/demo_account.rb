require Rails.root.join("db/demo/sample_data").to_s

# ポートフォリオ用のデモアカウント。第三者が自由に操作できるため、管理者が必要なときに
# サンプルの状態へ戻す（初期化する）。初期化は demo が true の利用者のデータだけを対象にし、
# 個人用のアカウントのデータには触れない
class DemoAccount
  class NotDemoUser < StandardError; end
  class Conflict < StandardError; end

  SAMPLE_FILES = Rails.root.join("db/demo/files")

  # ログイン情報は環境変数で渡す（ソースコードや README には書かない）。
  # 開発・テストだけは既定値を使う
  def self.email
    ENV.fetch("DEMO_EMAIL") { development_default("demo@example.com", "DEMO_EMAIL") }.strip.downcase
  end

  def self.password
    ENV.fetch("DEMO_PASSWORD") { development_default("demo-password", "DEMO_PASSWORD") }
  end

  def self.development_default(value, name)
    raise KeyError, "環境変数 #{name} を設定してください" if Rails.env.production?

    value
  end
  private_class_method :development_default

  # デモの利用者を返す。いなければ作る。
  # 同じアドレスの個人用のアカウントがあれば中止する（誤って個人のデータを初期化しないため）
  def self.setup!
    existing = User.find_by(email_address: email)
    if existing && !existing.demo?
      raise Conflict, "#{email} は個人用のアカウントとして登録済みです。DEMO_EMAIL を別のアドレスにしてください"
    end

    existing || User.create!(email_address: email, password: password, demo: true)
  end

  # デモの利用者のデータを消し、サンプルデータを登録し直す。パスワードも環境変数の値に戻す
  def self.reset!(user)
    raise NotDemoUser, "デモアカウント以外は初期化できません" unless user&.demo?

    removed = user.materials.count
    # 添付ファイルは保存先（本番は S3）の実体ごと、すぐに消す
    user.materials.includes(file_attachment: :blob).find_each do |material|
      material.file.purge if material.file.attached?
    end

    created = User.transaction do
      # どれも、このデモの利用者の user_id で絞った範囲だけを消す
      user.materials.destroy_all
      Bundle.where(user_id: user.id).delete_all
      Folder.where(user_id: user.id).delete_all
      Tag.where(user_id: user.id).delete_all
      user.update!(password: password)
      seed(user)
    end

    { email: user.email_address, removed_materials: removed, created_materials: created }
  end

  def self.seed(user)
    now = Time.current
    folders = {}
    create_folders = lambda do |definitions, parent|
      definitions.each do |definition|
        folder = user.folders.create!(name: definition[:name], color: definition[:color], parent: parent)
        folders[definition[:key]] = folder
        create_folders.call(definition[:children] || [], folder)
      end
    end
    create_folders.call(DemoSampleData::FOLDERS, nil)

    bundled = Hash.new { |hash, key| hash[key] = [] }
    DemoSampleData::MATERIALS.each do |definition|
      material = user.materials.new(
        title: definition[:title],
        material_type: definition[:type],
        description: definition[:description],
        folder: folders[definition[:folder]]
      )
      material.tag_names = definition[:tags] || []
      material.file.attach(io: File.open(SAMPLE_FILES.join(definition[:file])), filename: definition[:filename])
      material.save!

      created_at = now - definition[:days_ago].days
      material.update_columns(
        created_at: created_at,
        updated_at: created_at,
        favorited_at: (now - 1.day if definition[:favorite]),
        last_opened_at: (now - definition[:opened_hours_ago].hours if definition[:opened_hours_ago]),
        deleted_at: (now - definition[:trashed_days_ago].days if definition[:trashed_days_ago])
      )
      bundled[definition[:bundle]] << material.id if definition[:bundle]
    end

    DemoSampleData::BUNDLES.each do |key, name|
      user.bundles.create!(name: name).append(bundled[key])
    end

    DemoSampleData::MATERIALS.size
  end
  private_class_method :seed
end
