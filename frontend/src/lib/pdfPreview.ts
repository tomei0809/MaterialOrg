// PDF のページを canvas に描く（pdf.js はプレビューを初めて出したときに読み込む）

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { cached } from './previewCache';

let pdfjs: Promise<typeof import('pdfjs-dist')> | null = null;

function loadPdfjs() {
  pdfjs ??= import('pdfjs-dist').then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    return lib;
  });
  return pdfjs;
}

export function openPdf(url: string): Promise<PDFDocumentProxy> {
  return cached(`pdf:${url}`, async () => {
    const lib = await loadPdfjs();
    return lib.getDocument({ url, isEvalSupported: false }).promise;
  });
}

// 枠（width×height）に収まる大きさで新しい canvas に描く（描画中の canvas を使い回すと pdf.js が失敗するため）。
// 高精細な画面では画素数を増やしてにじみを防ぐ
export async function renderPdfPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(width / base.width, height / base.height);
  const ratio = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: scale * ratio });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
  canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
  const context = canvas.getContext('2d');
  if (context) await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

// 倍率（1 = PDF の 72dpi 相当）を指定して描く。ビューアの拡大表示に使う
export async function renderPdfPageAt(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  return renderPdfPage(doc, pageNumber, base.width * scale, base.height * scale);
}

// 各ページの大きさ（倍率 1 のとき）
export async function pdfPageSizes(doc: PDFDocumentProxy) {
  const sizes: { width: number; height: number }[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const viewport = (await doc.getPage(n)).getViewport({ scale: 1 });
    sizes.push({ width: viewport.width, height: viewport.height });
  }
  return sizes;
}
