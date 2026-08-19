import { v4 as uuidv4 } from "uuid";
import { COLLECTIONS, getDocumentStore } from "../store";
import type { FaqItem } from "./types";

export type { FaqItem } from "./types";

const DEFAULT_FAQS: Array<Pick<FaqItem, "question" | "answer" | "sortOrder">> = [
  {
    question: "Scorm Pro hỗ trợ định dạng nào?",
    answer:
      "Upload file .pptx hoặc .pdf. Hệ thống tách slide, ảnh và ghi chú để bạn chỉnh sửa trước khi xuất SCORM.",
    sortOrder: 1,
  },
  {
    question: "Xuất được SCORM phiên bản nào?",
    answer:
      "Hỗ trợ SCORM 1.2 và SCORM 2004 — phù hợp hầu hết LMS doanh nghiệp và trường học.",
    sortOrder: 2,
  },
  {
    question: "Giọng đọc AI hoạt động thế nào?",
    answer:
      "Bạn viết hoặc chỉnh kịch bản cho từng slide, chọn giọng, rồi tạo audio. Audio gắn vào bài giảng khi xuất SCORM.",
    sortOrder: 3,
  },
  {
    question: "Có cần đăng nhập ngay khi upload không?",
    answer:
      "Có thể bắt đầu upload và mở editor trước. Đăng nhập khi muốn lưu dài hạn vào tài khoản và quản lý nhiều trình chiếu.",
    sortOrder: 4,
  },
  {
    question: "Làm sao nâng cấp gói?",
    answer:
      "Vào Tài khoản → Gói đăng ký sau khi đăng nhập, hoặc chọn gói tại mục Bảng giá trên trang này.",
    sortOrder: 5,
  },
];

function normalize(row: FaqItem): FaqItem {
  return {
    id: row.id,
    question: row.question?.trim() || "Câu hỏi",
    answer: row.answer?.trim() || "",
    active: row.active !== false,
    sortOrder: Math.floor(row.sortOrder || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function seedDefaults(): Promise<FaqItem[]> {
  const store = await getDocumentStore();
  const now = new Date().toISOString();
  const seeded = DEFAULT_FAQS.map((item) =>
    normalize({
      id: uuidv4(),
      question: item.question,
      answer: item.answer,
      active: true,
      sortOrder: item.sortOrder,
      createdAt: now,
      updatedAt: now,
    }),
  );
  await store.putMany(COLLECTIONS.faqs, seeded);
  return seeded;
}

export async function listFaqs(): Promise<FaqItem[]> {
  const store = await getDocumentStore();
  let rows = await store.list<FaqItem>(COLLECTIONS.faqs);
  if (rows.length === 0) {
    rows = await seedDefaults();
  }
  return rows
    .map(normalize)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

export async function listActiveFaqs(): Promise<FaqItem[]> {
  return (await listFaqs()).filter((f) => f.active);
}

export async function createFaq(input: {
  question: string;
  answer: string;
  active?: boolean;
  sortOrder?: number;
}): Promise<FaqItem> {
  const store = await getDocumentStore();
  const existing = await listFaqs();
  const now = new Date().toISOString();
  const item = normalize({
    id: uuidv4(),
    question: input.question,
    answer: input.answer,
    active: input.active !== false,
    sortOrder:
      input.sortOrder != null
        ? input.sortOrder
        : existing.reduce((max, f) => Math.max(max, f.sortOrder), 0) + 1,
    createdAt: now,
    updatedAt: now,
  });
  await store.put(COLLECTIONS.faqs, item);
  return item;
}

export async function updateFaq(
  id: string,
  patch: Partial<{
    question: string;
    answer: string;
    active: boolean;
    sortOrder: number;
  }>,
): Promise<FaqItem> {
  const store = await getDocumentStore();
  const cur = await store.get<FaqItem>(COLLECTIONS.faqs, id);
  if (!cur) throw new Error("Không tìm thấy câu hỏi.");
  const next = normalize({
    ...cur,
    question: typeof patch.question === "string" ? patch.question : cur.question,
    answer: typeof patch.answer === "string" ? patch.answer : cur.answer,
    active: patch.active != null ? patch.active : cur.active,
    sortOrder: patch.sortOrder != null ? patch.sortOrder : cur.sortOrder,
    updatedAt: new Date().toISOString(),
  });
  await store.put(COLLECTIONS.faqs, next);
  return next;
}

export async function deleteFaq(id: string): Promise<boolean> {
  const store = await getDocumentStore();
  return store.delete(COLLECTIONS.faqs, id);
}
