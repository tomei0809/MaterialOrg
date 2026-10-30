module Api
  module V1
    module Admin
      # デモアカウントの初期化（管理者が GitHub Actions の「Run workflow」から呼ぶ）。
      # ログインの代わりに、環境変数 DEMO_ADMIN_TOKEN と同じトークンを Authorization ヘッダーで受け取る
      class DemoResetsController < ApplicationController
        # トークンが短すぎるときは、推測されやすいので機能ごと無効にする
        MIN_TOKEN_LENGTH = 32

        allow_unauthenticated_access
        rate_limit to: 5, within: 1.hour, with: -> { too_many_requests }
        before_action :authenticate_admin_token

        # POST /api/v1/admin/demo_reset
        def create
          render json: DemoAccount.reset!(DemoAccount.setup!)
        rescue DemoAccount::Conflict, KeyError => e
          render json: { errors: [ e.message ] }, status: :conflict
        end

        private

        def authenticate_admin_token
          expected = ENV["DEMO_ADMIN_TOKEN"].to_s
          return head(:not_found) if expected.length < MIN_TOKEN_LENGTH

          given = request.authorization.to_s.delete_prefix("Bearer ")
          head :unauthorized unless ActiveSupport::SecurityUtils.secure_compare(given, expected)
        end

        def too_many_requests
          render json: { errors: [ "試行回数が多すぎます" ] }, status: :too_many_requests
        end
      end
    end
  end
end
