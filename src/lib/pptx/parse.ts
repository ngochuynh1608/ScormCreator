import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { v4 as uuidv4 } from "uuid";
import type { ContentSlide } from "../types";
import {
  ensureProjectDirs,
  projectDir,
  projectMediaDir,
  projectThumbDir,
} from "../storage";
import { collectPngThumbs, renderSlidesAsImages } from "./render";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) =>
    [
      "a:t",
      "p:sldId",
      "Relationship",
      "p:pic",
      "p:sp",
      "p:cxnSp",
      "p:graphicFrame",
    ].includes(name),
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function collectText(node: unknown, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === "string") {
    const t = node.trim();
    if (t) out.push(t);
    return out;
  }
  if (typeof node !== "object") return out;
  const obj = node as Record<string, unknown>;
  if (typeof obj["#text"] === "string") {
    const t = String(obj["#text"]).trim();
    if (t) out.push(t);
  }
  if (obj["a:t"] != null) {
    for (const item of asArray(obj["a:t"])) {
      if (typeof item === "string") {
        const t = item.trim();
        if (t) out.push(t);
      } else if (item && typeof item === "object") {
        collectText(item, out);
      }
    }
  }
  for (const [key, val] of Object.entries(obj)) {
    if (key === "#text" || key.startsWith("@_")) continue;
    collectText(val, out);
  }
  return out;
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const cleaned = line.replace(/\s+/g, " ").trim();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function renderFallbackSvg(
  filePath: string,
  index: number,
  title: string,
  bodyPreview: string,
  imageHref: string | null,
) {
  const safeTitle = escapeXml(title || `Slide ${index + 1}`);
  const safeBody = escapeXml(bodyPreview.slice(0, 220));
  const imageLayer = imageHref
    ? `<image href="${escapeXml(imageHref)}" x="0" y="0" width="960" height="540" preserveAspectRatio="xMidYMid meet" opacity="0.92"/>
  <rect width="960" height="540" fill="rgba(15,42,54,0.35)"/>`
    : `<rect width="960" height="540" fill="url(#bg)"/>
  <circle cx="820" cy="80" r="140" fill="#3DDC97" opacity="0.12"/>
  <circle cx="90" cy="480" r="160" fill="#7CC4E8" opacity="0.10"/>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1B3A4B"/>
      <stop offset="55%" stop-color="#24556A"/>
      <stop offset="100%" stop-color="#0F2A36"/>
    </linearGradient>
  </defs>
  ${imageLayer}
  <text x="48" y="56" fill="#8FD6B8" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="600">SLIDE ${String(index + 1).padStart(2, "0")}</text>
  <foreignObject x="48" y="100" width="864" height="120">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#F4FAF7;font-family:Segoe UI,Arial,sans-serif;font-size:34px;font-weight:700;line-height:1.25;">${safeTitle}</div>
  </foreignObject>
  <foreignObject x="48" y="250" width="864" height="220">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#C9DEE6;font-family:Segoe UI,Arial,sans-serif;font-size:20px;line-height:1.45;">${safeBody}</div>
  </foreignObject>
</svg>`;
  await fs.writeFile(filePath, svg, "utf8");
}

function resolveZipPath(fromSlidePath: string, target: string): string {
  // slide: ppt/slides/slide1.xml → rel target ../media/image1.png
  const baseDir = path.posix.dirname(fromSlidePath);
  const joined = path.posix.normalize(path.posix.join(baseDir, target));
  return joined.replace(/^\/+/, "");
}

async function extractSlideMedia(
  zip: JSZip,
  slidePath: string,
  mediaDir: string,
): Promise<string[]> {
  const slideBase = path.posix.basename(slidePath);
  const relsPath = `ppt/slides/_rels/${slideBase}.rels`;
  const relsXml = await zip.file(relsPath)?.async("text");
  if (!relsXml) return [];

  const relsParsed = parser.parse(relsXml);
  const relationships = asArray(
    relsParsed?.Relationships?.Relationship ||
      relsParsed?.["Relationships"]?.["Relationship"],
  );

  const saved: string[] = [];
  for (const rel of relationships) {
    const type = String(rel["@_Type"] || "");
    const target = String(rel["@_Target"] || "");
    if (!target) continue;
    const isImage =
      type.includes("/image") ||
      /\.(png|jpe?g|gif|bmp|webp|emf|wmf|tiff?)$/i.test(target);
    if (!isImage) continue;

    const mediaZipPath = resolveZipPath(slidePath, target);
    const file = zip.file(mediaZipPath);
    if (!file || file.dir) continue;
    const base = path.basename(mediaZipPath);
    const abs = path.join(mediaDir, base);
    try {
      await fs.access(abs);
    } catch {
      const buf = await file.async("nodebuffer");
      await fs.writeFile(abs, buf);
    }
    if (!saved.includes(base)) saved.push(base);
  }
  return saved;
}

