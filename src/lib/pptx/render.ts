import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { projectDir, projectThumbDir } from "../storage";

const execFileAsync = promisify(execFile);

let rendering = Promise.resolve();

/**
 * Cross-platform PNG slide render:
 * 1) LibreOffice headless (Windows / Linux / macOS) — primary
 * 2) Windows fallback: WPS Presentation / Microsoft PowerPoint COM
 * Callers may fall back to SVG text thumbs if this throws.
 */
export async function renderSlidesAsImages(
  projectId: string,
  pptxAbsolutePath?: string,
  expectedSlideCount?: number,
): Promise<string[]> {
  const pptxPath =
    pptxAbsolutePath || path.join(projectDir(projectId), "original.pptx");
  const errors: string[] = [];

  try {
    const { renderSlidesWithLibreOffice } = await import("./libreoffice");
    const thumbs = await renderSlidesWithLibreOffice(
      projectId,
      pptxPath,
      expectedSlideCount,
    );
    if (thumbs.filter(Boolean).length > 0) return thumbs;
    errors.push("LibreOffice không tạo được PNG.");
  } catch (err) {
    errors.push(
      err instanceof Error ? err.message : "LibreOffice render thất bại",
    );
    console.warn("[pptx-render] LibreOffice:", errors[errors.length - 1]);
  }

  if (process.platform === "win32") {
    try {
      const thumbs = await renderSlidesWithPowerPoint(
        projectId,
        pptxPath,
        expectedSlideCount,
      );
      if (thumbs.filter(Boolean).length > 0) return thumbs;
      errors.push("WPS/PowerPoint không tạo được PNG.");
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : "WPS/PowerPoint render thất bại",
      );
      console.warn("[pptx-render] COM:", errors[errors.length - 1]);
    }
  }

  throw new Error(
    errors.join(" | ") ||
      "Không render được ảnh slide. Cài LibreOffice (hoặc đặt LIBREOFFICE_PATH) / WPS-PowerPoint trên Windows.",
  );
}

/** Scan thumbs dir for slide-N.png and return relative paths sorted by index. */
export async function collectPngThumbs(outDir: string): Promise<string[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(outDir);
  } catch {
    return [];
  }

  const byIndex = new Map<number, string>();
  for (const name of entries) {
    const m = /^slide-(\d+)\.png$/i.exec(name);
    if (!m) continue;
    const index = Number(m[1]);
    if (!index) continue;
    byIndex.set(index, `thumbs/${name}`);
  }

  if (byIndex.size === 0) return [];

  const max = Math.max(...byIndex.keys());
  const paths: string[] = [];
  for (let i = 1; i <= max; i++) {
    const rel = byIndex.get(i);
    if (rel) paths[i - 1] = rel;
  }
  return paths;
}

/**
 * Renders each PPTX slide to PNG via WPS (`KWPP.Application`) or PowerPoint COM.
 * Serialized because desktop office automation is not concurrency-safe.
 */
export async function renderSlidesWithPowerPoint(
  projectId: string,
  pptxAbsolutePath?: string,
  expectedSlideCount?: number,
): Promise<string[]> {
  const run = rendering.then(() =>
    renderSlidesWithPowerPointUnsafe(
      projectId,
      pptxAbsolutePath,
      expectedSlideCount,
    ),
  );
  rendering = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function renderSlidesWithPowerPointUnsafe(
  projectId: string,
  pptxAbsolutePath?: string,
  expectedSlideCount?: number,
): Promise<string[]> {
  const pptxPath =
    pptxAbsolutePath || path.join(projectDir(projectId), "original.pptx");
  const outDir = projectThumbDir(projectId);
  await fs.mkdir(outDir, { recursive: true });

  const scriptPath = path.join(
    process.cwd(),
    "scripts",
    "render-slides-powerpoint.ps1",
  );

  // Large decks (50–80+ slides) need a long budget; still salvage partial PNGs on timeout.
  const perSlideMs = 45_000;
  const timeout = Math.max(
    20 * 60 * 1000,
    (expectedSlideCount || 30) * perSlideMs,
  );

  try {
    const { stdout, stderr } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-PptxPath",
        pptxPath,
        "-OutDir",
        outDir,
        "-Width",
        "1920",
        "-Height",
        "1080",
      ],
      {
        windowsHide: true,
        timeout,
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    if (stderr?.trim()) {
      console.warn("[pptx-render]", stderr.trim());
    }
    if (stdout?.trim()) {
      console.log(
        "[pptx-render] stdout lines:",
        stdout.split(/\r?\n/).filter(Boolean).length,
      );
    }
  } catch (err) {
    const partial = await collectPngThumbs(outDir);
    if (partial.filter(Boolean).length > 0) {
      console.warn(
        "[pptx-render] interrupted; using partial PNGs:",
        partial.filter(Boolean).length,
        err instanceof Error ? err.message : err,
      );
      return partial;
    }
    const message =
      err instanceof Error ? err.message : "Render slide bằng PowerPoint thất bại";
    throw new Error(message);
  }

  const present = await collectPngThumbs(outDir);
  if (present.filter(Boolean).length === 0) {
    throw new Error(
      "WPS/PowerPoint không xuất được ảnh slide. Cài xong WPS Office (có Presentation/wpp.exe) hoặc Microsoft PowerPoint, mở WPS một lần rồi thử lại.",
    );
  }
  return present;
}
