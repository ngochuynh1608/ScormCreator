/** NAPAS BIN → tên ngân hàng (PayOS `bin`). */
const BANK_BY_BIN: Record<string, string> = {
  "970415": "VietinBank",
  "970436": "Vietcombank",
  "970418": "BIDV",
  "970405": "Agribank",
  "970422": "MB Bank",
  "970407": "Techcombank",
  "970416": "ACB",
  "970432": "VPBank",
  "970423": "TPBank",
  "970403": "Sacombank",
  "970443": "SHB",
  "970441": "VIB",
  "970448": "OCB",
  "970454": "VietCapital Bank",
  "970437": "HDBank",
  "970440": "SeABank",
  "970449": "LPBank",
  "970426": "MSB",
  "970431": "Eximbank",
  "970412": "PVcomBank",
  "970409": "Bac A Bank",
  "970428": "Nam A Bank",
  "970452": "KienlongBank",
  "970433": "VietBank",
  "970438": "BaoViet Bank",
  "970425": "ABBANK",
  "970424": "Shinhan Bank",
  "970457": "Woori Bank",
};

export function bankNameFromBin(bin?: string): string {
  const code = (bin || "").replace(/\D/g, "");
  if (!code) return "";
  return BANK_BY_BIN[code] || "";
}
