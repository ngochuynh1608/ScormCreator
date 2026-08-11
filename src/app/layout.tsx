import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "ScormCreator — PPTX thành bài giảng SCORM",
  description:
    "Chuyển PowerPoint thành bài học SCORM có giọng đọc AI và câu hỏi tương tác.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${manrope.variable} ${sora.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
