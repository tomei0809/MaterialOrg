# ログイン状態の確認（Rails 8 の認証の形を JSON の API 向けにしたもの）。
# ログイン状態は DB の sessions と、署名付きの httpOnly Cookie（session_id）で持つ。
# 画面（Next.js）と API はブラウザから見て同じオリジンなので、Cookie は SameSite=Lax で足りる
# （ほかのサイトからの POST・PATCH・DELETE には Cookie が付かないため、CSRF も防げる）
module Authentication
  extend ActiveSupport::Concern

  SESSION_LIFETIME = 2.weeks

  included do
    before_action :require_authentication
  end

  class_methods do
    def allow_unauthenticated_access(**options)
      skip_before_action :require_authentication, **options
    end
  end

  private

  def authenticated?
    resume_session.present?
  end

  def require_authentication
    resume_session || request_authentication
  end

  def resume_session
    Current.session ||= find_session_by_cookie
  end

  def find_session_by_cookie
    id = cookies.signed[:session_id]
    session = Session.find_by(id: id) if id
    # 有効期限を過ぎたログインは使わない
    return session if session && session.created_at > SESSION_LIFETIME.ago

    session&.destroy
    nil
  end

  def request_authentication
    render json: { errors: [ "ログインしてください" ] }, status: :unauthorized
  end

  def start_new_session_for(user)
    user.sessions.create!(user_agent: request.user_agent, ip_address: request.remote_ip).tap do |session|
      Current.session = session
      cookies.signed[:session_id] = {
        value: session.id,
        expires: SESSION_LIFETIME.from_now,
        httponly: true,
        same_site: :lax,
        secure: Rails.env.production?
      }
    end
  end

  def terminate_session
    Current.session&.destroy
    cookies.delete(:session_id)
  end
end
