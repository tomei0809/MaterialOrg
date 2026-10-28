# 教材を分類ごとにまとめるフォルダ（教材は 0〜1 個のフォルダに入る）
# フォルダの中にフォルダを作って階層化できる
class Folder < ApplicationRecord
  MAX_NAME_LENGTH = 30
  # 最上位を 1 とした階層の上限
  MAX_DEPTH = 5
  # frontend/src/types/material.ts の FOLDER_COLORS とそろえる
  COLORS = %w[blue green yellow red purple teal orange olive pink gray].freeze

  belongs_to :parent, class_name: "Folder", optional: true
  has_many :children, class_name: "Folder", foreign_key: :parent_id, inverse_of: :parent
  # 削除時は中身を親へ移すため dependent は指定しない（before_destroy で処理）
  has_many :materials

  normalizes :name, with: ->(name) { name.unicode_normalize(:nfkc).strip }

  validates :name, presence: true,
                   length: { maximum: MAX_NAME_LENGTH },
                   uniqueness: { scope: :parent_id }
  validates :color, inclusion: { in: COLORS }
  validates :parent, presence: true, if: -> { parent_id.present? }
  validate :parent_must_not_create_cycle
  validate :depth_within_limit

  # 新しいフォルダは同じ親の中で末尾に並べる
  before_create :place_at_end
  # 削除しても中身は消さず、1つ上のフォルダへ移す（最上位なら未分類・最上位へ）
  before_destroy :move_contents_to_parent

  scope :ordered, -> { order(:position, :name) }

  # parent_id の中に ordered_ids の順でフォルダを並べる（別の親から移ってくるフォルダも含めてよい）。
  # 移動先に今あるフォルダはすべて ordered_ids に含める。循環・階層の上限・同名は通常の検証で弾き、
  # 1つでも保存できなければ全体を取り消す（ActiveRecord::RecordInvalid）
  def self.arrange(parent_id, ordered_ids)
    ordered_ids = ordered_ids.map(&:to_i)
    transaction do
      parent = parent_id.present? ? Folder.find(parent_id) : nil
      current_ids = Folder.where(parent_id: parent&.id).pluck(:id)
      if (current_ids - ordered_ids).any? || ordered_ids.uniq.size != ordered_ids.size
        raise ArgumentError, "並び替えるフォルダが、移動先の中身と一致しません"
      end

      folders = Folder.find(ordered_ids).index_by(&:id)
      ordered_ids.each_with_index do |id, index|
        folders.fetch(id).update!(parent: parent, position: index)
      end
    end
  end

  # 自分の子孫フォルダの ID（自分は含まない）
  def descendant_ids
    ids = []
    queue = [ id ]
    until queue.empty?
      child_ids = Folder.where(parent_id: queue).pluck(:id)
      ids.concat(child_ids)
      queue = child_ids
    end
    ids
  end

  # 最上位を 1 とした深さ
  def depth
    ancestor_ids.size + 1
  end

  private

  def ancestor_ids
    ids = []
    current = parent
    # 万一データが循環していても無限ループしないよう上限を設ける
    while current && ids.size <= MAX_DEPTH
      ids << current.id
      current = current.parent
    end
    ids
  end

  # 子孫の中で最も深い階層までの段数（自分だけなら 0）
  def subtree_height
    height = 0
    queue = [ id ]
    loop do
      queue = Folder.where(parent_id: queue).pluck(:id)
      break if queue.empty?

      height += 1
    end
    height
  end

  def parent_must_not_create_cycle
    return if parent_id.nil? || new_record?

    if parent_id == id || descendant_ids.include?(parent_id)
      errors.add(:parent, "に自分自身や自分の中のフォルダは指定できません")
    end
  end

  def depth_within_limit
    return if parent.nil? || errors.include?(:parent)

    total = depth + (new_record? ? 0 : subtree_height)
    if total > MAX_DEPTH
      errors.add(:base, "フォルダは#{MAX_DEPTH}階層までです")
    end
  end

  def place_at_end
    last = Folder.where(parent_id: parent_id).maximum(:position)
    self.position = last.nil? ? 0 : last + 1
  end

  # サブフォルダは親の中の末尾へ、元の並び順のまま移す
  def move_contents_to_parent
    last = Folder.where(parent_id: parent_id).where.not(id: id).maximum(:position) || -1
    children.ordered.each.with_index(1) do |child, offset|
      child.update_columns(parent_id: parent_id, position: last + offset)
    end
    materials.update_all(folder_id: parent_id)
  end
end
