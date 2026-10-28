# 複数の教材を一覧で1行にまとめて見せるための「まとめ」
# フォルダ（保存場所）とは独立しており、教材は 0〜1 個のまとめに入る
# まとめの中の並び順は materials.bundle_position（0 始まり）で持つ
class Bundle < ApplicationRecord
  MAX_NAME_LENGTH = 50

  has_many :materials, -> { order(:bundle_position, :id) }, dependent: :nullify

  # 見出しは入力どおりに残す（NFKC だと「1～10」の全角チルダが半角になるため前後の空白だけ除く）
  normalizes :name, with: ->(name) { name.strip }

  validates :name, presence: true, length: { maximum: MAX_NAME_LENGTH }

  # 中身が空になったまとめは表示する意味がないので削除する
  def self.remove_empty
    where.missing(:materials).destroy_all
  end

  # まとめから外した教材は並び順も消す
  def self.release(ids)
    Material.where(id: ids).update_all(bundle_id: nil, bundle_position: nil)
  end

  # 教材を、渡した順のまま末尾に追加する（すでに中にある教材は位置を変えない）
  def append(ids)
    ids = ids.map(&:to_i).uniq - materials.pluck(:id)
    start = (materials.maximum(:bundle_position) || -1) + 1
    ids.each_with_index do |id, index|
      Material.where(id: id).update_all(bundle_id: self.id, bundle_position: start + index)
    end
    ids.size
  end

  # 中身の並び順を、渡した ID の順に入れ替える（中身と同じ ID の集合でなければ false）
  def reorder(ids)
    ids = ids.map(&:to_i)
    return false unless ids.sort == materials.pluck(:id).sort

    ids.each_with_index do |id, index|
      Material.where(id: id).update_all(bundle_position: index)
    end
    true
  end
end
