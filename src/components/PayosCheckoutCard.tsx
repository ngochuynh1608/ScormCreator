"use client";

import { useState } from "react";
import { bankNameFromBin } from "@/lib/payos/banks";

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function qrImageSrc(qrCode: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrCode)}`;
}

export function PayosCheckoutCard({
  orderCode,
  amountVnd,
  qrCode,
  transferContent,
  payosBin,
  payosAccountNumber,
  payosAccountName,
  payosDescription,
}: {
  orderCode: string;
  amountVnd: number;
  qrCode?: string;
  transferContent?: string;
  payosBin?: string;
  payosAccountNumber?: string;
  payosAccountName?: string;
  payosDescription?: string;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const bankName = bankNameFromBin(payosBin);
  const content = payosDescription || transferContent || "";

  async function copy(key: string, value: string) {
    if (!value) return;
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
      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        <div className="flex flex-col items-center">
          {qrCode ? (
            <img
              src={qrImageSrc(qrCode)}
              alt={`QR thanh toán đơn ${orderCode}`}
              width={240}
              height={240}
              className="h-52 w-52 rounded-2xl bg-white p-2"
            />
          ) : (
            <div className="flex h-52 w-52 items-center justify-center rounded-2xl bg-white text-sm text-[#8a98a8]">
              Chưa có QR
            </div>
          )}
          <p className="mt-2 text-center text-xs leading-5 text-[#5b6b7c]">
            Quét QR bằng app ngân hàng
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#0f2a36]">
            Thông tin thanh toán
          </p>
          <dl className="mt-3 grid gap-3 text-sm text-[#0f2a36]">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
                Ngân hàng
              </dt>
              <dd className="mt-0.5">{bankName || "—"}</dd>
            </div>
            <CopyRow
              label="Số tài khoản"
              value={payosAccountNumber || ""}
              copied={copiedKey === "account"}
              onCopy={() => void copy("account", payosAccountNumber || "")}
            />
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-[#8a98a8]">
                Chủ tài khoản
              </dt>
              <dd className="mt-0.5">{payosAccountName || "—"}</dd>
            </div>
            <CopyRow
              label="Số tiền"
              value={formatVnd(amountVnd)}
              copied={copiedKey === "amount"}
              onCopy={() => void copy("amount", String(amountVnd))}
            />
            <CopyRow
              label="Nội dung thanh toán"
              value={content}
              copied={copiedKey === "content"}
              onCopy={() => void copy("content", content)}
            />
          </dl>
        </div>
      </div>
    </div>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
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
