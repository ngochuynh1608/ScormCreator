import { COLLECTIONS, getDocumentStore } from "../store";
import type { CreditBankSettings } from "./types";

const SETTINGS_ID = "credits";

const DEFAULTS: CreditBankSettings = {
  bankName: "",
  accountNumber: "",
  accountName: "",
  transferNoteTemplate: "NAP {orderCode}",
};

type SettingsDoc = CreditBankSettings & { id: string };

export function defaultBankSettings(): CreditBankSettings {
  return { ...DEFAULTS };
}

export async function getCreditBankSettings(): Promise<CreditBankSettings> {
  const store = await getDocumentStore();
  const raw = await store.get<SettingsDoc>(COLLECTIONS.settings, SETTINGS_ID);
  return {
    bankName: raw?.bankName?.trim() || "",
    accountNumber: raw?.accountNumber?.trim() || "",
    accountName: raw?.accountName?.trim() || "",
    transferNoteTemplate:
      raw?.transferNoteTemplate?.trim() || DEFAULTS.transferNoteTemplate,
  };
}

export async function saveCreditBankSettings(
  patch: Partial<CreditBankSettings>,
): Promise<CreditBankSettings> {
  const current = await getCreditBankSettings();
  const next: CreditBankSettings = {
    bankName:
      typeof patch.bankName === "string" ? patch.bankName.trim() : current.bankName,
    accountNumber:
      typeof patch.accountNumber === "string"
        ? patch.accountNumber.trim()
        : current.accountNumber,
    accountName:
      typeof patch.accountName === "string"
        ? patch.accountName.trim()
        : current.accountName,
    transferNoteTemplate:
      typeof patch.transferNoteTemplate === "string" &&
      patch.transferNoteTemplate.trim()
        ? patch.transferNoteTemplate.trim()
        : current.transferNoteTemplate,
  };
  const store = await getDocumentStore();
  await store.put(COLLECTIONS.settings, { id: SETTINGS_ID, ...next });
  return next;
}

export function renderTransferContent(
  template: string,
  orderCode: string,
): string {
  const tpl = template.trim() || DEFAULTS.transferNoteTemplate;
  if (tpl.includes("{orderCode}")) {
    return tpl.split("{orderCode}").join(orderCode);
  }
  return `${tpl} ${orderCode}`.trim();
}
