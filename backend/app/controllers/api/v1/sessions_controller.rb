module Api
  module V1
    # ログイン・ログアウト・ログイン中の利用者
    class SessionsController < ApplicationController
      allow_unauthenticated_access only: :create
      rate_limit to: 10, within: 3.minutes, only: :create, with: -> { too_many_requests }

      # GET /api/v1/session
      def show
        render json: user_json(Current.user)
      end

      # POST /api/v1/session { email_address, password }
      def create
        if (user = User.authenticate_by(params.permit(:email_address, :password)))
          start_new_session_for user
          render json: user_json(user), status: :created
        else
          render json: { errors: [ "メールアドレスまたはパスワードが違います" ] }, status: :unauthorized
        end
      end

      # DELETE /api/v1/session
      def destroy
        terminate_session
        head :no_content
      end

      private

      def user_json(user)
        { id: user.id, email_address: user.email_address, demo: user.demo? }
      end

      def too_many_requests
        render json: { errors: [ "試行回数が多すぎます。しばらく待ってからもう一度お試しください" ] },
               status: :too_many_requests
      end
    end
  end
end
