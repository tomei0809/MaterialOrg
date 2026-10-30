require "test_helper"

# デモアカウントの初期化 API・デモでの制限・新規登録の受付
class DemoTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  TOKEN = "t" * 40

  def with_env(values)
    old = values.keys.to_h { |key| [ key, ENV[key] ] }
    values.each { |key, value| ENV[key] = value }
    yield
  ensure
    old.each { |key, value| ENV[key] = value }
  end

  test "初期化 API はトークンが未設定・短すぎると 404、誤りは 401" do
    post api_v1_admin_demo_reset_url
    assert_response :not_found

    with_env("DEMO_ADMIN_TOKEN" => "short") do
      post api_v1_admin_demo_reset_url, headers: { "Authorization" => "Bearer short" }
      assert_response :not_found
    end

    with_env("DEMO_ADMIN_TOKEN" => TOKEN) do
      post api_v1_admin_demo_reset_url
      assert_response :unauthorized
      post api_v1_admin_demo_reset_url, headers: { "Authorization" => "Bearer #{'x' * 40}" }
      assert_response :unauthorized
    end
    assert_equal 0, users(:demo).materials.count
  end

  test "正しいトークンでデモを初期化し、個人用のデータは変わらない" do
    personal = users(:one).materials.pluck(:id, :title)
    with_env("DEMO_ADMIN_TOKEN" => TOKEN) do
      post api_v1_admin_demo_reset_url, headers: { "Authorization" => "Bearer #{TOKEN}" }
    end
    assert_response :success
    assert_equal DemoSampleData::MATERIALS.size, response.parsed_body["created_materials"]
    assert_equal DemoSampleData::MATERIALS.size, users(:demo).materials.count
    assert_equal personal, users(:one).materials.pluck(:id, :title)
  end

  test "デモの利用者がいなければ初期化 API が作る" do
    users(:demo).destroy!
    with_env("DEMO_ADMIN_TOKEN" => TOKEN) do
      post api_v1_admin_demo_reset_url, headers: { "Authorization" => "Bearer #{TOKEN}" }
    end
    assert_response :success
    assert User.find_by(email_address: "demo@example.com").demo?
  end

  test "デモでもアプリの機能は使え、ログイン中の利用者に demo が付く" do
    sign_in_as users(:demo)
    get api_v1_session_url
    assert response.parsed_body["demo"]

    post api_v1_materials_url, params: { material: { title: "デモで追加", material_type: "other" } }
    assert_response :created
    delete api_v1_material_url(response.parsed_body["id"])
    assert_response :no_content
  end

  test "デモではパスワードを変更できない" do
    sign_in_as users(:demo)
    patch api_v1_users_me_password_url,
          params: { current_password: "demo-password", password: "newpassword1", password_confirmation: "newpassword1" },
          as: :json
    assert_response :forbidden
    assert users(:demo).reload.authenticate("demo-password")
  end

  test "デモには再設定のメールを送らず、トークンでの再設定もできない" do
    assert_no_enqueued_emails do
      post api_v1_passwords_url, params: { email_address: "demo@example.com" }, as: :json
    end
    assert_response :success

    patch api_v1_password_url(users(:demo).password_reset_token), params: { password: "newpassword1" }, as: :json
    assert_response :unprocessable_entity
    assert users(:demo).reload.authenticate("demo-password")
  end

  test "新規登録の受付は REGISTRATION_OPEN で切り替わる" do
    get api_v1_registration_url
    assert_equal true, response.parsed_body["open"]

    with_env("REGISTRATION_OPEN" => "false") do
      get api_v1_registration_url
      assert_equal false, response.parsed_body["open"]
      post api_v1_users_url, params: { email_address: "new@example.com", password: "password123" }, as: :json
      assert_response :forbidden
    end
  end
end
