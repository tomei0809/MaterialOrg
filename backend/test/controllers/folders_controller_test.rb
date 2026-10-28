require "test_helper"

class Api::V1::FoldersControllerTest < ActionDispatch::IntegrationTest
  test "一覧は空のフォルダも含め、教材数を返す" do
    get api_v1_folders_url
    assert_response :success

    counts = response.parsed_body.to_h { |f| [ f["name"], f["materials_count"] ] }
    assert_equal({ "1年前期" => 1, "試験まとめ" => 0, "情報数学" => 0 }, counts)

    math = response.parsed_body.find { |f| f["name"] == "情報数学" }
    assert_equal folders(:first_year).id, math["parent_id"]
  end

  test "作成できる" do
    post api_v1_folders_url, params: { folder: { name: " 研究室 ", color: "green" } }

    assert_response :created
    assert_equal "研究室", response.parsed_body["name"]
    assert_equal "green", response.parsed_body["color"]
  end

  test "名前の重複や不正な色は作成できない" do
    post api_v1_folders_url, params: { folder: { name: "1年前期" } }
    assert_response :unprocessable_entity

    post api_v1_folders_url, params: { folder: { name: "新規", color: "magenta" } }
    assert_response :unprocessable_entity
  end

  test "名前と色を変更できる" do
    patch api_v1_folder_url(folders(:exam)), params: { folder: { name: "期末対策", color: "purple" } }

    assert_response :success
    assert_equal %w[期末対策 purple], folders(:exam).reload.then { [ it.name, it.color ] }
  end

  test "削除すると中の教材は未分類に戻る" do
    material = materials(:math_slide)

    assert_no_difference "Material.count" do
      delete api_v1_folder_url(folders(:first_year))
    end

    assert_response :no_content
    assert_nil material.reload.folder_id
  end

  test "サブフォルダを作成・別の親へ移動できる" do
    post api_v1_folders_url, params: { folder: { name: "演習", parent_id: folders(:math).id } }
    assert_response :created
    assert_equal folders(:math).id, response.parsed_body["parent_id"]

    patch api_v1_folder_url(folders(:math)), params: { folder: { parent_id: folders(:exam).id } }
    assert_response :success
    assert_equal folders(:exam).id, folders(:math).reload.parent_id

    # 最上位へ戻す
    patch api_v1_folder_url(folders(:math)), params: { folder: { parent_id: "" } }
    assert_nil folders(:math).reload.parent_id
  end

  test "自分の子孫の中へは移動できない" do
    patch api_v1_folder_url(folders(:first_year)), params: { folder: { parent_id: folders(:math).id } }

    assert_response :unprocessable_entity
    assert_nil folders(:first_year).reload.parent_id
  end

  test "追加した色（浅葱など）でも作成できる" do
    post api_v1_folders_url, params: { folder: { name: "演習", color: "teal" } }

    assert_response :created
    assert_equal "teal", response.parsed_body["color"]
  end

  test "一覧は並び順（position）の順に返す" do
    folders(:exam).update!(position: -1)
    get api_v1_folders_url

    assert_equal [ "試験まとめ", "1年前期", "情報数学" ], response.parsed_body.map { |f| f["name"] }
    assert_equal(-1, response.parsed_body.first["position"])
  end

  test "arrange でフォルダを別のフォルダの中へ入れ、並べられる" do
    patch arrange_api_v1_folders_url,
          params: { parent_id: folders(:first_year).id, folder_ids: [ folders(:exam).id, folders(:math).id ] },
          as: :json

    assert_response :success
    assert_equal folders(:first_year).id, folders(:exam).reload.parent_id
    assert_equal [ 0, 1 ], [ folders(:exam).position, folders(:math).reload.position ]
    assert_equal 3, response.parsed_body.size
  end

  test "arrange で最上位へ戻せる" do
    patch arrange_api_v1_folders_url,
          params: { parent_id: nil, folder_ids: [ folders(:math).id, folders(:first_year).id, folders(:exam).id ] },
          as: :json

    assert_response :success
    assert_nil folders(:math).reload.parent_id
    assert_equal 0, folders(:math).position
  end

  test "arrange で同じ名前のフォルダがある場所や自分の子孫へは移せない" do
    Folder.create!(name: "情報数学", parent: folders(:exam))
    patch arrange_api_v1_folders_url,
          params: { parent_id: folders(:exam).id, folder_ids: [ folders(:exam).children.first.id, folders(:math).id ] },
          as: :json
    assert_response :unprocessable_entity
    assert_equal folders(:first_year).id, folders(:math).reload.parent_id

    patch arrange_api_v1_folders_url,
          params: { parent_id: folders(:math).id, folder_ids: [ folders(:first_year).id ] },
          as: :json
    assert_response :unprocessable_entity
    assert_not_empty response.parsed_body["errors"]
  end
end
