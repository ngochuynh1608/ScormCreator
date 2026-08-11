import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import type { Project, ScormVersion } from "../types";
import { projectDir } from "../storage";
import { buildManifest, serializeCourseJson } from "./manifest";
import { getProjectScormSettings } from "./settings";
import {
  PLAYER_CSS,
  PLAYER_JS,
  SCORM_API_JS,
  buildPlayerHtml,
} from "./player";

async function fileExists(absPath: string) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

function isPrecompressed(filePath: string) {
  return /\.(png|jpe?g|gif|webp|mp3|mp4|webm|mov|wav|ogg)$/i.test(filePath);
}

/**
 * Package SCORM zip from existing project assets only.
 * Does not call TTS during export (avoids multi-minute hangs).
 */
export async function packageScormZip(
  project: Project,
  version: ScormVersion,
): Promise<string> {
  const outDir = path.join(projectDir(project.id), "exports");
  await fs.mkdir(outDir, { recursive: true });
  const fileName = `${slugify(project.title)}_${version}.zip`;
  const outPath = path.join(outDir, fileName);

  const root = projectDir(project.id);
  const settings = getProjectScormSettings(project);
  const courseJson = serializeCourseJson(project, version);

  const zip = new JSZip();
  const packagedFiles = new Set<string>([
    "index.html",
    "player.js",
    "player.css",
    "scorm-api.js",
    "course.json",
    "course-data.js",
  ]);

  zip.file("index.html", buildPlayerHtml(courseJson));
  zip.file("player.js", PLAYER_JS);
  zip.file("player.css", PLAYER_CSS);
  zip.file("scorm-api.js", SCORM_API_JS);
  zip.file("course.json", courseJson);
  zip.file("course-data.js", `window.__COURSE__ = ${courseJson};`);
  zip.file(
    "HUONG-DAN.txt",
    [
      "HUONG DAN MO GOI SCORM",
      "======================",
      "",
      "1) Giai nen TOAN BO file ZIP ra mot thu muc (khong mo index.html ben trong ZIP).",
      "2) Mo file index.html bang trinh duyet, HOAC upload ca thu muc/ZIP len LMS.",
      "3) Can co cac thu muc/file: index.html, thumbs/, audio/, media/ (neu co) nam cung cap.",
      "",
      "Neu thay thong bao khong tai duoc anh slide: thuong la dang mo file trong ZIP",
      "chua giai nen, hoac thieu thu muc thumbs/.",
      "",
    ].join("\r\n"),
  );
  packagedFiles.add("HUONG-DAN.txt");

  for (const slide of project.slides) {
    if (slide.type !== "content" || slide.hidden || slide.blank) continue;

    const candidates = [
      slide.thumbnailPath,
      slide.audioPath,
      slide.videoPath,
      ...(slide.mediaFiles || []).map((m) => `media/${m}`),
    ].filter(Boolean) as string[];

    for (const relRaw of candidates) {
      const rel = relRaw.replace(/\\/g, "/");
      if (packagedFiles.has(rel)) continue;
      const abs = path.join(root, relRaw);
      if (!(await fileExists(abs))) continue;
      const data = await fs.readFile(abs);
      zip.file(rel, data, {
        compression: isPrecompressed(rel) ? "STORE" : "DEFLATE",
      });
      packagedFiles.add(rel);
    }
  }

  zip.file(
    "imsmanifest.xml",
    buildManifest(project.title, version, [...packagedFiles], settings.passScore),
  );

  const buf = await zip.generateAsync({
    type: "nodebuffer",
    streamFiles: true,
    compression: "DEFLATE",
    compressionOptions: { level: 1 },
  });
  await fs.writeFile(outPath, buf);
  return outPath;
}

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "course"
  );
}
