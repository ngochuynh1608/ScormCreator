import { execFile } from "child_process";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { promisify } from "util";
import { projectThumbDir } from "../storage";
import { collectPngThumbs } from "./render";

const execFileAsync = promisify(execFile);

let libreOfficeQueue = Promise.resolve();

function candidateLibreOfficeBins(): string[] {
  const fromEnv = process.env.LIBREOFFICE_PATH?.trim();
  const which = process.env.PATH
    ? process.env.PATH.split(path.delimiter).flatMap((dir) => [
        path.join(dir, "soffice.com"),
        path.join(dir, "soffice.exe"),
        path.join(dir, "soffice"),
        path.join(dir, "libreoffice"),
      ])
    : [];

  const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";
  const programFilesX86 =
    process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";

  return [
    ...(fromEnv ? [fromEnv] : []),
    path.join(programFiles, "LibreOffice", "program", "soffice.com"),
    path.join(programFiles, "LibreOffice", "program", "soffice.exe"),
    path.join(programFilesX86, "LibreOffice", "program", "soffice.com"),
    path.join(programFilesX86, "LibreOffice", "program", "soffice.exe"),
    "C:\\Program Files\\LibreOffice\\program\\soffice.com",
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    ...which,
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/usr/local/bin/soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  ];
}

export function findLibreOfficeBinary(): string | null {
  for (const candidate of candidateLibreOfficeBins()) {
    try {
      if (candidate && existsSync(candidate)) return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

function fileUrlForUserInstallation(absDir: string) {
  const normalized = path.resolve(absDir).replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }
  return `file://${normalized}`;
}

/** Convert PPTX → PDF → PNG pages using LibreOffice + MuPDF. */
export async function renderSlidesWithLibreOffice(
  projectId: string,
  pptxAbsolutePath: string,
  expectedSlideCount?: number,
): Promise<string[]> {
  const run = libreOfficeQueue.then(() =>
    renderSlidesWithLibreOfficeUnsafe(
      projectId,
      pptxAbsolutePath,
      expectedSlideCount,
    ),
  );
  libreOfficeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function renderSlidesWithLibreOfficeUnsafe(
  projectId: string,
  pptxAbsolutePath: string,
  expectedSlideCount?: number,
): Promise<string[]> {
  const soffice = findLibreOfficeBinary();
  if (!soffice) {
    throw new Error(
      "Không tìm thấy LibreOffice. Linux: sudo apt install libreoffice — hoặc đặt LIBREOFFICE_PATH trỏ tới soffice.",
    );
  }

  const outDir = projectThumbDir(projectId);
  await fs.mkdir(outDir, { recursive: true });
  const workDir = path.join(outDir, "_lo_work");
  const profileDir = path.join(workDir, "profile");
  await fs.mkdir(profileDir, { recursive: true });

  const timeout = Math.max(
    10 * 60 * 1000,
    (expectedSlideCount || 30) * 20_000,
  );

  const pptxAbs = path.resolve(pptxAbsolutePath);
  const workAbs = path.resolve(workDir);
  const profileAbs = path.resolve(profileDir);

  try {
    let convertError: unknown = null;
    try {
      // LibreOffice 7+/26 expects single-dash bootstrap vars: -env:UserInstallation=...
      await execFileAsync(
        soffice,
        [
          "--headless",
          "--nologo",
          "--norestore",
          "--nofirststartwizard",
          `-env:UserInstallation=${fileUrlForUserInstallation(profileAbs)}`,
          "--convert-to",
          "pdf",
          "--outdir",
          workAbs,
          pptxAbs,
        ],
        {
          windowsHide: true,
          timeout,
          maxBuffer: 20 * 1024 * 1024,
        },
      );
    } catch (err) {
      convertError = err;
    }

    const pdfPath = await findConvertedPdf(workAbs, pptxAbs);
    if (!pdfPath) {
      throw new Error(
        `LibreOffice không chuyển được PPTX sang PDF: ${
          convertError instanceof Error
            ? convertError.message
            : String(convertError || "không thấy file PDF")
        }`,
      );
    }
    if (convertError) {
      console.warn(
        "[pptx-render] LibreOffice convert reported an error but PDF exists; continuing.",
        convertError instanceof Error ? convertError.message : convertError,
      );
    }

    await renderPdfPagesToPng(pdfPath, outDir);
    const thumbs = await collectPngThumbs(outDir);
    if (thumbs.filter(Boolean).length === 0) {
      throw new Error("Không tạo được PNG từ PDF LibreOffice.");
    }
    return thumbs;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function findConvertedPdf(
  workDir: string,
  pptxAbsolutePath: string,
): Promise<string | null> {
  const base = path.basename(pptxAbsolutePath, path.extname(pptxAbsolutePath));
  const expected = path.join(workDir, `${base}.pdf`);
  try {
    await fs.access(expected);
    return expected;
  } catch {
    // fall through
  }

  let entries: string[] = [];
  try {
    entries = await fs.readdir(workDir);
  } catch {
    return null;
  }
  const pdf = entries.find((n) => n.toLowerCase().endsWith(".pdf"));
  return pdf ? path.join(workDir, pdf) : null;
}

async function renderPdfPagesToPng(pdfPath: string, outDir: string) {
  const mupdf = await import("mupdf");
  const data = await fs.readFile(pdfPath);
  const doc = mupdf.Document.openDocument(data, "application/pdf");
  const pageCount = doc.countPages();
  // ~144 DPI — good balance for editor thumbs / SCORM player
  const scale = 144 / 72;

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const pixmap = page.toPixmap(
      [scale, 0, 0, scale, 0, 0],
      mupdf.ColorSpace.DeviceRGB,
      false,
      true,
    );
    const png = Buffer.from(pixmap.asPNG());
    await fs.writeFile(path.join(outDir, `slide-${i + 1}.png`), png);
  }
}
