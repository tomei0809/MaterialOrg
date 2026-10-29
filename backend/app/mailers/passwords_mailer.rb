# パスワード再設定のメール（リンクは画面側の /reset-password を開く）
class PasswordsMailer < ApplicationMailer
  def reset(user)
    @user = user
    @reset_url = "#{ENV.fetch('APP_URL', 'http://localhost:3001')}/reset-password?token=#{user.password_reset_token}"
    @expires_in_minutes = (user.password_reset_token_expires_in / 60).to_i
    # 開発ではメールを送らないので、リンクをログに出して試せるようにする
    Rails.logger.info("[PasswordsMailer] 再設定のリンク: #{@reset_url}") if Rails.env.development?
    mail subject: "【MaterialOrg】パスワードの再設定", to: user.email_address
  end
end
