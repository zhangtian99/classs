import "./globals.css";

export const metadata = {
  title: "积分管理系统 - 老师端",
  description: "专业高效的积分管理平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}