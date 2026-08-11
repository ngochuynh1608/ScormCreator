import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { ContentSlide } from "../types";
import { ensureProjectDirs, projectThumbDir } from "../storage";

/** Render each PDF page to PNG thumbs and build content slides. */
export async function parsePdfToSlides(
  projectId: string,
  pdfBuffer: Buffer,
): Promise<ContentSlide[]> {
  await ensureProjectDirs(projectId);
  const thumbDir = projectThumbDir(projectId);
  await fs.mkdir(thumbDir, { recursive: true });

  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
  const pageCount = doc.countPages();
  if (pageCount <= 0) {
    throw new Error("PDF không có trang nào.");
  }

  const scale = 144 / 72;
  const slides: ContentSlide[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const pixmap = page.toPixmap(
      [scale, 0, 0, scale, 0, 0],
      mupdf.ColorSpace.DeviceRGB,
      false,
      true,
    );
    const png = Buffer.from(pixmap.asPNG());
    const thumbName = `slide-${i + 1}.png`;
    await fs.writeFile(path.join(thumbDir, thumbName), png);

    slides.push({
      id: uuidv4(),
      type: "content",
      order: i,
      title: `Slide ${i + 1}`,
      bodyText: "",
      notes: "",
      narrationScript: "",
      audioPath: null,
      audioDurationMs: null,
      hidden: false,
      thumbnailPath: `thumbs/${thumbName}`,
      mediaFiles: [],
    });
  }

  return slides;
}
