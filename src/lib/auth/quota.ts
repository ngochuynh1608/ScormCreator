import { NextResponse } from "next/server";
import { listProjects } from "../db";
import { findUserById } from "./users";
import { resolvePlanForUser } from "./plans";

export class PresentationLimitError extends Error {
  used: number;
  limit: number;

  constructor(used: number, limit: number) {
    super(
      `Gói hiện tại cho phép tối đa ${limit.toLocaleString("vi-VN")} trình chiếu. Nâng cấp gói để tạo thêm.`,
    );
    this.name = "PresentationLimitError";
    this.used = used;
    this.limit = limit;
  }
}

export async function assertCanCreatePresentation(userId: string) {
  const user = await findUserById(userId);
  const plan = await resolvePlanForUser(user?.planId, {
    expiresAt: user?.planExpiresAt,
    userId: user?.id,
  });
  const used = (await listProjects(userId)).length;
  const limit = plan.maxPresentations;
  if (used >= limit) {
    throw new PresentationLimitError(used, limit);
  }
}

export function presentationLimitResponse(err: unknown) {
  if (!(err instanceof PresentationLimitError)) return null;
  return NextResponse.json(
    {
      error: err.message,
      used: err.used,
      limit: err.limit,
      upgradeUrl: "/account/subscription",
    },
    { status: 403 },
  );
}
