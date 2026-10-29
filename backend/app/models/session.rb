# ログイン中の端末（署名付き Cookie の session_id で結び付ける）
class Session < ApplicationRecord
  belongs_to :user
end
