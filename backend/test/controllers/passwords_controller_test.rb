require "test_helper"

class Api::V1::PasswordsControllerTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  test "登録されているアドレスには再設定のメールを送る。どちらでも同じ応答" do
    assert_enqueued_email_with PasswordsMailer, :reset, args: [ users(:one) ] do
      post api_v1_passwords_url, params: { email_address: "One@example.com" }, as: :json
    end
    assert_response :success
    message = response.parsed_body["message"]

    assert_no_enqueued_emails do
      post api_v1_passwords_url, params: { email_address: "nobody@example.com" }, as: :json
    end
    assert_response :success
    assert_equal message, response.parsed_body["message"]
  end

  test "メールのリンクのトークンで新しいパスワードを設定でき、ログインはすべて終わる" do
    user = users(:one)
    user.sessions.create!
    token = user.password_reset_token

    patch api_v1_password_url(token), params: { password: "newpassword1", password_confirmation: "newpassword1" },
                                      as: :json
    assert_response :no_content
    assert user.reload.authenticate("newpassword1")
    assert_equal 0, user.sessions.count
  end

  test "無効・期限切れのトークンでは変更できない" do
    patch api_v1_password_url("invalid"), params: { password: "newpassword1" }, as: :json
    assert_response :unprocessable_entity

    token = users(:one).password_reset_token
    travel 16.minutes do
      patch api_v1_password_url(token), params: { password: "newpassword1" }, as: :json
    end
    assert_response :unprocessable_entity
  end

  test "再設定のメールに画面のリンクと有効期限が入る" do
    mail = PasswordsMailer.reset(users(:one))
    assert_equal [ "one@example.com" ], mail.to
    assert_match %r{/reset-password\?token=}, mail.body.encoded
    assert_match "15 分", mail.body.decoded
  end
end
