require "test_helper"
require "rake"

class UsersRakeTest < ActiveSupport::TestCase
  setup do
    Rails.application.load_tasks unless Rake::Task.task_defined?("users:claim_orphans")
    Rake::Task["users:claim_orphans"].reenable
  end

  test "持ち主のいないデータを指定した利用者に割り当てる" do
    orphan = Material.create!(title: "持ち主なし", material_type: "other")
    folder = Folder.create!(name: "持ち主なしのフォルダ")
    ENV["EMAIL"] = "TWO@example.com"
    assert_output(/件を two@example.com に割り当てました/) { Rake::Task["users:claim_orphans"].invoke }

    assert_equal users(:two).id, orphan.reload.user_id
    assert_equal users(:two).id, folder.reload.user_id
    assert_equal users(:one).id, materials(:math_slide).reload.user_id
  ensure
    ENV.delete("EMAIL")
  end
end
