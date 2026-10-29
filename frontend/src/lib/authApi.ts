// ログイン・新規登録・パスワードの API（Rails の /api/v1/session・users・passwords）。
// ログイン状態は Rails が httpOnly の Cookie で持つので、画面側ではトークンを扱わない

export type CurrentUser = { id: number; email_address: string };

const SESSION_URL = '/api/v1/session';
const USERS_URL = '/api/v1/users';
const PASSWORDS_URL = '/api/v1/passwords';

function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// Rails の { errors: [...] } を優先してメッセージにする
async function parse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errors = (data as { errors?: string[] }).errors;
    throw new Error(errors?.join('\n') || fallback);
  }
  return data as T;
}

// ログイン中の利用者（ログインしていなければ null）
export async function fetchSession(): Promise<CurrentUser | null> {
  const response = await fetch(SESSION_URL, { cache: 'no-store' });
  if (response.status === 401) return null;
  return parse<CurrentUser>(response, 'ログイン状態を確認できませんでした。');
}

export async function login(emailAddress: string, password: string) {
  const response = await fetch(SESSION_URL, jsonRequest('POST', { email_address: emailAddress, password }));
  return parse<CurrentUser>(response, 'ログインできませんでした。');
}

export async function logout() {
  await fetch(SESSION_URL, { method: 'DELETE' });
}

export async function signup(emailAddress: string, password: string, passwordConfirmation: string) {
  const response = await fetch(
    USERS_URL,
    jsonRequest('POST', {
      email_address: emailAddress,
      password,
      password_confirmation: passwordConfirmation,
    }),
  );
  return parse<CurrentUser>(response, '登録できませんでした。');
}

export async function changePassword(current: string, password: string, confirmation: string) {
  const response = await fetch(
    `${USERS_URL}/me/password`,
    jsonRequest('PATCH', {
      current_password: current,
      password,
      password_confirmation: confirmation,
    }),
  );
  if (!response.ok) await parse(response, 'パスワードを変更できませんでした。');
}

// 再設定のメールを送る（登録の有無にかかわらず同じ応答）
export async function requestPasswordReset(emailAddress: string) {
  const response = await fetch(PASSWORDS_URL, jsonRequest('POST', { email_address: emailAddress }));
  return parse<{ message: string }>(response, 'メールを送れませんでした。');
}

export async function resetPassword(token: string, password: string, confirmation: string) {
  const response = await fetch(
    `${PASSWORDS_URL}/${encodeURIComponent(token)}`,
    jsonRequest('PATCH', { password, password_confirmation: confirmation }),
  );
  if (!response.ok) await parse(response, 'パスワードを再設定できませんでした。');
}

// パスワードの最短の長さ（backend の User::MIN_PASSWORD_LENGTH とそろえる）
export const MIN_PASSWORD_LENGTH = 8;
