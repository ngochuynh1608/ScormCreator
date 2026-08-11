import type { AuthUser, SessionPayload } from "./types";
import { resolveUserRole, syncAdminRoleFromEnv } from "./users";

export async function sessionPayloadFromUser(
  user: AuthUser,
): Promise<SessionPayload> {
  const synced = await syncAdminRoleFromEnv(user);
  return {
    userId: synced.id,
    email: synced.email,
    name: synced.name,
    role: resolveUserRole(synced),
  };
}
