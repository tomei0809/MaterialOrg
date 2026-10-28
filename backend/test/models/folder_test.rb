require "test_helper"

class FolderTest < ActiveSupport::TestCase
  test "同じ親の中では名前が重複できないが、親が違えば同じ名前を使える" do
    assert_not Folder.new(name: "情報数学", parent: folders(:first_year)).valid?
    assert Folder.new(name: "情報数学", parent: folders(:exam)).valid?
    assert_not Folder.new(name: "1年前期").valid?
  end

  test "自分自身や子孫を親にはできない" do
    first_year = folders(:first_year)

    first_year.parent = first_year
    assert_not first_year.valid?

    first_year.parent = folders(:math)
    assert_not first_year.valid?
  end

  test "階層は MAX_DEPTH まで" do
    parent = folders(:math) # 2階層目
    (Folder::MAX_DEPTH - 2).times do |i|
      parent = Folder.create!(name: "階層#{i}", parent: parent)
    end

    assert_equal Folder::MAX_DEPTH, parent.depth
    assert_not Folder.new(name: "深すぎ", parent: parent).valid?
  end

  test "サブフォルダごと移動したときも階層の上限を超えない" do
    # 4階層の木（first_year > math > a > b）を別フォルダの下に入れると 5 を超える
    a = Folder.create!(name: "a", parent: folders(:math))
    Folder.create!(name: "b", parent: a)
    deep = Folder.create!(name: "深い", parent: Folder.create!(name: "x", parent: folders(:exam)))

    first_year = folders(:first_year)
    first_year.parent = deep
    assert_not first_year.valid?
  end

  test "descendant_ids は孫まで含む" do
    child = Folder.create!(name: "孫", parent: folders(:math))

    assert_equal [ folders(:math).id, child.id ].sort, folders(:first_year).descendant_ids.sort
  end

  test "削除するとサブフォルダと教材は親へ移る" do
    math = folders(:math)
    grandchild = Folder.create!(name: "孫", parent: math)
    material = materials(:math_slide)
    material.update!(folder: math)

    math.destroy!

    assert_equal folders(:first_year).id, grandchild.reload.parent_id
    assert_equal folders(:first_year).id, material.reload.folder_id
  end

  test "新しいフォルダは同じ親の末尾に並ぶ" do
    assert_equal 2, Folder.create!(name: "研究室").position
    assert_equal 1, Folder.create!(name: "線形代数", parent: folders(:first_year)).position
  end

  test "arrange で並び替えと別の親への移動ができる" do
    Folder.arrange(nil, [ folders(:exam).id, folders(:math).id, folders(:first_year).id ])

    assert_equal [ "試験まとめ", "情報数学", "1年前期" ], Folder.where(parent_id: nil).ordered.pluck(:name)
    assert_nil folders(:math).reload.parent_id
  end

  test "arrange は1件でも保存できなければ全体を取り消す" do
    assert_raises(ActiveRecord::RecordInvalid) do
      # 1年前期を自分の子（情報数学）の中へは入れられない
      Folder.arrange(folders(:math).id, [ folders(:first_year).id ])
    end
    assert_nil folders(:first_year).reload.parent_id

    assert_raises(ArgumentError) do
      # 移動先にすでにあるフォルダ（情報数学）を省くことはできない
      Folder.arrange(folders(:first_year).id, [ folders(:exam).id ])
    end
    assert_nil folders(:exam).reload.parent_id
  end

  test "削除したフォルダのサブフォルダは親の末尾へ並ぶ" do
    a = Folder.create!(name: "a", parent: folders(:first_year))
    folders(:math).destroy!
    assert_equal folders(:first_year).id, a.reload.parent_id

    Folder.create!(name: "b", parent: folders(:exam))
    c = Folder.create!(name: "c", parent: folders(:exam))
    folders(:exam).destroy!
    assert_equal [ "1年前期", "b", "c" ], Folder.where(parent_id: nil).ordered.pluck(:name)
    assert_equal 2, c.reload.position
  end
end
