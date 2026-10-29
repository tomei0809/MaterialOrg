# リクエストの間だけ使う「今のログイン」（Current.user で利用者を取り出す）
class Current < ActiveSupport::CurrentAttributes
  attribute :session
  delegate :user, to: :session, allow_nil: true
end
