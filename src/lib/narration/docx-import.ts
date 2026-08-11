import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export type NarrationImportRow = {
  slideNumber: number;
  content: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: false,
});

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Collect visible text from a Word OOXML node, preserving paragraph breaks. */
function collectCellText(node: unknown): string {
  if (node == null || typeof node !== "object") return "";
  const obj = node as Record<string, unknown>;

  const paragraphs = asArray(obj.p);
  if (paragraphs.length > 0) {
    return paragraphs
      .map((p) => collectRuns(p))
      .filter((line) => line.length > 0)
      .join("\n")
      .trim();
  }

  return collectRuns(obj).trim();
}

function collectRuns(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(collectRuns).join("");
  }
  if (typeof node !== "object") return "";

  const obj = node as Record<string, unknown>;
  let out = "";

  // Soft line break
  if ("br" in obj) out += "\n";
  // Explicit tab
  if ("tab" in obj) out += "\t";

  if ("t" in obj) {
    const t = obj.t;
    if (typeof t === "string" || typeof t === "number") out += String(t);
    else if (t && typeof t === "object" && "#text" in (t as object)) {
      out += String((t as { "#text": unknown })["#text"] ?? "");
    } else if (Array.isArray(t)) {
      out += t.map((x) => collectRuns(x)).join("");
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key === "t" || key === "br" || key === "tab" || key.startsWith("@_")) {
      continue;
    }
    out += collectRuns(value);
  }
  return out;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSlideHeader(value: string) {
  const n = normalizeHeader(value);
  return n === "slide" || n === "slides" || n === "stt" || n === "so slide";
}

function isContentHeader(value: string) {
  const n = normalizeHeader(value);
  return (
    n === "noi dung" ||
    n === "content" ||
    n === "loi thoai" ||
    n === "kich ban" ||
    n === "script" ||
    n === "narration" ||
    n.includes("noi dung") ||
    n.includes("loi thoai")
  );
}

function parseSlideNumber(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const match = text.match(/(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractTables(documentXml: string): string[][][] {
  const parsed = parser.parse(documentXml);
  const body = parsed?.document?.body;
  if (!body) return [];

  const tables = asArray(body.tbl);
  const result: string[][][] = [];

  for (const table of tables) {
    const rows = asArray((table as { tr?: unknown }).tr);
    const grid: string[][] = [];
    for (const row of rows) {
      const cells = asArray((row as { tc?: unknown }).tc);
      grid.push(cells.map((cell) => collectCellText(cell)));
    }
    if (grid.length > 0) result.push(grid);
  }
  return result;
}

function rowsFromTable(grid: string[][]): NarrationImportRow[] {
  if (grid.length === 0) return [];

  let start = 0;
  let slideCol = 0;
  let contentCol = 1;

  const header = grid[0].map((c) => c.trim());
  const slideIdx = header.findIndex(isSlideHeader);
  const contentIdx = header.findIndex(isContentHeader);

  if (slideIdx >= 0 && contentIdx >= 0) {
    start = 1;
    slideCol = slideIdx;
    contentCol = contentIdx;
  } else if (header.length >= 2 && parseSlideNumber(header[0]) == null) {
    // First row looks like a header but unknown labels — skip it.
    start = 1;
  }

  const rows: NarrationImportRow[] = [];
  for (let i = start; i < grid.length; i++) {
    const cells = grid[i];
    const slideNumber = parseSlideNumber(cells[slideCol] || "");
    const content = (cells[contentCol] || "").trim();
    if (!slideNumber || !content) continue;
    rows.push({ slideNumber, content });
  }
  return rows;
}

/**
 * Parse a .docx buffer that contains a table:
 * | Slide | Nội dung |
 * | 1     | ...      |
 */
export async function parseNarrationDocx(
  buffer: Buffer,
): Promise<NarrationImportRow[]> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("text");
  if (!documentXml) {
    throw new Error("File DOCX không hợp lệ (thiếu word/document.xml).");
  }

  const tables = extractTables(documentXml);
  if (tables.length === 0) {
    throw new Error(
      "Không tìm thấy bảng trong file. Cần bảng 2 cột: Slide | Nội dung.",
    );
  }

  let best: NarrationImportRow[] = [];
  for (const table of tables) {
    const rows = rowsFromTable(table);
    if (rows.length > best.length) best = rows;
  }

  if (best.length === 0) {
    throw new Error(
      "Không đọc được dòng lời thoại. Kiểm tra cột Slide và Nội dung.",
    );
  }

  // Later duplicate slide numbers win (last write).
  const bySlide = new Map<number, string>();
  for (const row of best) {
    bySlide.set(row.slideNumber, row.content);
  }

  return [...bySlide.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([slideNumber, content]) => ({ slideNumber, content }));
}
