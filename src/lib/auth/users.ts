import { v4 as uuidv4 } from "uuid";
import { COLLECTIONS, getDocumentStore } from "../store";
import type { AuthUser, PublicUser, UserRole } from "./types";

export function adminEmailsFromEnv(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveUserRole(user: AuthUser): UserRole {
  if (user.role === "admin") return "admin";
  if (adminEmailsFromEnv().includes(user.email.trim().toLowerCase())) {
    return "admin";
  }
  return "user";
}

function normalizeUser(row: AuthUser): AuthUser {
  return {
    ...row,
    passwordHash: row.passwordHash ?? null,
    googleId: row.googleId ?? null,
    locked: Boolean(row.locked),
    planId: row.planId ?? null,
    planExpiresAt: row.planExpiresAt ?? null,
    role: row.role === "admin" ? "admin" : "user",
  };
}

export async function listUsers(): Promise<AuthUser[]> {
  const store = await getDocumentStore();
  const rows = await store.list<AuthUser>(COLLECTIONS.users);
  return rows.map(normalizeUser);
}

export function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: resolveUserRole(user),
    locked: Boolean(user.locked),
    planId: user.planId || null,
    planExpiresAt: user.planExpiresAt || null,
    createdAt: user.createdAt,
  };
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const normalized = email.trim().toLowerCase();
  const users = await listUsers();
  return users.find((u) => u.email === normalized) || null;
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const store = await getDocumentStore();
  const row = await store.get<AuthUser>(COLLECTIONS.users, id);
  return row ? normalizeUser(row) : null;
}

export async function findUserByGoogleId(
  googleId: string,
): Promise<AuthUser | null> {
  const users = await listUsers();
  return users.find((u) => u.googleId === googleId) || null;
}

/** Persist ADMIN_EMAILS → role=admin when missing / stale. */
export async function syncAdminRoleFromEnv(user: AuthUser): Promise<AuthUser> {
  const emails = adminEmailsFromEnv();
  if (!emails.includes(user.email.trim().toLowerCase())) return user;
  if (user.role === "admin") return user;
  return updateUser(user.id, { role: "admin" });
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash?: string | null;
  googleId?: string | null;
  role?: UserRole;
  locked?: boolean;
  planId?: string | null;
}): Promise<AuthUser> {
  const store = await getDocumentStore();
  const email = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("Email đã được sử dụng.");
  }
  const role: UserRole =
    input.role ||
    (adminEmailsFromEnv().includes(email) ? "admin" : "user");
  const user: AuthUser = {
    id: uuidv4(),
    email,
    name: input.name.trim() || email.split("@")[0],
    passwordHash: input.passwordHash ?? null,
    googleId: input.googleId ?? null,
    createdAt: new Date().toISOString(),
    role,
    locked: Boolean(input.locked),
    planId: input.planId ?? null,
    planExpiresAt: null,
  };
  await store.put(COLLECTIONS.users, user);
  return user;
}

export async function linkGoogleId(userId: string, googleId: string) {
  return updateUser(userId, { googleId });
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<AuthUser> {
  return updateUser(userId, { role });
}

export async function updateUser(
  userId: string,
  patch: Partial<{
    name: string;
    email: string;
    role: UserRole;
    locked: boolean;
    planId: string | null;
    planExpiresAt: string | null;
    passwordHash: string | null;
    googleId: string | null;
  }>,
): Promise<AuthUser> {
  const store = await getDocumentStore();
  const row = await store.get<AuthUser>(COLLECTIONS.users, userId);
  if (!row) throw new Error("Không tìm thấy tài khoản.");
  const cur = normalizeUser(row);

  if (typeof patch.email === "string") {
    const email = patch.email.trim().toLowerCase();
    if (email !== cur.email) {
      const clash = await findUserByEmail(email);
      if (clash && clash.id !== userId) {
        throw new Error("Email đã được sử dụng.");
      }
    }
    cur.email = email;
  }
  if (typeof patch.name === "string" && patch.name.trim()) {
    cur.name = patch.name.trim().slice(0, 80);
  }
  if (patch.role === "admin" || patch.role === "user") {
    cur.role = patch.role;
  }
  if (typeof patch.locked === "boolean") {
    cur.locked = patch.locked;
  }
  if (patch.planId !== undefined) {
    cur.planId = patch.planId;
  }
  if (patch.planExpiresAt !== undefined) {
    cur.planExpiresAt = patch.planExpiresAt;
  }
  if (patch.passwordHash !== undefined) {
    cur.passwordHash = patch.passwordHash;
  }
  if (patch.googleId !== undefined) {
    cur.googleId = patch.googleId;
  }

  await store.put(COLLECTIONS.users, cur);
  return cur;
}

export async function deleteUser(userId: string): Promise<boolean> {
  const store = await getDocumentStore();
  return store.delete(COLLECTIONS.users, userId);
}

export async function updateUserProfile(
  userId: string,
  input: { name?: string },
): Promise<AuthUser> {
  return updateUser(userId, {
    name: input.name,
  });
}
