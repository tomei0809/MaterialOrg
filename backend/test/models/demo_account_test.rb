require "test_helper"

class DemoAccountTest < ActiveSupport::TestCase
  # 個人用のアカウント（users(:one)）のデータの数と添付ファイル
  def personal_snapshot
    user = users(:one)
    {
      materials: Material.where(user_id: user.id).order(:id).pluck(:id, :title, :updated_at),
      folders: Folder.where(user_id: user.id).order(:id).pluck(:id, :name),
      bundles: Bundle.where(user_id: user.id).order(:id).pluck(:id),
      tags: Tag.where(user_id: user.id).order(:id).pluck(:id, :name),
      blobs: ActiveStorage::Attachment.where(record_type: "Material",
                                             record_id: Material.where(user_id: user.id).select(:id)).pluck(:blob_id)
    }
  end

  test "初期化するとサンプルデータが登録され、個人用のデータは変わらない" do
    materials(:math_slide).file.attach(io: StringIO.new("%PDF-1.4"), filename: "mine.pdf")
    before = personal_snapshot

    result = DemoAccount.reset!(users(:demo))

    demo = users(:demo)
    assert_equal DemoSampleData::MATERIALS.size, result[:created_materials]
    assert_equal DemoSampleData::MATERIALS.size, demo.materials.count
    assert demo.materials.all? { |m| m.file.attached? }
    assert_equal 1, demo.materials.trashed.count
    assert_equal 2, demo.materials.where.not(favorited_at: nil).count
    assert_equal 3, demo.bundles.first.materials.count
    assert_equal 6, demo.folders.count
    assert_equal %w[復習 重要 試験対策].sort, demo.tags.pluck(:name).sort
    assert_equal before, personal_snapshot
  end

  test "初期化するとデモで追加・変更したデータと、その添付ファイルの実体が消える" do
    DemoAccount.reset!(users(:demo))
    demo = users(:demo)
    added = demo.materials.create!(title: "デモで追加", material_type: "other")
    added.file.attach(io: StringIO.new("hello"), filename: "added.txt")
    blob = added.file.blob
    demo.folders.create!(name: "デモで作ったフォルダ")
    demo.materials.kept.first.update!(title: "書き換えた")

    DemoAccount.reset!(demo)

    assert_not Material.exists?(added.id)
    assert_not ActiveStorage::Blob.exists?(blob.id)
    assert_not blob.service.exist?(blob.key)
    assert_not demo.folders.exists?(name: "デモで作ったフォルダ")
    assert_not demo.materials.exists?(title: "書き換えた")
    assert_equal DemoSampleData::MATERIALS.size, demo.materials.count
  end

  test "パスワードも環境変数の値に戻す" do
    demo = users(:demo)
    demo.update!(password: "changed-password")
    DemoAccount.reset!(demo)
    assert demo.reload.authenticate(DemoAccount.password)
  end

  test "デモ以外の利用者は初期化できない" do
    assert_no_difference -> { Material.count } do
      assert_raises(DemoAccount::NotDemoUser) { DemoAccount.reset!(users(:one)) }
      assert_raises(DemoAccount::NotDemoUser) { DemoAccount.reset!(nil) }
    end
  end

  test "デモのアドレスが個人用のアカウントと同じなら作成を中止する" do
    ENV["DEMO_EMAIL"] = "one@example.com"
    assert_raises(DemoAccount::Conflict) { DemoAccount.setup! }
    assert_not users(:one).reload.demo?
  ensure
    ENV.delete("DEMO_EMAIL")
  end

  test "デモの利用者がいなければ作る" do
    users(:demo).destroy!
    user = DemoAccount.setup!
    assert user.demo?
    assert_equal "demo@example.com", user.email_address
    assert_equal user, DemoAccount.setup!
  end
end
