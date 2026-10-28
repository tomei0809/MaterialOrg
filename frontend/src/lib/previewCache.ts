// プレビュー用の読み込み結果を URL ごとに覚えておく（同じファイルに何度カーソルを合わせても読み直さない）

const MAX_ENTRIES = 24;
const cache = new Map<string, Promise<unknown>>();

export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) {
    // 最近使ったものを後ろへ（古いものから捨てる）
    cache.delete(key);
    cache.set(key, hit);
    return hit as Promise<T>;
  }
  const promise = load();
  cache.set(key, promise);
  // 失敗した結果は残さず、次に合わせたときに読み直す
  promise.catch(() => cache.delete(key));
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  return promise;
}

async function get(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`読み込めませんでした（${response.status}）`);
  return response;
}

export const fetchText = (url: string) => cached(`text:${url}`, async () => (await get(url)).text());

export const fetchBuffer = (url: string) =>
  cached(`buffer:${url}`, async () => (await get(url)).arrayBuffer());
