import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

/** Designed for Vietnamese diacritics — avoids mixed fallback fonts. */
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="vi" className={`${beVietnam.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
