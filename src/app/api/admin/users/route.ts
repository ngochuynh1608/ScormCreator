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

import { getCreditSnapshots } from "@/lib/credits/wallet";
import { addExtraStorageMb } from "@/lib/auth/usage";
import { getStorageSnapshot, getStorageSnapshots } from "@/lib/auth/quota";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  // End users only — system admins are managed under /admin/accounts.
  const users = (await listUsers())
    .map(toPublicUser)
    .filter((u) => u.role !== "admin");
  const credits = await getCreditSnapshots(users.map((u) => u.id));
  const storage = await getStorageSnapshots(users);
  return NextResponse.json({ users, credits, storage });
}

function parsePlanExpiresAt(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) {
    throw new Error("Ngày hết hạn không hợp lệ.");
  }
  return new Date(ts).toISOString();
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(6).max(100),
  role: z.enum(["user", "admin"]).optional(),
  planId: z.string().nullable().optional(),
  planExpiresAt: z.string().nullable().optional(),
  locked: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = createSchema.parse(await req.json());
    if (body.role === "admin") {
      return NextResponse.json(
        {
          error:
            "Tài khoản quản trị tạo tại mục Tài khoản, không tạo từ Người dùng.",
        },
        { status: 400 },
      );
    }
    const passwordHash = await hashPassword(body.password);
    const user = await createUser({
      name: body.name,
      email: body.email,
      passwordHash,
      role: "user",
      planId: body.planId,
      planExpiresAt: parsePlanExpiresAt(body.planExpiresAt) ?? null,
      locked: body.locked || false,
    });
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tạo user thất bại" },
      { status: 500 },
    );
  }
}

const patchSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().optional(),
  role: z.enum(["user", "admin"]).optional(),
  locked: z.boolean().optional(),
  planId: z.string().nullable().optional(),
  planExpiresAt: z.string().nullable().optional(),
  password: z.string().min(6).max(100).optional(),
  grantStorageMb: z.number().int().min(1).max(1_000_000).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = patchSchema.parse(await req.json());
    if (body.role === "admin") {
      return NextResponse.json(
        {
          error:
            "Không nâng quyền admin tại đây. Dùng mục Tài khoản để quản lý quản trị viên.",
        },
        { status: 400 },
      );
    }
    const existing = await findUserById(body.userId);
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy user." }, { status: 404 });
    }
    if (resolveUserRole(existing) === "admin") {
      return NextResponse.json(
        {
          error:
            "Tài khoản quản trị không chỉnh trong Người dùng. Mở mục Tài khoản.",
        },
        { status: 400 },
      );
    }
    if (body.grantStorageMb) {
      await addExtraStorageMb(body.userId, body.grantStorageMb);
      const storage = await getStorageSnapshot(body.userId);
      return NextResponse.json({
        user: toPublicUser(existing),
        storage,
      });
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
      role: body.role === "user" ? "user" : undefined,
      locked: body.locked,
      planId: body.planId,
      planExpiresAt: parsePlanExpiresAt(body.planExpiresAt),
      passwordHash,
    });
    return NextResponse.json({ user: toPublicUser(user) });
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
    if (!target) {
      return NextResponse.json({ error: "Không tìm thấy user." }, { status: 404 });
    }
    if (resolveUserRole(target) === "admin") {
      return NextResponse.json(
        {
          error:
            "Tài khoản quản trị xóa tại mục Tài khoản, không xóa từ Người dùng.",
        },
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
