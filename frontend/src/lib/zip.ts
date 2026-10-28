// ZIP（docx・pptx・xlsx・odt・zip など）を読む最小限の関数。追加の依存は使わず、
// 中央ディレクトリから一覧を作り、圧縮された中身はブラウザの DecompressionStream で展開する

export type ZipEntry = {
  name: string;
  // 0：無圧縮、8：deflate
  method: number;
  compressedSize: number;
  size: number;
  localHeaderOffset: number;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

// 中央ディレクトリの一覧（ZIP でなければ例外）
export function listZip(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer);
  // 末尾のコメント（最大 65535 バイト）を考えて後ろから終端レコードを探す
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 22 - 65535); i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP 形式ではありません');

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) break;
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    entries.push({
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      size: view.getUint32(offset + 24, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
      name: decoder.decode(new Uint8Array(buffer, offset + 46, nameLength)),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

// 1件の中身をバイト列で取り出す
export async function readZipEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(buffer);
  const at = entry.localHeaderOffset;
  if (view.getUint32(at, true) !== LOCAL_SIGNATURE) throw new Error('ZIP の中身を読めません');
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const data = new Uint8Array(buffer, start, entry.compressedSize);

  if (entry.method === 0) return data;
  if (entry.method !== 8) throw new Error('対応していない圧縮形式です');

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZipText(buffer: ArrayBuffer, entries: ZipEntry[], name: string) {
  const entry = entries.find((e) => e.name === name);
  if (!entry) return null;
  return new TextDecoder().decode(await readZipEntry(buffer, entry));
}
