// API 呼び出しの共通の入口。ログインが切れていたら（401）画面全体に知らせて、ログイン画面へ戻す
export const UNAUTHORIZED_EVENT = 'mateorg:unauthorized';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  return response;
}
