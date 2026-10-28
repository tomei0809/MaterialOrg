class Material < ApplicationRecord
  MAX_TAGS = 10

  # アップロードできるファイルの拡張子（frontend/src/lib/fileTypes.ts とそろえる）
  FILE_EXTENSIONS = {
    document: %w[pdf doc docx ppt pptx xls xlsx odt ods odp rtf txt md csv],
    image: %w[jpg jpeg png gif webp bmp heic heif svg],
    video: %w[mp4 m4v mov webm mkv avi],
    audio: %w[mp3 m4a aac wav ogg oga flac],
    code: %w[
      py ipynb js mjs cjs ts tsx jsx java c h cpp cc hpp cs rb go rs php swift kt kts
      scala r m sql sh bash ps1 bat html htm css scss json yaml yml xml toml ini
    ],
    archive: %w[zip]
  }.freeze
  ALLOWED_FILE_EXTENSIONS = FILE_EXTENSIONS.values.flatten.to_set.freeze
  MAX_FILE_SIZE = 500.megabytes

  belongs_to :folder, optional: true
  belongs_to :bundle, optional: true
  has_one_attached :file
  has_many :material_tags, dependent: :destroy
  has_many :tags, through: :material_tags

  validates :title, presence: true
  validates :material_type, presence: true
  # 存在しないフォルダIDを指定されたときは外部キーエラーではなく検証エラーにする
  validates :folder, presence: true, if: -> { folder_id.present? }
  validates :bundle, presence: true, if: -> { bundle_id.present? }

  validates :material_type,
            inclusion: {
              in: %w[slide assignment past_exam notes other]
            }

  validate :tag_names_must_be_valid
  validate :file_must_be_allowed

  # タグ名の配列で付け替える（存在しないタグは作成する）
  # 保存済みの教材では代入した時点で中間テーブルが更新されるため、
  # 不正な値のときは代入せず、検証エラーだけを返す
  # （他の項目のエラーで巻き戻せるよう、更新はトランザクション内で行うこと）
  def tag_names=(names)
    @tag_names = Array(names).map { |name| name.to_s.unicode_normalize(:nfkc).strip }
                             .compact_blank
                             .uniq
    return unless tag_names_valid?

    self.tags = @tag_names.map { |name| Tag.find_or_create_by!(name: name) }
  end

  def tag_names
    tags.map(&:name)
  end

  private

  def tag_names_valid?
    @tag_names.size <= MAX_TAGS &&
      @tag_names.all? { |name| name.length <= Tag::MAX_NAME_LENGTH }
  end

  # 新しく添付されたファイルだけを検証する（保存済みの古いファイルは対象外）
  def file_must_be_allowed
    return unless attachment_changes["file"].present? && file.attached?

    extension = File.extname(file.filename.to_s).delete_prefix(".").downcase
    unless ALLOWED_FILE_EXTENSIONS.include?(extension)
      errors.add(:base, "この形式のファイル（.#{extension.presence || '拡張子なし'}）はアップロードできません")
    end

    if file.blob.byte_size > MAX_FILE_SIZE
      errors.add(:base, "ファイルは#{MAX_FILE_SIZE / 1.megabyte}MB以下にしてください")
    end
  end

  def tag_names_must_be_valid
    return if @tag_names.nil?

    if @tag_names.size > MAX_TAGS
      errors.add(:base, "タグは#{MAX_TAGS}個までです")
    end

    if @tag_names.any? { |name| name.length > Tag::MAX_NAME_LENGTH }
      errors.add(:base, "タグは#{Tag::MAX_NAME_LENGTH}文字以内で入力してください")
    end
  end
end
