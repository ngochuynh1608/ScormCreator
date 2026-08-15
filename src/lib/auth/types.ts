export type UserRole = "user" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  googleId: string | null;
  createdAt: string;
  /** Explicit admin flag; also auto via ADMIN_EMAILS. */
  role?: UserRole;
  /** Locked accounts cannot sign in. */
  locked?: boolean;
  /** Assigned subscription plan id. */
  planId?: string | null;
  /** ISO timestamp; paid plans revert to free after this. */
  planExpiresAt?: string | null;
  /**
   * ISO timestamp when email was verified.
   * `null` = pending verification (new password signups).
   * omitted/undefined = legacy account, treated as verified.
   */
  emailVerifiedAt?: string | null;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  locked: boolean;
  planId: string | null;
  planExpiresAt: string | null;
  createdAt: string;
};

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role?: UserRole;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  /** Max presentations / projects. */
  maxPresentations: number;
  /** EverAI TTS credits. */
  everaiCredits: number;
  /** Max students / learners. */
  maxStudents: number;
  /** Monthly price in VND. 0 = free. */
  monthlyPrice: number;
  createdAt: string;
  updatedAt: string;
};
