require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "メールアドレスは前後の空白を除いて小文字で保存し、重複できない" do
    user = User.create!(email_address: "  New@Example.COM ", password: "password123")
    assert_equal "new@example.com", user.email_address
    assert_not User.new(email_address: "NEW@example.com", password: "password123").valid?
  end

  test "パスワードは8文字以上、メールアドレスは形式を確かめる" do
    assert_not User.new(email_address: "a@example.com", password: "short").valid?
    assert_not User.new(email_address: "not-an-email", password: "password123").valid?
    assert User.new(email_address: "a@example.com", password: "password123").valid?
  end

  test "登録できる人数の上限は MAX_USERS で決まる" do
    with_env("MAX_USERS" => User.count.to_s) { assert_not User.registration_open? }
    with_env("MAX_USERS" => (User.count + 1).to_s) { assert User.registration_open? }
  end

  test "タグとフォルダ名は利用者ごとに重複を判定する" do
    users(:two).tags.create!(name: "試験対策")
    assert users(:two).folders.new(name: "1年前期").valid?
    assert_not users(:one).folders.new(name: "1年前期").valid?
  end

  test "ほかの利用者のフォルダ・まとめには入れられない" do
    other = users(:two).folders.create!(name: "他人のフォルダ")
    material = users(:one).materials.new(title: "a", material_type: "other", folder: other)
    assert_not material.valid?
    assert_not users(:one).folders.new(name: "子", parent: other).valid?
    material.folder = nil
    material.bundle = users(:two).bundles.create!(name: "他人のまとめ")
    assert_not material.valid?
  end

  private

  def with_env(values)
    old = values.keys.to_h { |key| [ key, ENV[key] ] }
    values.each { |key, value| ENV[key] = value }
    yield
  ensure
    old.each { |key, value| ENV[key] = value }
  end
end
