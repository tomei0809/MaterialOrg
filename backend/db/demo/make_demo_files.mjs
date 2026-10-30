// デモアカウントのサンプル添付ファイルを作る（内容はすべて架空）
// 使い方：node make-demo-files.mjs <出力先> <作業用フォルダ>
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const OUT = process.argv[2];
const WORK = process.argv[3];
mkdirSync(OUT, { recursive: true });
mkdirSync(WORK, { recursive: true });
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// ---------- ZIP（docx・pptx・xlsx・zip に使う） ----------
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function makeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const comp = deflateRawSync(data);
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(data), 16); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, comp);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

// ---------- HTML を Chrome で PDF・PNG にする ----------
const BASE_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Yu Gothic UI", "Yu Gothic", "Meiryo", sans-serif; color: #1c2430; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;
function toPdf(name, html) {
  const file = join(WORK, `${name}.html`);
  writeFileSync(file, html);
  execFileSync(CHROME, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${join(OUT, `${name}.pdf`)}`, pathToFileURL(file).href], { stdio: 'ignore' });
}
function toPng(name, html, width, height) {
  const file = join(WORK, `${name}.html`);
  writeFileSync(file, html);
  execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', `--window-size=${width},${height}`, `--screenshot=${join(OUT, `${name}.png`)}`, pathToFileURL(file).href], { stdio: 'ignore' });
}

// 講義スライド（16:9 の横長）
function slides(course, number, title, pages) {
  const page = ({ heading, bullets = [], figure = '' }, i) => `
    <section class="slide">
      <header><span>${course}　第${number}回</span><span>${i + 1} / ${pages.length + 1}</span></header>
      <h2>${heading}</h2>
      <div class="body"><ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>${figure}</div>
    </section>`;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${BASE_CSS}
    @page { size: 254mm 142.9mm; margin: 0; }
    .slide { width: 254mm; height: 142.9mm; padding: 9mm 14mm; position: relative; break-after: page; background: #fff; }
    .slide:last-child { break-after: auto; }
    .cover { background: linear-gradient(135deg, #2f5da8, #14889a); color: #fff; display: flex; flex-direction: column; justify-content: center; }
    .cover h1 { font-size: 30pt; margin: 0 0 6mm; } .cover p { font-size: 13pt; margin: 0; opacity: .9; }
    header { display: flex; justify-content: space-between; font-size: 9pt; color: #5b6676; border-bottom: 1.5px solid #2f5da8; padding-bottom: 2mm; }
    h2 { font-size: 21pt; margin: 6mm 0 5mm; color: #1f3f78; }
    .body { display: flex; gap: 10mm; align-items: flex-start; }
    ul { margin: 0; padding-left: 6mm; font-size: 14pt; line-height: 1.8; flex: 1; }
    .fig { flex: none; }
    .math { font-family: "Cambria Math", "Times New Roman", serif; font-style: italic; }
    .box { border: 1.5px solid #2f5da8; border-radius: 3mm; padding: 4mm 6mm; font-size: 15pt; background: #eef3fb; }
  </style></head><body>
    <section class="slide cover"><h1>${title}</h1><p>${course}　第${number}回（2026年度 前期）</p><p style="margin-top:14mm;font-size:10pt">※ デモ用の架空の講義資料です</p></section>
    ${pages.map(page).join('')}
  </body></html>`;
}

const matrix = (rows) => `<span class="math" style="display:inline-flex;align-items:center;gap:2mm;font-size:18pt">
  <span style="font-size:40pt;font-weight:200">(</span>
  <span style="display:grid;grid-template-columns:repeat(${rows[0].length},auto);gap:1mm 5mm;text-align:center">${rows.flat().map((v) => `<span>${v}</span>`).join('')}</span>
  <span style="font-size:40pt;font-weight:200">)</span></span>`;

toPdf('la01_matrix', slides('線形代数', 1, '行列とベクトル', [
  { heading: '今日の目標', bullets: ['行列とベクトルの記法に慣れる', '行列の和・スカラー倍・積を計算できる', '積が交換できない例を挙げられる'] },
  { heading: '行列の積', bullets: ['(m×n) と (n×p) の積は (m×p)', '左の行と右の列の内積を並べる', '<b>AB ≠ BA</b> が一般的'],
    figure: `<div class="fig box">${matrix([['1', '2'], ['3', '4']])} ${matrix([['0', '1'], ['1', '0']])} = ${matrix([['2', '1'], ['4', '3']])}</div>` },
  { heading: '演習', bullets: ['教科書 p.12 問1〜4', '次回までに単位行列・逆行列を予習', '質問はオフィスアワー（水 3限）へ'] },
]));
toPdf('la02_determinant', slides('線形代数', 2, '行列式', [
  { heading: '2次の行列式', bullets: ['det A = ad − bc', '面積の拡大率として読める', 'det A = 0 ⇔ 逆行列をもたない'],
    figure: `<div class="fig box">det ${matrix([['a', 'b'], ['c', 'd']])} = <span class="math">ad − bc</span></div>` },
  { heading: '性質', bullets: ['det(AB) = det A · det B', '行を入れ替えると符号が変わる', '三角行列は対角成分の積'] },
]));
toPdf('la03_eigen', slides('線形代数', 3, '固有値と固有ベクトル', [
  { heading: '定義', bullets: ['Av = λv（v ≠ 0）', 'λ：固有値、v：固有ベクトル', '特性方程式 det(A − λI) = 0 を解く'] },
  { heading: '例', bullets: ['A の特性方程式は λ² − 5λ + 6 = 0', 'λ = 2, 3', '対角化の準備になる'],
    figure: `<div class="fig box">A = ${matrix([['4', '−2'], ['1', '1']])}</div>` },
  { heading: '次回', bullets: ['対角化と、その応用（漸化式・微分方程式）', '小テストあり（第1〜3回の範囲）'] },
]));

// 試験・小テスト（A4 縦）
function exam(title, subtitle, questions) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${BASE_CSS}
    @page { size: A4; margin: 18mm 20mm; }
    h1 { font-size: 17pt; text-align: center; margin: 0 0 2mm; } .sub { text-align: center; color: #5b6676; font-size: 10pt; margin-bottom: 6mm; }
    .meta { display: flex; justify-content: space-between; border: 1px solid #1c2430; padding: 3mm 4mm; font-size: 10pt; margin-bottom: 8mm; }
    .q { margin-bottom: 9mm; font-size: 11.5pt; line-height: 1.9; } .q b { display: inline-block; width: 12mm; }
    .space { height: 30mm; border-bottom: 1px dashed #b5bdc8; }
    .note { font-size: 9pt; color: #5b6676; margin-top: 10mm; }
  </style></head><body>
    <h1>${title}</h1><div class="sub">${subtitle}</div>
    <div class="meta"><span>学籍番号：＿＿＿＿＿＿＿＿</span><span>氏名：＿＿＿＿＿＿＿＿＿＿＿＿</span><span>試験時間 60分</span></div>
    ${questions.map((q, i) => `<div class="q"><b>問${i + 1}.</b>${q}<div class="space"></div></div>`).join('')}
    <div class="note">※ デモ用の架空の問題です。</div>
  </body></html>`;
}
toPdf('la_exam_2025', exam('線形代数 I　期末試験', '2025年度 前期', [
  '行列 A = [[2, 1], [1, 2]] の固有値と固有ベクトルを求めよ。',
  '3次の正方行列 B について det(2B) を det B を用いて表せ。理由も述べよ。',
  '連立一次方程式 x + 2y = 5, 3x − y = 1 を行列を用いて解け。',
  '行列の積が交換法則を満たさない例を1つ挙げ、計算で示せ。',
]));
toPdf('dm_quiz_4', exam('情報数学　小テスト 第4回', '集合と写像（範囲：第1〜4回）', [
  'A = {1, 2, 3}, B = {2, 3, 4} のとき A ∪ B, A ∩ B, A − B を求めよ。',
  '写像 f: ℝ → ℝ, f(x) = 2x + 1 が全単射であることを示せ。',
  'ド・モルガンの法則をベン図を用いて説明せよ。',
]));

// 板書の写真（風の画像）と、時間割
toPng('la03_board', `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
  body { width: 1200px; height: 800px; background: #6b4b2e; display: flex; align-items: center; justify-content: center; }
  .board { width: 1140px; height: 740px; background: radial-gradient(circle at 30% 30%, #3c5e4e, #2c4a3d); border-radius: 6px; color: #eef2ec; padding: 50px 60px; font-family: "Segoe Print", "Yu Gothic", cursive; position: relative; }
  h1 { font-size: 46px; margin: 0 0 24px; } p { font-size: 34px; margin: 14px 0; }
  .y { color: #f3dc7a; } .p { color: #f5a8b8; }
  svg { position: absolute; right: 70px; bottom: 80px; }
  .tray { position: absolute; left: 0; right: 0; bottom: -18px; height: 18px; background: #8a6a48; }
</style></head><body><div class="board">
  <h1>第3回　固有値・固有ベクトル</h1>
  <p>Av = <span class="y">λ</span>v　（v ≠ 0）</p>
  <p>det(A − <span class="y">λ</span>I) = 0　← 特性方程式</p>
  <p>例）A = (4 −2 ; 1 1)</p>
  <p class="p">λ² − 5λ + 6 = 0　→　λ = 2, 3</p>
  <p style="font-size:26px;margin-top:40px">※ 次回 小テスト（第1〜3回）</p>
  <svg width="300" height="240" viewBox="0 0 300 240" fill="none" stroke="#eef2ec" stroke-width="4"><path d="M30 210 H280 M30 210 V20"/><path d="M30 210 L230 60" stroke="#f3dc7a"/><path d="M30 210 L150 120"/><circle cx="150" cy="120" r="6" fill="#eef2ec"/></svg>
  <div class="tray"></div>
</div></body></html>`, 1200, 800);

toPng('timetable', `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
  body { width: 1000px; height: 640px; background: #f4f6f8; padding: 28px; }
  h1 { font-size: 24px; margin: 0 0 16px; }
  table { border-collapse: collapse; width: 100%; background: #fff; font-size: 15px; }
  th, td { border: 1px solid #d5dbe3; height: 78px; text-align: center; }
  th { background: #eef1f4; height: 40px; }
  .c { border-radius: 6px; margin: 6px; padding: 8px 4px; color: #fff; font-weight: 700; }
</style></head><body><h1>2026年度 前期 時間割</h1><table>
  <tr><th style="width:70px"></th><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th></tr>
  <tr><th>1限</th><td><div class="c" style="background:#2f5da8">線形代数</div></td><td></td><td><div class="c" style="background:#7657b0">情報数学</div></td><td></td><td></td></tr>
  <tr><th>2限</th><td></td><td><div class="c" style="background:#2f9468">プログラミング演習</div></td><td></td><td><div class="c" style="background:#2f5da8">線形代数</div></td><td></td></tr>
  <tr><th>3限</th><td></td><td><div class="c" style="background:#2f9468">プログラミング演習</div></td><td></td><td></td><td><div class="c" style="background:#c9612a">卒業研究</div></td></tr>
  <tr><th>4限</th><td><div class="c" style="background:#6f7f25">キャリア</div></td><td></td><td></td><td></td><td><div class="c" style="background:#c9612a">卒業研究</div></td></tr>
  <tr><th>5限</th><td></td><td></td><td></td><td></td><td></td></tr>
</table><p style="font-size:12px;color:#5b6676">※ デモ用の架空の時間割です</p></body></html>`, 1000, 640);

// ---------- テキスト系 ----------
writeFileSync(join(OUT, 'la03_summary.md'), `# 第3回 固有値と固有ベクトル（自分用まとめ）

## ポイント
- **Av = λv**（v ≠ 0）を満たす λ が固有値、v が固有ベクトル
- 求め方：特性方程式 \`det(A − λI) = 0\` を解く
- 固有値が異なれば、固有ベクトルは一次独立

## 例
| 行列 | 特性方程式 | 固有値 |
| --- | --- | --- |
| (4 −2 ; 1 1) | λ² − 5λ + 6 = 0 | 2, 3 |
| (2 1 ; 1 2) | λ² − 4λ + 3 = 0 | 1, 3 |

## 試験に出そう
1. 2×2 の固有値・固有ベクトル
2. 対角化できる条件

> 次回は小テスト（第1〜3回）。板書の写真も見直す。
`);

writeFileSync(join(OUT, 'dm_sets.md'), `# 情報数学 まとめ：集合と写像

## 集合の演算
- 和集合 \`A ∪ B\`、積集合 \`A ∩ B\`、差集合 \`A − B\`
- ド・モルガンの法則：(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ

## 写像
| 種類 | 意味 |
| --- | --- |
| 単射 | 違う元は違う元に移る |
| 全射 | 行き先のすべてに何かが移ってくる |
| 全単射 | 単射かつ全射（逆写像がある） |

- [x] 第1〜3回の復習
- [ ] 小テスト 第4回の見直し
`);

writeFileSync(join(OUT, 'pg_sort.py'), `"""プログラミング演習 課題3：ソートアルゴリズムの比較（デモ用のサンプル）"""
import random
import time


def bubble_sort(values):
    """隣どうしを比べて入れ替える。計算量は O(n^2)"""
    a = list(values)
    for i in range(len(a)):
        for j in range(len(a) - i - 1):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
    return a


def merge_sort(values):
    """半分に分けて並べ、混ぜ合わせる。計算量は O(n log n)"""
    if len(values) <= 1:
        return list(values)
    middle = len(values) // 2
    left, right = merge_sort(values[:middle]), merge_sort(values[middle:])
    merged = []
    while left and right:
        merged.append(left.pop(0) if left[0] <= right[0] else right.pop(0))
    return merged + left + right


def measure(sort, values):
    start = time.perf_counter()
    sort(values)
    return time.perf_counter() - start


if __name__ == "__main__":
    for n in (100, 1000, 3000):
        data = [random.randint(0, 10_000) for _ in range(n)]
        print(f"n={n:5d}  bubble={measure(bubble_sort, data):.4f}s  merge={measure(merge_sort, data):.4f}s")
`);

writeFileSync(join(OUT, 'lab_response_time.csv'), ['試行,条件,応答時間(ms),成功', ...Array.from({ length: 24 }, (_, i) => {
  const cond = ['フォルダ整理あり', 'フォルダ整理なし', 'タグ検索'][i % 3];
  const base = [820, 1650, 610][i % 3];
  return `${i + 1},${cond},${base + ((i * 137) % 240) - 120},${i % 7 === 5 ? 'いいえ' : 'はい'}`;
})].join('\n') + '\n');

writeFileSync(join(OUT, 'lab_analysis.ipynb'), JSON.stringify({
  cells: [
    { cell_type: 'markdown', metadata: {}, source: ['# 応答時間の分析（デモ用）\n', '条件ごとに、資料を探し出すまでの時間を比べる。'] },
    { cell_type: 'code', execution_count: 1, metadata: {}, source: ['import csv, statistics\n', "rows = list(csv.DictReader(open('lab_response_time.csv', encoding='utf-8')))\n", 'len(rows)'], outputs: [{ output_type: 'execute_result', execution_count: 1, metadata: {}, data: { 'text/plain': ['24'] } }] },
    { cell_type: 'code', execution_count: 2, metadata: {}, source: ["for cond in ['フォルダ整理あり', 'フォルダ整理なし', 'タグ検索']:\n", "    xs = [int(r['応答時間(ms)']) for r in rows if r['条件'] == cond]\n", '    print(cond, round(statistics.mean(xs)))'], outputs: [{ output_type: 'stream', name: 'stdout', text: ['フォルダ整理あり 810\n', 'フォルダ整理なし 1650\n', 'タグ検索 600\n'] }] },
    { cell_type: 'markdown', metadata: {}, source: ['**結論**：整理とタグ検索で、探す時間はおよそ半分になった。'] },
  ],
  metadata: { kernelspec: { name: 'python3', display_name: 'Python 3' } }, nbformat: 4, nbformat_minor: 5,
}, null, 1));

writeFileSync(join(OUT, 'fe_memo.md'), `# 基本情報技術者試験 午前 対策メモ

## よく出る分野
1. 基数変換・2の補数
2. 計算量（O 記法）
3. データベースの正規化
4. ネットワーク（サブネットマスク）

## 覚えること
| 用語 | ひとこと |
| --- | --- |
| 第3正規形 | 推移的関数従属をなくす |
| ACID 特性 | 原子性・一貫性・独立性・永続性 |
| /24 | 255.255.255.0 |

> 過去問は1日20問。間違えた問題にはタグ「復習」を付ける。
`);

writeFileSync(join(OUT, 'old_memo.txt'), '去年の時間割のメモ（もう使わない）\n月1 線形代数 → 今年は木2にも\n');

// ---------- Office・ZIP ----------
const w = (style, text, list = false) =>
  `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${list ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ''}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
writeFileSync(join(OUT, 'pg_report2.docx'), makeZip({
  '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  'word/document.xml': `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${[
    w('Title', '課題2 レポート：探索アルゴリズムの計算量'),
    w('', '（デモ用のサンプルレポート）'),
    w('Heading1', '1. 目的'),
    w('', '線形探索と二分探索の実行時間を比べ、計算量の違いを確かめる。'),
    w('Heading1', '2. 方法'),
    w('', 'Python で要素数を 1,000 から 100,000 まで変え、それぞれ 10 回測った平均を比べた。'),
    w('', '線形探索：先頭から順に調べる', true),
    w('', '二分探索：整列済みの配列を半分ずつ絞り込む', true),
    w('Heading1', '3. 結果と考察'),
    w('', '要素数が 100 倍になると、線形探索はおよそ 100 倍、二分探索はほとんど変わらなかった。'),
  ].join('')}<w:tbl><w:tr><w:tc><w:p><w:r><w:t>要素数</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>線形探索</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>二分探索</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>1,000</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>0.04 ms</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>0.002 ms</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>100,000</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>4.1 ms</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>0.003 ms</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`,
}));

const slideXml = (title, bullets) => `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:txBody>${bullets.map((b) => `<a:p><a:r><a:t>${b}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
const notesXml = (text) => `<?xml version="1.0"?><p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`;
const deck = [
  ['中間発表：講義資料の整理が学習時間に与える影響', ['卒業研究　中間発表（デモ用）', '2026年10月']],
  ['背景', ['資料が端末やフォルダに散らばり、探す時間が長い', '形式（PDF・写真・コード）がばらばら']],
  ['方法', ['フォルダ整理・タグ検索の有無で、探す時間を比べた', '被験者 8 名 × 3 条件']],
  ['結果', ['整理あり：平均 0.8 秒、整理なし：1.7 秒', 'タグ検索：0.6 秒']],
  ['今後', ['被験者を増やす', '探す時間と成績の関係を調べる']],
];
const pptx = { '[Content_Types].xml': '<Types/>' };
deck.forEach(([title, bullets], i) => {
  pptx[`ppt/slides/slide${i + 1}.xml`] = slideXml(title, bullets);
  pptx[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="notesSlide" Target="../notesSlides/notesSlide${i + 1}.xml"/></Relationships>`;
  pptx[`ppt/notesSlides/notesSlide${i + 1}.xml`] = notesXml(`発表メモ：スライド${i + 1}は30秒で話す`);
});
writeFileSync(join(OUT, 'lab_midterm.pptx'), makeZip(pptx));

const cell = (ref, value) => (typeof value === 'number' ? `<c r="${ref}"><v>${value}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`);
const sheet = (rows) => `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cell(`${'ABCDE'[c]}${r + 1}`, v)).join('')}</row>`).join('')}</sheetData></worksheet>`;
writeFileSync(join(OUT, 'lab_schedule.xlsx'), makeZip({
  'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="予定" sheetId="1" r:id="rId1"/><sheet name="進み具合" sheetId="2" r:id="rId2"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml': sheet([['月', '予定', '締め切り'], ['10月', '中間発表', '10/28'], ['11月', '追加実験', '11/30'], ['12月', '論文の執筆', '12/20'], ['1月', '最終発表', '1/31']]),
  'xl/worksheets/sheet2.xml': sheet([['作業', '進み具合(%)'], ['関連研究', 90], ['実験', 60], ['分析', 40], ['執筆', 10]]),
}));

writeFileSync(join(OUT, 'pg_samples.zip'), makeZip({
  'samples/README.md': '# サンプルコード一式（デモ用）\n- search.py：線形探索と二分探索\n- stack.py：スタックの実装\n',
  'samples/search.py': 'def linear_search(a, x):\n    for i, v in enumerate(a):\n        if v == x:\n            return i\n    return -1\n\n\ndef binary_search(a, x):\n    lo, hi = 0, len(a) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if a[mid] == x:\n            return mid\n        if a[mid] < x:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n',
  'samples/stack.py': 'class Stack:\n    def __init__(self):\n        self.items = []\n\n    def push(self, x):\n        self.items.append(x)\n\n    def pop(self):\n        return self.items.pop()\n',
}));

rmSync(WORK, { recursive: true, force: true });
console.log('demo files ok');
