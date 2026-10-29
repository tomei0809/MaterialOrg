require "test_helper"

class Api::V1::MaterialsControllerTest < ActionDispatch::IntegrationTest
  setup { sign_in_as users(:one) }

  test "一覧にタグが含まれる" do
    get api_v1_materials_url
    assert_response :success

    math = response.parsed_body.find { |m| m["title"] == "情報数学 第1回" }
    assert_equal [ "復習用" ], math["tags"]
  end

  test "タグで絞り込める" do
    get api_v1_materials_url, params: { tag: "試験対策" }

    titles = response.parsed_body.map { |m| m["title"] }
    assert_equal [ "プログラミング言語A 過去問" ], titles
    # 絞り込みに使ったタグ以外も返る
    assert_equal [ "試験対策" ], response.parsed_body.first["tags"]
  end

  test "タグ付きで登録できる" do
    assert_difference "Material.count", 1 do
      post api_v1_materials_url, params: {
        material: {
          title: "線形代数 第1回", material_type: "notes",
          tag_names: [ "試験対策", "新タグ" ]
        }
      }
    end

    assert_response :created
    assert_equal %w[新タグ 試験対策].sort, response.parsed_body["tags"].sort
  end

  test "動画やプログラムのファイルを添付して登録でき、サイズと形式が返る" do
    %w[sample.mp4 sample.py].each do |name|
      post api_v1_materials_url, params: {
        material: {
          title: name, material_type: "other",
          file: fixture_file_upload(name)
        }
      }

      assert_response :created
      body = response.parsed_body
      assert_equal name, body["file_name"]
      assert_equal file_fixture(name).size, body["file_size"]
      assert body["file_content_type"].present?
    end
  end

  test "対応していない形式のファイルは 422 で、教材も作られない" do
    assert_no_difference [ "Material.count", "ActiveStorage::Blob.count" ] do
      post api_v1_materials_url, params: {
        material: {
          title: "a", material_type: "other",
          file: fixture_file_upload("sample.xyz")
        }
      }
    end

    assert_response :unprocessable_entity
    assert_match ".xyz", response.parsed_body["errors"].join
  end

  test "他の項目が不正なら更新時のタグ変更も巻き戻る" do
    material = materials(:math_slide)

    patch api_v1_material_url(material), params: {
      material: { title: "", tag_names: [ "試験対策" ] }
    }

    assert_response :unprocessable_entity
    assert_equal [ "復習用" ], material.reload.tag_names
  end

  test "タグ一覧は使用中のタグを返す" do
    users(:one).tags.create!(name: "未使用")

    get api_v1_tags_url
    assert_response :success

    names = response.parsed_body.map { |t| t["name"] }
    assert_equal %w[復習用 試験対策].sort, names.sort
    assert response.parsed_body.all? { |t| t["materials_count"] == 1 }
  end

  test "フォルダで絞り込める（none は未分類）" do
    get api_v1_materials_url, params: { folder_id: folders(:first_year).id }
    assert_equal [ "情報数学 第1回" ], response.parsed_body.map { |m| m["title"] }

    get api_v1_materials_url, params: { folder_id: "none" }
    assert_equal [ "プログラミング言語A 過去問" ], response.parsed_body.map { |m| m["title"] }
  end

  test "登録時にフォルダを指定できる・存在しないフォルダはエラー" do
    post api_v1_materials_url, params: {
      material: { title: "a", material_type: "notes", folder_id: folders(:exam).id }
    }
    assert_response :created
    assert_equal folders(:exam).id, response.parsed_body["folder_id"]

    post api_v1_materials_url, params: {
      material: { title: "a", material_type: "notes", folder_id: 0 }
    }
    assert_response :unprocessable_entity
  end

  test "まとめてフォルダへ移動・未分類へ戻せる" do
    ids = [ materials(:math_slide).id, materials(:programming_exam).id ]

    patch move_api_v1_materials_url, params: { ids: ids, folder_id: folders(:exam).id }
    assert_response :success
    assert_equal 2, response.parsed_body["moved"]
    assert_equal [ folders(:exam).id ] * 2, Material.where(id: ids).pluck(:folder_id)

    patch move_api_v1_materials_url, params: { ids: ids, folder_id: "" }
    assert_equal [ nil, nil ], Material.where(id: ids).pluck(:folder_id)
  end

  test "存在しないフォルダへは移動できない" do
    patch move_api_v1_materials_url, params: { ids: [ materials(:math_slide).id ], folder_id: 0 }

    assert_response :unprocessable_entity
    assert_equal folders(:first_year).id, materials(:math_slide).reload.folder_id
  end

  test "まとめに入れる・外すと、空になったまとめは消える" do
    exam = materials(:programming_exam)

    patch assign_bundle_api_v1_materials_url,
          params: { ids: [ exam.id ], bundle_id: bundles(:math_slides).id }
    assert_response :success
    assert_equal bundles(:math_slides).id, exam.reload.bundle_id

    patch assign_bundle_api_v1_materials_url,
          params: { ids: [ exam.id, materials(:math_slide).id ], bundle_id: "" }
    assert_nil exam.reload.bundle_id
    assert_not Bundle.exists?(ActiveRecord::FixtureSet.identify(:math_slides))
  end

  test "存在しないまとめには入れられない" do
    patch assign_bundle_api_v1_materials_url, params: { ids: [ materials(:math_slide).id ], bundle_id: 0 }

    assert_response :unprocessable_entity
  end

  test "最後の1件を削除するとまとめも消える" do
    delete api_v1_material_url(materials(:math_slide))

    assert_not Bundle.exists?(ActiveRecord::FixtureSet.identify(:math_slides))
  end

  test "まとめに入れた教材は末尾に並び、外すと並び順も消える" do
    exam = materials(:programming_exam)

    patch assign_bundle_api_v1_materials_url,
          params: { ids: [ exam.id ], bundle_id: bundles(:math_slides).id }
    assert_equal [ materials(:math_slide).id, exam.id ],
                 bundles(:math_slides).materials.map(&:id)
    assert_equal 1, exam.reload.bundle_position

    patch assign_bundle_api_v1_materials_url, params: { ids: [ exam.id ], bundle_id: "" }
    assert_nil exam.reload.bundle_position
  end

  test "お気に入りに入れる・外すと、更新日は変わらない" do
    slide = materials(:math_slide)
    exam = materials(:programming_exam)
    updated_at = slide.updated_at

    patch favorite_api_v1_materials_url, params: { ids: [ slide.id, exam.id ], favorite: true }, as: :json
    assert_response :success
    assert_equal 2, response.parsed_body["updated"]
    assert_not_nil slide.reload.favorited_at
    assert_equal updated_at, slide.updated_at

    # もう一度入れても日時は変わらない
    first = slide.favorited_at
    travel 1.minute do
      patch favorite_api_v1_materials_url, params: { ids: [ slide.id ], favorite: true }, as: :json
    end
    assert_equal 0, response.parsed_body["updated"]
    assert_equal first, slide.reload.favorited_at

    patch favorite_api_v1_materials_url, params: { ids: [ slide.id ], favorite: false }, as: :json
    assert_nil slide.reload.favorited_at
    assert_not_nil exam.reload.favorited_at
  end

  test "開いた日時を記録し、一覧に含める" do
    slide = materials(:math_slide)
    updated_at = slide.updated_at

    patch opened_api_v1_material_url(slide)
    assert_response :success
    assert_not_nil slide.reload.last_opened_at
    assert_equal updated_at, slide.updated_at

    get api_v1_materials_url
    json = response.parsed_body.find { |m| m["id"] == slide.id }
    assert json.key?("last_opened_at")
    assert json.key?("favorited_at")
  end

  test "削除するとゴミ箱へ移り、一覧・フォルダの件数・タグから消える" do
    slide = materials(:math_slide)
    folder_count = -> { get api_v1_folders_url; response.parsed_body.find { |f| f["id"] == slide.folder_id }["materials_count"] }
    before = folder_count.call

    delete api_v1_material_url(slide)
    assert_response :no_content
    assert slide.reload.trashed?
    assert_equal folders(:first_year).id, slide.folder_id, "フォルダは覚えておく"

    get api_v1_materials_url
    assert_not_includes response.parsed_body.map { |m| m["id"] }, slide.id
    assert_equal before - 1, folder_count.call

    get api_v1_tags_url
    assert_not_includes response.parsed_body.map { |t| t["name"] }, "復習用"
  end

  test "ゴミ箱の一覧は削除した日時と完全に削除される日時を返す" do
    get trash_api_v1_materials_url
    assert_response :success

    item = response.parsed_body.find { |m| m["id"] == materials(:trashed_note).id }
    assert_not_nil item["deleted_at"]
    assert_equal Time.zone.parse(item["deleted_at"]) + Material::TRASH_RETENTION, Time.zone.parse(item["purge_at"])
    assert response.parsed_body.all? { |m| m["deleted_at"].present? }
  end

  test "ゴミ箱から元のフォルダへ戻せる" do
    note = materials(:trashed_note)

    patch restore_api_v1_materials_url, params: { ids: [ note.id ] }, as: :json
    assert_response :success
    assert_equal 1, response.parsed_body["restored"]
    assert_nil note.reload.deleted_at

    get api_v1_materials_url(folder_id: folders(:first_year).id)
    assert_includes response.parsed_body.map { |m| m["id"] }, note.id
  end

  test "ゴミ箱の教材は移動・お気に入り・更新・まとめの対象にならない" do
    note = materials(:trashed_note)

    patch move_api_v1_materials_url, params: { ids: [ note.id ], folder_id: "" }, as: :json
    assert_equal 0, response.parsed_body["moved"]
    patch favorite_api_v1_materials_url, params: { ids: [ note.id ], favorite: true }, as: :json
    assert_equal 0, response.parsed_body["updated"]
    patch assign_bundle_api_v1_materials_url, params: { ids: [ note.id ], bundle_id: bundles(:math_slides).id }, as: :json
    assert_nil note.reload.bundle_id

    patch api_v1_material_url(note), params: { material: { title: "変更" } }
    assert_response :not_found
  end

  test "選んだ教材、またはゴミ箱のすべてを完全に削除できる" do
    note = materials(:trashed_note)
    delete api_v1_material_url(materials(:programming_exam))

    assert_difference -> { Material.count }, -1 do
      delete purge_api_v1_materials_url, params: { ids: [ note.id ] }, as: :json
    end
    assert_equal 1, response.parsed_body["purged"]

    # ゴミ箱に入っていない教材は ID を渡しても消えない
    assert_no_difference -> { Material.count } do
      delete purge_api_v1_materials_url, params: { ids: [ materials(:math_slide).id ] }, as: :json
    end

    delete purge_api_v1_materials_url, params: { all: true }, as: :json
    assert_equal 0, Material.trashed.count
    assert Material.exists?(materials(:math_slide).id)
  end

  test "期限を過ぎたゴミ箱の教材は、ゴミ箱を開いたときに完全に削除される" do
    note = materials(:trashed_note)
    note.update_columns(deleted_at: (Material::TRASH_RETENTION + 1.day).ago)

    get trash_api_v1_materials_url
    assert_not Material.exists?(note.id)
  end
end
