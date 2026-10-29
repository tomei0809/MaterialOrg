namespace :users do
  desc "持ち主のいない教材・フォルダ・まとめ・タグを、指定した利用者のものにする（例：bin/rails users:claim_orphans EMAIL=you@example.com）"
  task claim_orphans: :environment do
    email = ENV["EMAIL"].to_s.strip.downcase
    abort "EMAIL=登録済みのメールアドレス を指定してください" if email.empty?

    user = User.find_by(email_address: email)
    abort "#{email} の利用者が見つかりません。先に画面から新規登録してください" unless user

    counts = ActiveRecord::Base.transaction do
      [ Material, Folder, Bundle, Tag ].to_h do |model|
        [ model.model_name.human, model.where(user_id: nil).update_all(user_id: user.id) ]
      end
    end
    counts.each { |name, count| puts "#{name}: #{count}件を #{email} に割り当てました" }
  end
end
