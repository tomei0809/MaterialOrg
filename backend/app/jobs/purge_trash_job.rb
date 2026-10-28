# ゴミ箱に入れてから TRASH_RETENTION（30日）を過ぎた教材を完全に削除する
# （config/recurring.yml で毎日実行する）
class PurgeTrashJob < ApplicationJob
  queue_as :default

  def perform
    Material.purge_expired
  end
end
