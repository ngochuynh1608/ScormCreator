export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  priceVnd: number;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreditBankSettings = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  transferNoteTemplate: string;
};

export type CreditOrderStatus = "pending" | "paid" | "rejected" | "cancelled";

export type CreditOrder = {
  id: string;
  orderCode: string;
  userId: string;
  packId: string;
  packName: string;
  credits: number;
  priceVnd: number;
  status: CreditOrderStatus;
  transferContent: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  /** User tapped “Đã chuyển khoản” while still waiting for admin. */
  transferConfirmedAt?: string;
};

export type CreditTransactionType = "purchase" | "admin_grant" | "tts_debit";

export type CreditTransaction = {
  id: string;
  userId: string;
  type: CreditTransactionType;
  /** Positive = add to wallet, negative = TTS debit. */
  amount: number;
  extraCreditsAfter?: number;
  creditsUsedAfter?: number;
  orderId?: string;
  jobId?: string;
  note?: string;
  createdAt: string;
};

export type CreditSnapshot = {
  creditsUsed: number;
  extraCredits: number;
  planLimit: number;
  reserved: number;
  available: number;
  ceiling: number;
};

export class InsufficientCreditsError extends Error {
  needed: number;
  available: number;

  constructor(needed: number, available: number) {
    super(
      `Không đủ credit TTS. Cần ${needed.toLocaleString("vi-VN")}, còn ${available.toLocaleString("vi-VN")}. Nạp thêm tại trang Thanh toán.`,
    );
    this.name = "InsufficientCreditsError";
    this.needed = needed;
    this.available = available;
  }
}
