/**
 * Ensures the default system admin exists.
 * Email: admin@scormcreator.local  Password: Admin@123
 */
import { hashPassword } from "./password";
import {
  createUser,
  findUserByEmail,
  updateUser,
} from "./users";

const DEFAULT_ADMIN_EMAIL = "admin@scormcreator.local";
const DEFAULT_ADMIN_PASSWORD = "Admin@123";

export async function ensureDefaultAdmin() {
  const existing = await findUserByEmail(DEFAULT_ADMIN_EMAIL);
  if (existing) {
    if (existing.role !== "admin") {
      return updateUser(existing.id, { role: "admin" });
    }
    return existing;
  }

  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  return createUser({
    email: DEFAULT_ADMIN_EMAIL,
    name: "Admin",
    passwordHash,
    role: "admin",
  });
}
