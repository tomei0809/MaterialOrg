namespace :demo do
  desc "デモアカウントを作り、サンプルデータを登録する（すでにあれば何もしない）"
  task setup: :environment do
    user = DemoAccount.setup!
    if user.materials.exists?
      puts "デモアカウント #{user.email_address} はすでにあります（初期化は demo:reset）"
    else
      result = DemoAccount.reset!(user)
      puts "デモアカウント #{result[:email]} を作り、サンプルを #{result[:created_materials]}件登録しました"
    end
  end

  desc "デモアカウントのデータをサンプルの状態に戻す（例：bin/rails demo:reset CONFIRM=demo）"
  task reset: :environment do
    abort "誤操作を防ぐため、CONFIRM=demo を付けて実行してください" unless ENV["CONFIRM"] == "demo"

    result = DemoAccount.reset!(DemoAccount.setup!)
    puts "#{result[:email]} を初期化しました（削除 #{result[:removed_materials]}件、登録 #{result[:created_materials]}件）"
  end
end
