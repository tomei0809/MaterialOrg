# 添付ファイルの配信（/rails/active_storage/...）を、その教材の持ち主にだけ許す。
# Active Storage の URL は推測できないが、URL が漏れてもほかの人には見えないようにする
module AuthorizedBlobAccess
  extend ActiveSupport::Concern

  included do
    before_action :authorize_blob_owner
  end

  private

  def authorize_blob_owner
    session_id = cookies.signed[:session_id]
    user_id = session_id && Session.where(id: session_id)
                                   .where("created_at > ?", Authentication::SESSION_LIFETIME.ago)
                                   .pick(:user_id)
    return head(:unauthorized) unless user_id

    owned = ActiveStorage::Attachment.where(blob_id: @blob.id, record_type: "Material")
                                     .joins("INNER JOIN materials ON materials.id = active_storage_attachments.record_id")
                                     .exists?(materials: { user_id: user_id })
    head :not_found unless owned
  end
end

Rails.application.config.to_prepare do
  [
    ActiveStorage::Blobs::ProxyController,
    ActiveStorage::Blobs::RedirectController,
    ActiveStorage::Representations::ProxyController,
    ActiveStorage::Representations::RedirectController
  ].each { |controller| controller.include(AuthorizedBlobAccess) }
end
