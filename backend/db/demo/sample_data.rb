# デモアカウントのサンプルデータ（内容はすべて架空）。DemoAccount.reset! がこの内容で登録し直す。
# 添付ファイルは db/demo/files/ にある（db/demo/make_demo_files.mjs で作成）。
# days_ago：登録日（何日前か）、opened_hours_ago：最後に開いた時刻（何時間前か）、trashed_days_ago：ゴミ箱に入れた日
module DemoSampleData
  FOLDERS = [
    { key: :term, name: "2026 前期", color: "blue", children: [
      { key: :linear, name: "線形代数", color: "purple" },
      { key: :programming, name: "プログラミング演習", color: "green" },
      { key: :discrete, name: "情報数学", color: "teal" }
    ] },
    { key: :lab, name: "卒業研究", color: "orange" },
    { key: :career, name: "就活・資格", color: "olive" }
  ].freeze

  BUNDLES = { linear3: "第3回 講義一式" }.freeze

  MATERIALS = [
    { title: "線形代数 第1回 行列とベクトル", type: "slide", folder: :linear, days_ago: 40,
      file: "la01_matrix.pdf", filename: "線形代数_第1回_行列とベクトル.pdf",
      description: "行列の和・スカラー倍・積。AB ≠ BA の例", tags: %w[復習] },
    { title: "線形代数 第2回 行列式", type: "slide", folder: :linear, days_ago: 33, opened_hours_ago: 30,
      file: "la02_determinant.pdf", filename: "線形代数_第2回_行列式.pdf",
      description: "2次の行列式と性質" },
    { title: "第3回 固有値と固有ベクトル（スライド）", type: "slide", folder: :linear, days_ago: 26, bundle: :linear3,
      favorite: true, file: "la03_eigen.pdf", filename: "線形代数_第3回_固有値.pdf" },
    { title: "第3回 板書", type: "notes", folder: :linear, days_ago: 26, bundle: :linear3,
      file: "la03_board.png", filename: "第3回_板書.png", description: "講義の板書を撮影したもの" },
    { title: "第3回 自分用まとめ", type: "notes", folder: :linear, days_ago: 25, bundle: :linear3, opened_hours_ago: 2,
      file: "la03_summary.md", filename: "第3回_まとめ.md", tags: %w[試験対策] },
    { title: "線形代数 2025年度 期末試験", type: "past_exam", folder: :linear, days_ago: 20, favorite: true,
      file: "la_exam_2025.pdf", filename: "線形代数_2025年度_期末試験.pdf",
      description: "先輩から共有された過去問（架空）", tags: %w[試験対策 重要] },
    { title: "課題3 ソートアルゴリズムの比較", type: "assignment", folder: :programming, days_ago: 6, opened_hours_ago: 5,
      file: "pg_sort.py", filename: "sort_compare.py",
      description: "締め切り 11/10。バブルソートとマージソートの実行時間を比べる", tags: %w[重要] },
    { title: "課題2 レポート 探索アルゴリズムの計算量", type: "assignment", folder: :programming, days_ago: 15,
      file: "pg_report2.docx", filename: "課題2_レポート.docx" },
    { title: "サンプルコード一式", type: "other", folder: :programming, days_ago: 30,
      file: "pg_samples.zip", filename: "samples.zip", description: "授業で配られたサンプルコード" },
    { title: "情報数学 まとめ 集合と写像", type: "notes", folder: :discrete, days_ago: 12,
      file: "dm_sets.md", filename: "集合と写像_まとめ.md", tags: %w[試験対策 復習] },
    { title: "情報数学 小テスト 第4回", type: "past_exam", folder: :discrete, days_ago: 9,
      file: "dm_quiz_4.pdf", filename: "情報数学_小テスト_第4回.pdf" },
    { title: "中間発表スライド", type: "slide", folder: :lab, days_ago: 3,
      file: "lab_midterm.pptx", filename: "中間発表.pptx", description: "発表メモ付き", tags: %w[重要] },
    { title: "実験データ 応答時間", type: "other", folder: :lab, days_ago: 4,
      file: "lab_response_time.csv", filename: "response_time.csv" },
    { title: "応答時間の分析ノートブック", type: "other", folder: :lab, days_ago: 4,
      file: "lab_analysis.ipynb", filename: "analysis.ipynb" },
    { title: "研究スケジュール", type: "other", folder: :lab, days_ago: 10,
      file: "lab_schedule.xlsx", filename: "研究スケジュール.xlsx" },
    { title: "基本情報技術者 午前 対策メモ", type: "notes", folder: :career, days_ago: 2,
      file: "fe_memo.md", filename: "基本情報_午前メモ.md", tags: %w[試験対策] },
    { title: "2026年度 前期 時間割", type: "other", folder: nil, days_ago: 45,
      file: "timetable.png", filename: "時間割_2026前期.png", description: "まだフォルダに入れていない資料（未分類）" },
    { title: "去年の時間割メモ", type: "other", folder: nil, days_ago: 200, trashed_days_ago: 5,
      file: "old_memo.txt", filename: "old_memo.txt", description: "ゴミ箱に入っている資料の例" }
  ].freeze
end
