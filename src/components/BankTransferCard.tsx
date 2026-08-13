"use client";

import { useState } from "react";

export type BankInfo = {
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
};

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

export function BankTransferCard({
  orderCode,
  bank,
  amountVnd,
  transferContent,
}: {
  orderCode: string;
  bank: BankInfo;
  amountVnd: number;
  transferContent: string;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((cur) => (cur === key ? null : cur));
      }, 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-[24px] border border-[#2bb673] bg-[#eefaf4] p-5">
      <p className="text-sm font-semibold text-[#0f2a36]">
        Chuyển khoản đơn {orderCode}
      </p>
      <dl className="mt-3 grid gap-3 text-sm text-[#0f2a36] sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
            Ngân hàng
          </dt>
          <dd className="mt-0.5">{bank.bankName || "—"}</dd>
        </div>
        <CopyRow
          label="Số tài khoản"
          value={bank.accountNumber || ""}
          copied={copiedKey === "account"}
          onCopy={() => void copy("account", bank.accountNumber || "")}
        />
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
            Chủ tài khoản
          </dt>
          <dd className="mt-0.5">{bank.accountName || "—"}</dd>
        </div>
        <CopyRow
          label="Số tiền"
          value={formatVnd(amountVnd)}
          copied={copiedKey === "amount"}
          onCopy={() => void copy("amount", String(amountVnd))}
        />
        <CopyRow
          label="Nội dung chuyển khoản"
          value={transferContent}
          copied={copiedKey === "content"}
          onCopy={() => void copy("content", transferContent)}
          wide
        />
      </dl>
    </div>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
  wide,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
        {label}
      </dt>
      <dd className="mt-0.5 flex items-center gap-2 font-semibold">
        <span className="min-w-0 break-all">{value || "—"}</span>
        {value ? (
          <button
            type="button"
            onClick={onCopy}
            title={copied ? "Đã copy" : `Copy ${label.toLowerCase()}`}
            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#1a5c40] hover:bg-white/80"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        ) : null}
      </dd>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5 9.5 17 19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
