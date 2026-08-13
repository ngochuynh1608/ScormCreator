import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import {
  createUser,
  deleteUser,
  findUserById,
  listUsers,
  resolveUserRole,
  toPublicUser,
  updateUser,
} from "@/lib/auth/users";

export const runtime = "nodejs";

async function listAdmins() {
  return (await listUsers())
    .filter((u) => resolveUserRole(u) === "admin")
    .map(toPublicUser);
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const accounts = await listAdmins();
  return NextResponse.json({ accounts });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(6).max(100),
  locked: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = createSchema.parse(await req.json());
    const passwordHash = await hashPassword(body.password);
    const user = await createUser({
      name: body.name,
      email: body.email,
      passwordHash,
      role: "admin",
      planId: null,
      planExpiresAt: null,
      locked: body.locked || false,
    });
    return NextResponse.json({ account: toPublicUser(user) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tạo tài khoản thất bại" },
      { status: 500 },
    );
  }
}

const patchSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().optional(),
  locked: z.boolean().optional(),
  password: z.string().min(6).max(100).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = patchSchema.parse(await req.json());
    const existing = await findUserById(body.userId);
    if (!existing || resolveUserRole(existing) !== "admin") {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản quản trị." },
        { status: 404 },
      );
    }
    if (body.userId === auth.session.userId && body.locked === true) {
      return NextResponse.json(
        { error: "Không thể tự khóa tài khoản của chính bạn." },
        { status: 400 },
      );
    }
    const passwordHash =
      typeof body.password === "string"
        ? await hashPassword(body.password)
        : undefined;
    const user = await updateUser(body.userId, {
      name: body.name,
      email: body.email,
      locked: body.locked,
      passwordHash,
      role: "admin",
    });
    return NextResponse.json({ account: toPublicUser(user) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cập nhật thất bại" },
      { status: 500 },
    );
  }
}

const deleteSchema = z.object({
  userId: z.string().min(1),
});

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = deleteSchema.parse(await req.json());
    if (body.userId === auth.session.userId) {
      return NextResponse.json(
        { error: "Không thể tự xóa tài khoản của chính bạn." },
        { status: 400 },
      );
    }
    const target = await findUserById(body.userId);
    if (!target || resolveUserRole(target) !== "admin") {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản quản trị." },
        { status: 404 },
      );
    }
    const admins = await listAdmins();
    if (admins.length <= 1) {
      return NextResponse.json(
        { error: "Không thể xóa admin cuối cùng." },
        { status: 400 },
      );
    }
    await deleteUser(body.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Xóa thất bại" },
      { status: 500 },
    );
  }
}
