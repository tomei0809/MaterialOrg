require "test_helper"

class AuthenticationTest < ActionDispatch::IntegrationTest
  test "ログインしていなければ API は 401" do
    get api_v1_materials_url
    assert_response :unauthorized
    assert_equal [ "ログインしてください" ], response.parsed_body["errors"]

    get api_v1_session_url
    assert_response :unauthorized
  end

  test "ログインすると Cookie が付き、ログイン中の利用者を返す。ログアウトで終わる" do
    post api_v1_session_url, params: { email_address: "ONE@example.com", password: "password" }, as: :json
    assert_response :created
    assert_equal "one@example.com", response.parsed_body["email_address"]
    cookie = response.headers["Set-Cookie"].to_s
    assert_match(/httponly/i, cookie)
    assert_match(/samesite=lax/i, cookie)

    get api_v1_session_url
    assert_response :success
    assert_equal users(:one).id, response.parsed_body["id"]

    delete api_v1_session_url
    assert_response :no_content
    get api_v1_materials_url
    assert_response :unauthorized
  end

  test "パスワードが違えば 401" do
    post api_v1_session_url, params: { email_address: "one@example.com", password: "wrong" }, as: :json
    assert_response :unauthorized
    assert_equal [ "メールアドレスまたはパスワードが違います" ], response.parsed_body["errors"]
  end

  test "有効期限を過ぎたログインは使えない" do
    sign_in_as users(:one)
    travel Authentication::SESSION_LIFETIME + 1.minute do
      get api_v1_materials_url
    end
    assert_response :unauthorized
  end

  test "新規登録するとそのままログインし、空の状態から始まる" do
    assert_difference -> { User.count }, 1 do
      post api_v1_users_url, params: { email_address: "new@example.com", password: "password123",
                                       password_confirmation: "password123" }, as: :json
    end
    assert_response :created

    get api_v1_materials_url
    assert_response :success
    assert_equal [], response.parsed_body
  end

  test "新規登録の入力の誤り・重複は 422" do
    post api_v1_users_url, params: { email_address: "one@example.com", password: "password123" }, as: :json
    assert_response :unprocessable_entity

    post api_v1_users_url, params: { email_address: "x@example.com", password: "password123",
                                     password_confirmation: "different" }, as: :json
    assert_response :unprocessable_entity
  end

  test "登録できる人数の上限に達していたら 403" do
    ENV["MAX_USERS"] = User.count.to_s
    post api_v1_users_url, params: { email_address: "new@example.com", password: "password123" }, as: :json
    assert_response :forbidden
  ensure
    ENV.delete("MAX_USERS")
  end

  test "パスワードの変更は今のパスワードが必要で、ほかの端末のログインは終わる" do
    other_session = users(:one).sessions.create!
    sign_in_as users(:one)

    patch api_v1_users_me_password_url, params: { current_password: "wrong", password: "newpassword1" }, as: :json
    assert_response :unprocessable_entity

    patch api_v1_users_me_password_url,
          params: { current_password: "password", password: "newpassword1", password_confirmation: "newpassword1" },
          as: :json
    assert_response :no_content
    assert users(:one).reload.authenticate("newpassword1")
    assert_not Session.exists?(other_session.id)
    get api_v1_session_url
    assert_response :success
  end
end
