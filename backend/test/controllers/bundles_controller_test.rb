require "test_helper"

class Api::V1::BundlesControllerTest < ActionDispatch::IntegrationTest
  test "一覧は教材数を返す" do
    get api_v1_bundles_url
    assert_response :success
    assert_equal [ [ "情報数学 講義スライド", 1 ] ],
                 response.parsed_body.map { |b| [ b["name"], b["materials_count"] ] }
  end

  test "教材を指定して作成でき、元のまとめが空になれば消える" do
    ids = [ materials(:math_slide).id, materials(:programming_exam).id ]

    assert_no_difference "Bundle.count" do # 1つ作成・空になった1つが消える
      post api_v1_bundles_url, params: { bundle: { name: "講義資料1～10", material_ids: ids } }
    end

    assert_response :created
    assert_equal 2, response.parsed_body["materials_count"]
    assert_equal [ response.parsed_body["id"] ] * 2, Material.where(id: ids).pluck(:bundle_id)
    assert_not Bundle.exists?(ActiveRecord::FixtureSet.identify(:math_slides))
  end

  test "名前が空・教材が未指定なら作成できない" do
    post api_v1_bundles_url, params: { bundle: { name: "", material_ids: [ materials(:math_slide).id ] } }
    assert_response :unprocessable_entity

    post api_v1_bundles_url, params: { bundle: { name: "空" } }
    assert_response :unprocessable_entity
  end

  test "名前を変更できる" do
    patch api_v1_bundle_url(bundles(:math_slides)), params: { bundle: { name: " 第1～5回 " } }

    assert_response :success
    assert_equal "第1～5回", bundles(:math_slides).reload.name
  end

  test "解除しても教材は残る" do
    assert_no_difference "Material.count" do
      delete api_v1_bundle_url(bundles(:math_slides))
    end

    assert_response :no_content
    assert_nil materials(:math_slide).reload.bundle_id
  end

  test "作成時は渡した順に並び、並び替えで順番を入れ替えられる" do
    math, exam = materials(:math_slide), materials(:programming_exam)

    post api_v1_bundles_url, params: { bundle: { name: "並び替え", material_ids: [ exam.id, math.id ] } }
    bundle = Bundle.find(response.parsed_body["id"])
    assert_equal [ exam.id, math.id ], bundle.materials.map(&:id)

    patch reorder_api_v1_bundle_url(bundle), params: { material_ids: [ math.id, exam.id ] }
    assert_response :success
    assert_equal [ math.id, exam.id ], bundle.reload.materials.map(&:id)
    assert_equal [ 0, 1 ], bundle.materials.map(&:bundle_position)
  end

  test "中身と一致しない並び替えは 422 で、順番は変わらない" do
    bundle = bundles(:math_slides)

    patch reorder_api_v1_bundle_url(bundle), params: { material_ids: [ materials(:programming_exam).id ] }

    assert_response :unprocessable_entity
    assert_equal [ materials(:math_slide).id ], bundle.reload.materials.map(&:id)
  end
end
