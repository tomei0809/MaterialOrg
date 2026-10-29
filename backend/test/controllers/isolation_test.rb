require "test_helper"

# 利用者どうしのデータは共有しない（ほかの利用者のものは見えず、変更もできない）
class IsolationTest < ActionDispatch::IntegrationTest
  setup { sign_in_as users(:two) }

  test "ほかの利用者の教材・フォルダ・まとめ・タグは一覧に出ない" do
    [ api_v1_materials_url, api_v1_folders_url, api_v1_bundles_url, api_v1_tags_url,
      trash_api_v1_materials_url ].each do |url|
      get url
      assert_equal [], response.parsed_body, url
    end
  end

  test "ほかの利用者の教材・フォルダ・まとめは変更・削除できない（404）" do
    patch api_v1_material_url(materials(:math_slide)), params: { material: { title: "x" } }
    assert_response :not_found
    delete api_v1_material_url(materials(:math_slide))
    assert_response :not_found
    patch api_v1_folder_url(folders(:math)), params: { folder: { name: "x" } }, as: :json
    assert_response :not_found
    delete api_v1_bundle_url(bundles(:math_slides))
    assert_response :not_found
    assert_not materials(:math_slide).reload.trashed?
  end

  test "一括操作でも、ほかの利用者の教材は変わらない" do
    slide = materials(:math_slide)
    patch move_api_v1_materials_url, params: { ids: [ slide.id ], folder_id: "" }, as: :json
    assert_equal 0, response.parsed_body["moved"]
    patch favorite_api_v1_materials_url, params: { ids: [ slide.id ], favorite: true }, as: :json
    assert_equal 0, response.parsed_body["updated"]
    patch restore_api_v1_materials_url, params: { ids: [ materials(:trashed_note).id ] }, as: :json
    assert_equal 0, response.parsed_body["restored"]
    delete purge_api_v1_materials_url, params: { all: true }, as: :json
    assert Material.exists?(materials(:trashed_note).id)
    assert_equal folders(:first_year).id, slide.reload.folder_id
  end

  test "ほかの利用者のフォルダへは移動・登録できない" do
    mine = users(:two).materials.create!(title: "自分の", material_type: "other")
    patch move_api_v1_materials_url, params: { ids: [ mine.id ], folder_id: folders(:math).id }, as: :json
    assert_response :unprocessable_entity

    post api_v1_materials_url,
         params: { material: { title: "a", material_type: "other", folder_id: folders(:math).id } }
    assert_response :unprocessable_entity
  end

  test "ほかの利用者の添付ファイルは取得できない" do
    slide = materials(:math_slide)
    slide.file.attach(io: StringIO.new("%PDF-1.4"), filename: "a.pdf", content_type: "application/pdf")
    path = Rails.application.routes.url_helpers.rails_storage_proxy_path(slide.file, only_path: true)

    get path
    assert_response :not_found

    sign_in_as users(:one)
    get path
    assert_response :success

    sign_out
    get path
    assert_response :unauthorized
  end
end