export async function parsePptxToSlides(
  projectId: string,
  pptxBuffer: Buffer,
): Promise<ContentSlide[]> {
  await ensureProjectDirs(projectId);
  const pptxAbs = path.join(projectDir(projectId), "original.pptx");
  // Caller usually already wrote the file; ensure it exists.
  try {
    await fs.access(pptxAbs);
  } catch {
    await fs.writeFile(pptxAbs, pptxBuffer);
  }

  const zip = await JSZip.loadAsync(pptxBuffer);
  const presentationXml = await zip.file("ppt/presentation.xml")?.async("text");
  if (!presentationXml) {
    throw new Error("File PPTX không hợp lệ (thiếu presentation.xml).");
  }

  const presentation = parser.parse(presentationXml);
  const sldIdList =
    presentation?.["p:presentation"]?.["p:sldIdLst"]?.["p:sldId"] || [];
  const slideIds = asArray(sldIdList);

  const relsXml = await zip.file("ppt/_rels/presentation.xml.rels")?.async("text");
  const relsParsed = relsXml ? parser.parse(relsXml) : null;
  const relationships = asArray(
    relsParsed?.Relationships?.Relationship ||
      relsParsed?.["Relationships"]?.["Relationship"],
  );
  const relMap = new Map<string, string>();
  for (const rel of relationships) {
    const id = rel["@_Id"];
    const target = rel["@_Target"];
    if (id && target) relMap.set(id, target);
  }

  const slides: ContentSlide[] = [];
  const mediaDir = projectMediaDir(projectId);
  const thumbDir = projectThumbDir(projectId);

  // PNG thumbs: WPS/PowerPoint COM on Windows, LibreOffice on Linux/macOS
  let renderedThumbs: string[] = [];
  try {
    renderedThumbs = await renderSlidesAsImages(
      projectId,
      pptxAbs,
      slideIds.length,
    );
  } catch (err) {
    console.warn(
      "[pptx] Image render failed, falling back to SVG thumbs:",
      err instanceof Error ? err.message : err,
    );
    renderedThumbs = await collectPngThumbs(thumbDir);
  }

  for (let i = 0; i < slideIds.length; i++) {
    const rid = slideIds[i]["@_r:id"] || slideIds[i]["@_Id"];
    const target = rid ? relMap.get(rid) : null;
    if (!target) continue;
    const slidePath = target.startsWith("/")
      ? target.slice(1)
      : `ppt/${target.replace(/^\.\//, "")}`;
    const normalized = slidePath.replace(/\\/g, "/");
    const slideXml = await zip.file(normalized)?.async("text");
    if (!slideXml) continue;

    const slideParsed = parser.parse(slideXml);
    const texts = uniqueLines(collectText(slideParsed));
    const title = texts[0] || `Slide ${i + 1}`;
    const bodyText = texts.slice(1).join("\n");

    let notes = "";
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${i + 1}.xml`);
    if (notesFile) {
      const notesXml = await notesFile.async("text");
      const notesParsed = parser.parse(notesXml);
      notes = uniqueLines(collectText(notesParsed)).join("\n");
    }

    const slideMedia = await extractSlideMedia(zip, normalized, mediaDir);

    // Always prefer PNG on disk (full visual fidelity) over SVG text fallback
    const pngCandidate = `thumbs/slide-${i + 1}.png`;
    let thumbnailPath: string | null = null;
    if (renderedThumbs[i]) {
      thumbnailPath = renderedThumbs[i];
    } else {
      try {
        await fs.access(path.join(thumbDir, `slide-${i + 1}.png`));
        thumbnailPath = pngCandidate;
      } catch {
        thumbnailPath = null;
      }
    }

    if (!thumbnailPath) {
      const thumbName = `slide-${i + 1}.svg`;
      const imageHref = slideMedia[0] ? `../media/${slideMedia[0]}` : null;
      await renderFallbackSvg(
        path.join(thumbDir, thumbName),
        i,
        title,
        bodyText || notes || "Không có nội dung văn bản.",
        imageHref,
      );
      thumbnailPath = `thumbs/${thumbName}`;
    }

    const narrationSeed = notes || bodyText || title;
    slides.push({
      id: uuidv4(),
      type: "content",
      order: i,
      title,
      bodyText,
      notes,
      narrationScript: narrationSeed,
      audioPath: null,
      audioDurationMs: null,
      hidden: false,
      thumbnailPath,
      mediaFiles: slideMedia,
    });
  }

  if (slides.length === 0) {
    throw new Error("Không tìm thấy slide nào trong file PPTX.");
  }

  return slides;
}
