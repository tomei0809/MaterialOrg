import type { Metadata } from "next";
import { BIZ_UDPGothic } from "next/font/google";
import { preferencesInitScript } from "@/lib/preferences";
import "./globals.css";

// UD書体（モリサワ）。日本語の文字は必要な分だけ読み込まれるため、先読みはしない
const uiFont = BIZ_UDPGothic({
  variable: "--font-ui",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "MaterialOrganization",
  description: "講義スライド・課題・過去問などの教材を登録・管理するアプリ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme などは描画前のスクリプトで付与するため、サーバー出力との差分は許容する
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${uiFont.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferencesInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
