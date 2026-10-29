class ApplicationMailer < ActionMailer::Base
  # 送信元は、Brevo で確認済みのアドレス（環境変数 MAIL_FROM）
  default from: -> { ENV.fetch("MAIL_FROM", "MaterialOrg <no-reply@example.com>") }
  layout "mailer"
end
