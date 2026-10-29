require "test_helper"

class MaterialTest < ActiveSupport::TestCase
  test "必須項目がないと無効" do
    material = users(:one).materials.new

    assert_not material.valid?
    assert_includes material.errors.attribute_names, :title
    assert_includes material.errors.attribute_names, :material_type
  end

  test "対応している形式のファイルは添付できる（大文字の拡張子も可）" do
    %w[lecture.MP4 voice.mp3 photo.JPEG main.py notebook.ipynb project.zip].each do |name|
      material = materials(:math_slide)
      material.file.attach(io: StringIO.new("data"), filename: name)

      assert material.valid?, "#{name}: #{material.errors.full_messages}"
    end
  end

  test "対応していない形式・拡張子なしのファイルは添付できない" do
    %w[setup.exe virus.scr noextension].each do |name|
      material = materials(:math_slide)
      material.file.attach(io: StringIO.new("data"), filename: name)

      assert_not material.valid?, name
      assert_match "アップロードできません", material.errors.full_messages.join
    end
  end

  test "上限サイズを超えるファイルは添付できない" do
    # 保存済みのレコードに attach するとその場で保存されるため、未保存のレコードで確認する
    material = users(:one).materials.new(title: "a", material_type: "other")
    material.file.attach(io: StringIO.new("data"), filename: "big.mp4")
    material.file.blob.byte_size = Material::MAX_FILE_SIZE + 1

    assert_not material.valid?
    assert_match "MB以下", material.errors.full_messages.join
  end

  test "教材の種類は定義済みの値のみ" do
    material = materials(:math_slide)
    material.material_type = "unknown"

    assert_not material.valid?
  end

  test "tag_names で既存タグの再利用と新規作成ができる" do
    material = materials(:math_slide)

    assert_difference "Tag.count", 1 do
      material.update!(tag_names: [ "試験対策", "重要" ])
    end

    assert_equal %w[試験対策 重要].sort, material.reload.tag_names.sort
  end

  test "tag_names は前後の空白・空文字・重複・全角英数を整える" do
    material = materials(:math_slide)
    material.update!(tag_names: [ " 復習用 ", "", "復習用", "ＡＢＣ" ])

    assert_equal %w[ABC 復習用].sort, material.reload.tag_names.sort
  end

  test "空の配列でタグをすべて外せる" do
    material = materials(:math_slide)
    material.update!(tag_names: [ "" ])

    assert_empty material.reload.tags
  end

  test "タグが多すぎる・長すぎると無効で、既存のタグは変わらない" do
    material = materials(:math_slide)

    material.tag_names = (1..11).map { |i| "タグ#{i}" }
    assert_not material.valid?

    material.tag_names = [ "あ" * 31 ]
    assert_not material.valid?

    assert_equal [ "復習用" ], material.reload.tag_names
  end

  test "削除すると中間テーブルも消えるがタグ自体は残る" do
    assert_difference [ "MaterialTag.count" ], -1 do
      assert_no_difference "Tag.count" do
        materials(:math_slide).destroy!
      end
    end
  end

  test "ゴミ箱へ移すとまとめから外れ、空になったまとめは消える。更新日は変わらない" do
    slide = materials(:math_slide)
    updated_at = slide.updated_at

    slide.trash!

    assert slide.trashed?
    assert_nil slide.bundle_id
    assert_nil slide.bundle_position
    assert_equal updated_at, slide.reload.updated_at
    assert_not Bundle.exists?(ActiveRecord::FixtureSet.identify(:math_slides))
    assert_not_includes Material.kept, slide
  end

  test "元に戻すと一覧の対象に戻る" do
    note = materials(:trashed_note)
    note.restore!
    assert_includes Material.kept, note
  end

  test "purge_expired は期限を過ぎたものだけを完全に削除する" do
    old = materials(:trashed_note)
    old.update_columns(deleted_at: (Material::TRASH_RETENTION + 1.minute).ago)
    recent = materials(:programming_exam)
    recent.trash!

    assert_equal 1, Material.purge_expired
    assert_not Material.exists?(old.id)
    assert Material.exists?(recent.id)
  end

  test "PurgeTrashJob は purge_expired を実行する" do
    materials(:trashed_note).update_columns(deleted_at: 31.days.ago)
    assert_difference -> { Material.count }, -1 do
      PurgeTrashJob.perform_now
    end
  end
end
