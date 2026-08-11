import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import {
  attachSessionCookie,
  createSessionToken,
} from "@/lib/auth/session";
import { sessionPayloadFromUser } from "@/lib/auth/session-user";
import { toPublicUser, updateUserProfile } from "@/lib/auth/users";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  try {
    const body = schema.parse(await req.json());
    const user = await updateUserProfile(auth.session.userId, {
      name: body.name,
    });
    const token = await createSessionToken(await sessionPayloadFromUser(user));
    const res = NextResponse.json({ user: toPublicUser(user) });
    return attachSessionCookie(res, token);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Tên không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lưu thất bại" },
      { status: 500 },
    );
  }
}
