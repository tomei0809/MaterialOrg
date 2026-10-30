module Api
  module V1
    # パスワードを忘れたときの再設定（メールのリンクから）
    class PasswordsController < ApplicationController
      allow_unauthenticated_access
      rate_limit to: 5, within: 1.hour, only: :create, with: -> { too_many_requests }

      # POST /api/v1/passwords { email_address }
      # 登録の有無を知られないよう、アドレスがあってもなくても同じ応答を返す
      def create
        # デモアカウントには送らない（パスワードを変えられないようにするため。応答は同じにする）
        user = User.find_by(email_address: params[:email_address].to_s.strip.downcase)
        if user && !user.demo?
          PasswordsMailer.reset(user).deliver_later
        end
        render json: { message: "登録されているアドレスなら、再設定のメールを送りました" }
      end

      # PATCH /api/v1/passwords/:token { password, password_confirmation }
      # 再設定したら、すべての端末のログインを終わらせる
      def update
        user = User.find_by_password_reset_token!(params[:token])
        if user.demo?
          return render json: { errors: [ "デモアカウントではパスワードを変更できません" ] }, status: :unprocessable_entity
        end
        if params[:password].blank?
          return render json: { errors: [ "新しいパスワードを入力してください" ] }, status: :unprocessable_entity
        end

        if user.update(params.permit(:password, :password_confirmation))
          user.sessions.destroy_all
          head :no_content
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
        end
      rescue ActiveSupport::MessageVerifier::InvalidSignature
        render json: { errors: [ "再設定のリンクが無効か、期限が切れています。もう一度メールを送ってください" ] },
               status: :unprocessable_entity
      end

      private

      def too_many_requests
        render json: { errors: [ "試行回数が多すぎます。しばらく待ってからもう一度お試しください" ] },
               status: :too_many_requests
      end
    end
  end
end
