import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'パスワードの再設定 | MaterialOrganization',
};

// メールのリンク（/reset-password?token=…）から開く。token は画面側で読むため Suspense で包む
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="flex min-h-dvh items-center justify-center text-sm text-muted">
          読み込んでいます…
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
