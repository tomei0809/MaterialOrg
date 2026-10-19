'use client';

import { useEffect, useState, type FormEvent } from 'react';

type MaterialType = 'slide' | 'assignment' | 'past_exam' | 'notes' | 'other';

type Material = {
  id: number;
  title: string;
  subject: string;
  material_type: MaterialType;
  description: string | null;
  created_at: string;
  updated_at: string;
  file_attached?: boolean;
  file_url?: string | null;
  file_name?: string | null;
};

type MaterialForm = {
  title: string;
  subject: string;
  material_type: MaterialType;
  description: string;
};

type SortOrder = 'created_desc' | 'created_asc' | 'updated_desc' | 'title_asc';

const initialForm: MaterialForm = {
  title: '',
  subject: '',
  material_type: 'slide',
  description: '',
};

const typeLabels: Record<MaterialType, string> = {
  slide: '講義スライド',
  assignment: '課題',
  past_exam: '過去問',
  notes: 'ノート',
  other: 'その他',
};

export default function Page() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [form, setForm] = useState<MaterialForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchTitle, setSearchTitle] = useState('');
  const [searchSubject, setSearchSubject] = useState('');
  const [searchType, setSearchType] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(
    null,
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>('created_desc');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function loadMaterials(filters?: {
    title?: string;
    subject?: string;
    material_type?: string;
  }) {
    setLoading(true);
    setError('');

    try {
      const query = new URLSearchParams();

      if (filters?.title) query.set('title', filters.title);
      if (filters?.subject) query.set('subject', filters.subject);
      if (filters?.material_type) {
        query.set('material_type', filters.material_type);
      }

      const queryString = query.toString();
      const url = queryString
        ? `/api/v1/materials?${queryString}`
        : '/api/v1/materials';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('教材一覧の取得に失敗しました。');
      }

      const data: Material[] = await response.json();
      setMaterials(data);
    } catch {
      setError(
        '教材一覧を取得できませんでした。RailsサーバーとAPIの設定を確認してください。',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMaterials();
  }, []);

  function updateForm<K extends keyof MaterialForm>(
    key: K,
    value: MaterialForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEditing(material: Material) {
    setEditingId(material.id);
    setForm({
      title: material.title,
      subject: material.subject,
      material_type: material.material_type,
      description: material.description ?? '',
    });
    setError('');
    setMessage('');
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(initialForm);
    setError('');
    setMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const isEditing = editingId !== null;
      const url = isEditing
        ? `/api/v1/materials/${editingId}`
        : '/api/v1/materials';

      // 教材情報とファイルを一緒に送信する
      const requestData = new FormData();

      requestData.append('material[title]', form.title);
      requestData.append('material[subject]', form.subject);
      requestData.append('material[material_type]', form.material_type);
      requestData.append('material[description]', form.description);

      if (selectedFile) {
        requestData.append('material[file]', selectedFile);
      }

      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        body: requestData,
      });

      const data: { errors?: string[] } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.errors?.join('、') ??
            (isEditing
              ? '教材を更新できませんでした。'
              : '教材を登録できませんでした。'),
        );
      }

      setForm(initialForm);
      setSelectedFile(null);
      setEditingId(null);
      setMessage(isEditing ? '教材を更新しました。' : '教材を登録しました。');

      await loadMaterials();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '予期しないエラーが発生しました。',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(material: Material) {
    const confirmed = window.confirm(
      `「${material.title}」を削除しますか？\nこの操作は取り消せません。`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(material.id);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/v1/materials/${material.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('教材を削除できませんでした。');
      }

      if (editingId === material.id) {
        setEditingId(null);
        setForm(initialForm);
      }

      setMessage('教材を削除しました。');
      await loadMaterials();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '予期しないエラーが発生しました。',
      );
    } finally {
      setDeletingId(null);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void loadMaterials({
      title: searchTitle.trim(),
      subject: searchSubject.trim(),
      material_type: searchType,
    });
  }

  function handleClearSearch() {
    setSearchTitle('');
    setSearchSubject('');
    setSearchType('');

    void loadMaterials();
  }

  function openMaterialDetail(material: Material) {
    setSelectedMaterialId(material.id);
  }

  function closeMaterialDetail() {
    setSelectedMaterialId(null);
  }

  const selectedMaterial = materials.find(
    (material) => material.id === selectedMaterialId,
  );

  const sortedMaterials = [...materials].sort((a, b) => {
    switch (sortOrder) {
      case 'created_desc':
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      case 'created_asc':
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

      case 'updated_desc':
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

      case 'title_asc':
        return a.title.localeCompare(b.title, 'ja');

      default:
        return 0;
    }
  });

  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: '32px' }}>
        <h1>MaterialOrganization</h1>
        <p>教材を登録・編集・削除し、一覧で管理するアプリ</p>
      </header>

      <section style={sectionStyle}>
        <h2>{editingId !== null ? '教材編集' : '教材登録'}</h2>

        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label htmlFor="title">教材名（必須）</label>
            <input
              id="title"
              required
              value={form.title}
              onChange={(event) => updateForm('title', event.target.value)}
              placeholder="例：情報数学 第1回"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="subject">科目名（必須）</label>
            <input
              id="subject"
              required
              value={form.subject}
              onChange={(event) => updateForm('subject', event.target.value)}
              placeholder="例：情報数学"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="material_type">教材の種類（必須）</label>
            <select
              id="material_type"
              required
              value={form.material_type}
              onChange={(event) =>
                updateForm('material_type', event.target.value as MaterialType)
              }
              style={inputStyle}
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldStyle}>
            <label htmlFor="description">説明（任意）</label>
            <textarea
              id="description"
              value={form.description}
              onChange={(event) =>
                updateForm('description', event.target.value)
              }
              placeholder="教材についての補足"
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="file">教材ファイル（任意）</label>
            <input
              id="file"
              type="file"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.md"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
              }}
            />

            {selectedFile && <p>選択中：{selectedFile.name}</p>}
          </div>

          <button type="submit" disabled={submitting}>
            {submitting
              ? editingId !== null
                ? '更新中...'
                : '登録中...'
              : editingId !== null
                ? '変更を保存'
                : '教材を登録'}
          </button>

          {editingId !== null && (
            <button
              type="button"
              onClick={cancelEditing}
              disabled={submitting}
              style={{ marginLeft: '8px' }}
            >
              編集をキャンセル
            </button>
          )}
        </form>
      </section>

      {message && (
        <p role="status" style={{ color: 'green' }}>
          {message}
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      )}

      <section style={sectionStyle}>
        <h2>教材検索</h2>

        <form onSubmit={handleSearch}>
          <div style={fieldStyle}>
            <label htmlFor="searchTitle">教材名</label>
            <input
              id="searchTitle"
              value={searchTitle}
              onChange={(event) => setSearchTitle(event.target.value)}
              placeholder="教材名で検索"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="searchSubject">科目名</label>
            <input
              id="searchSubject"
              value={searchSubject}
              onChange={(event) => setSearchSubject(event.target.value)}
              placeholder="科目名で検索"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="searchType">教材の種類</label>
            <select
              id="searchType"
              value={searchType}
              onChange={(event) => setSearchType(event.target.value)}
              style={inputStyle}
            >
              <option value="">すべて</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={loading}>
            検索
          </button>

          <button
            type="button"
            onClick={handleClearSearch}
            disabled={loading}
            style={{ marginLeft: '8px' }}
          >
            条件をクリア
          </button>
        </form>
      </section>

      <section>
        <h2>教材一覧</h2>
        <p>検索結果：{materials.length}件</p>

        {/* 並び替えの選択欄を追加 */}
        <div style={fieldStyle}>
          <label htmlFor="sortOrder">並び替え</label>
          <select
            id="sortOrder"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            style={inputStyle}
          >
            <option value="created_desc">登録日が新しい順</option>
            <option value="created_asc">登録日が古い順</option>
            <option value="updated_desc">更新日が新しい順</option>
            <option value="title_asc">教材名順</option>
          </select>
        </div>

        {loading ? (
          <p>教材を読み込んでいます...</p>
        ) : materials.length === 0 ? (
          <p>教材はまだ登録されていません。</p>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {sortedMaterials.map((material) => (
              <article key={material.id} style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>{material.title}</h3>
                <p>科目：{material.subject}</p>
                <p>種類：{typeLabels[material.material_type]}</p>

                {material.description && (
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    {material.description}
                  </p>
                )}

                <p>
                  <small>
                    登録日時：
                    {new Date(material.created_at).toLocaleString('ja-JP')}
                  </small>
                </p>

                <button
                  type="button"
                  onClick={() => openMaterialDetail(material)}
                >
                  詳細を見る
                </button>

                <div style={{ marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => startEditing(material)}
                    disabled={submitting || deletingId !== null}
                  >
                    編集
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDelete(material)}
                    disabled={submitting || deletingId !== null}
                    style={{ marginLeft: '8px' }}
                  >
                    {deletingId === material.id ? '削除中...' : '削除'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedMaterial && (
        <section style={sectionStyle}>
          <h2>教材詳細</h2>

          <p>
            <strong>教材名：</strong>
            {selectedMaterial.title}
          </p>

          <p>
            <strong>科目名：</strong>
            {selectedMaterial.subject}
          </p>

          <p>
            <strong>教材の種類：</strong>
            {typeLabels[selectedMaterial.material_type]}
          </p>

          <p>
            <strong>説明：</strong>
          </p>
          <p>
            {selectedMaterial.description?.trim() ||
              '説明は登録されていません。'}
          </p>

          <p>
            <strong>教材ファイル：</strong>
            {selectedMaterial.file_attached && selectedMaterial.file_url ? (
              <a
                href={selectedMaterial.file_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {selectedMaterial.file_name ?? 'ファイルを開く'}
              </a>
            ) : (
              'ファイルは登録されていません。'
            )}
          </p>

          <p>
            <strong>登録日時：</strong>
            {new Date(selectedMaterial.created_at).toLocaleString('ja-JP')}
          </p>

          <p>
            <strong>最終更新日時：</strong>
            {new Date(selectedMaterial.updated_at).toLocaleString('ja-JP')}
          </p>

          <button type="button" onClick={closeMaterialDetail}>
            一覧に戻る
          </button>
        </section>
      )}
    </main>
  );
}

const pageStyle = {
  maxWidth: '900px',
  margin: '0 auto',
  padding: '32px 20px',
  fontFamily: 'sans-serif',
  color: '#222',
};

const sectionStyle = {
  border: '1px solid #ddd',
  borderRadius: '10px',
  padding: '24px',
  marginBottom: '32px',
};

const fieldStyle = {
  marginBottom: '16px',
};

const inputStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box' as const,
  marginTop: '6px',
  padding: '10px',
  border: '1px solid #bbb',
  borderRadius: '6px',
  font: 'inherit',
};

const cardStyle = {
  border: '1px solid #ddd',
  borderRadius: '8px',
  padding: '20px',
};
