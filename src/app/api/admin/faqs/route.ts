import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import {
  createFaq,
  deleteFaq,
  listFaqs,
  updateFaq,
} from "@/lib/faq";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const faqs = await listFaqs();
  return NextResponse.json({ faqs });
}

const createSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(4000),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = createSchema.parse(await req.json());
    const faq = await createFaq(body);
    return NextResponse.json({ faq });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tạo FAQ thất bại" },
      { status: 500 },
    );
  }
}

const patchSchema = createSchema.partial().extend({
  id: z.string().min(1),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = patchSchema.parse(await req.json());
    const { id, ...patch } = body;
    const faq = await updateFaq(id, patch);
    return NextResponse.json({ faq });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cập nhật FAQ thất bại" },
      { status: 500 },
    );
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = deleteSchema.parse(await req.json());
    const ok = await deleteFaq(body.id);
    if (!ok) {
      return NextResponse.json({ error: "Không tìm thấy câu hỏi." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Xóa FAQ thất bại" },
      { status: 500 },
    );
  }
}
