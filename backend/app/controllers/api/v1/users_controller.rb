module Api
  module V1
    # 新規登録とパスワードの変更
    class UsersController < ApplicationController
      allow_unauthenticated_access only: %i[create registration]
      rate_limit to: 5, within: 1.hour, only: :create, with: -> { too_many_requests }

      # GET /api/v1/registration
      def registration
        render json: { open: User.registration_open? }
      end

      # POST /api/v1/users { email_address, password, password_confirmation }
      # 登録できたらそのままログインする。人数が上限（MAX_USERS）に達していたら 403
      def create
        unless User.registration_open?
          return render json: { errors: [ "現在、新規登録は受け付けていません" ] }, status: :forbidden
        end

        user = User.new(params.permit(:email_address, :password, :password_confirmation))
        if user.save
          start_new_session_for user
          render json: { id: user.id, email_address: user.email_address, demo: user.demo? }, status: :created
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/users/me/password { current_password, password, password_confirmation }
      # 変更したら、この端末以外のログインは終わらせる
      def update_password
        user = Current.user
        # デモアカウントのパスワードを変えられると、次の人がログインできなくなるため止める
        if user.demo?
          return render json: { errors: [ "デモアカウントではパスワードを変更できません" ] }, status: :forbidden
        end
        unless user.authenticate(params[:current_password].to_s)
          return render json: { errors: [ "今のパスワードが違います" ] }, status: :unprocessable_entity
        end
        if params[:password].blank?
          return render json: { errors: [ "新しいパスワードを入力してください" ] }, status: :unprocessable_entity
        end

        if user.update(params.permit(:password, :password_confirmation))
          user.sessions.where.not(id: Current.session.id).destroy_all
          head :no_content
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def too_many_requests
        render json: { errors: [ "試行回数が多すぎます。しばらく待ってからもう一度お試しください" ] },
               status: :too_many_requests
      end
    end
  end
end
