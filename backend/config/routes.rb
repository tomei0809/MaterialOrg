Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check


  namespace :api do
    namespace :v1 do
      # ログイン・新規登録・パスワード
      resource :session, only: %i[show create destroy]
      resources :users, only: :create
      # 新規登録を受け付けているか（ログイン画面で「新規登録」を出すか決める）
      get "registration", to: "users#registration"
      # デモアカウントの初期化（管理者用。DEMO_ADMIN_TOKEN が必要）
      namespace :admin do
        resource :demo_reset, only: :create
      end
      patch "users/me/password", to: "users#update_password"
      resources :passwords, only: %i[create update], param: :token

      resources :materials, only: %i[index create update destroy] do
        patch :move, on: :collection
        patch :assign_bundle, on: :collection
        patch :favorite, on: :collection
        patch :opened, on: :member
        # ゴミ箱
        get :trash, on: :collection
        patch :restore, on: :collection
        delete :purge, on: :collection
      end
      resources :bundles, only: %i[index create update destroy] do
        patch :reorder, on: :member
      end
      resources :tags, only: %i[index]
      resources :folders, only: %i[index create update destroy] do
        patch :arrange, on: :collection
      end
    end
  end
  # Defines the root path route ("/")
  # root "posts#index"
end
