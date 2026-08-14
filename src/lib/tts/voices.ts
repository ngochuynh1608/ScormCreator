import { estimateDurationMs } from "./estimate";

export type EveraiVoice = {
  code: string;
  name: string;
  gender: "male" | "female";
  locale: string;
  region?: string;
  creditsPer1k: number;
};

/** Built-in EverAI voices (from https://help.everai.vn/api-docs/text-to-speech/post-text-to-speech). */
export const EVERAI_VOICES: EveraiVoice[] = [
  {
    code: "vi_female_kieunhi_mn",
    name: "Kiều Nhi",
    gender: "female",
    locale: "vi",
    region: "Miền Nam",
    creditsPer1k: 1000,
  },
  {
    code: "vi_female_thuytrang_mb",
    name: "Thùy Trang",
    gender: "female",
    locale: "vi",
    region: "Miền Bắc",
    creditsPer1k: 1000,
  },
  {
    code: "vi_female_hacuc_mb",
    name: "Hạ Cúc",
    gender: "female",
    locale: "vi",
    region: "Miền Bắc",
    creditsPer1k: 1000,
  },
  {
    code: "vi_female_huyenanh_mb",
    name: "Huyền Anh",
    gender: "female",
    locale: "vi",
    region: "Miền Bắc",
    creditsPer1k: 1000,
  },
  {
    code: "vi_female_halinh_mb",
    name: "Hà Linh",
    gender: "female",
    locale: "vi",
    region: "Miền Bắc",
    creditsPer1k: 1000,
  },
  {
    code: "vi_female_hoaian_mb",
    name: "Hoài An",
    gender: "female",
    locale: "vi",
    region: "Miền Bắc",
    creditsPer1k: 1000,
  },
  {
    code: "vi_female_khanhhuyentvc_mb",
    name: "Khánh Huyền",
    gender: "female",
    locale: "vi",
    region: "Miền Bắc",
    creditsPer1k: 1000,
  },
  {
    code: "vi_male_lehoang_mb",
    name: "Lê Hoàng",
    gender: "male",
    locale: "vi",
    region: "Miền Bắc",
    creditsPer1k: 1000,
  },
  {
    code: "vi_male_minhtriet_mb",
    name: "Minh Triết",
    gender: "male",
    locale: "vi",
    region: "Miền Bắc",
    creditsPer1k: 1000,
  },
  {
    code: "vi_male_ductrong_mb",
    name: "Đức Trọng",
    gender: "male",
    locale: "vi",
    region: "Miền Bắc",
    creditsPer1k: 1000,
  },
  {
    code: "vi_female_nova_default",
    name: "Nova",
    gender: "female",
    locale: "vi",
    region: "Giọng Mỹ",
    creditsPer1k: 100,
  },
  {
    code: "vi_male_echo_default",
    name: "Echo",
    gender: "male",
    locale: "vi",
    region: "Giọng Mỹ",
    creditsPer1k: 100,
  },
  {
    code: "vi_male_onyx_default",
    name: "Onyx",
    gender: "male",
    locale: "vi",
    region: "Giọng Mỹ",
    creditsPer1k: 100,
  },
  {
    code: "en_female_nova_default",
    name: "Nova (EN)",
    gender: "female",
    locale: "en",
    region: "American",
    creditsPer1k: 100,
  },
  {
    code: "en_male_echo_default",
    name: "Echo (EN)",
    gender: "male",
    locale: "en",
    region: "American",
    creditsPer1k: 100,
  },
];

export const EVERAI_MODELS = [
  { id: "everai-v1.6", label: "everai-v1.6 · Tiêu chuẩn (~833 credit/phút)" },
  { id: "everai-v1.5", label: "everai-v1.5 · Tiêu chuẩn (~833 credit/phút)" },
  {
    id: "everai-v1.5-turbo",
    label: "everai-v1.5-turbo · Turbo (~416 credit/phút)",
  },
  { id: "everai-v1", label: "everai-v1 · Tiêu chuẩn (~833 credit/phút)" },
] as const;

export const DEFAULT_VOICE = "vi_female_kieunhi_mn";
export const DEFAULT_MODEL = "everai-v1.6";

/** EverAI: 10.000 credits ≈ 0.4 giờ (Turbo) → 25.000 / giờ. */
export const TURBO_CREDITS_PER_HOUR = 25_000;
/** EverAI: 10.000 credits ≈ 0.2 giờ (Tiêu chuẩn) → 50.000 / giờ. */
export const STANDARD_CREDITS_PER_HOUR = 50_000;

export function findEveraiVoice(code: string): EveraiVoice | undefined {
  return EVERAI_VOICES.find((v) => v.code === code);
}

export function isTurboModel(modelId?: string | null): boolean {
  return /turbo/i.test(String(modelId || ""));
}

/**
 * EverAI bills by audio duration, not characters.
 * Turbo ≈ 416 credit/phút; Standard ≈ 833 credit/phút.
 */
export function estimateCredits(
  durationMs: number,
  modelId?: string | null,
): number {
  const ms = Math.max(0, durationMs);
  if (ms <= 0) return 0;
  const perHour = isTurboModel(modelId)
    ? TURBO_CREDITS_PER_HOUR
    : STANDARD_CREDITS_PER_HOUR;
  return Math.max(1, Math.ceil((ms / 3_600_000) * perHour));
}

export function estimateCreditsForText(
  text: string,
  modelId?: string | null,
  rate = 1,
): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return estimateCredits(estimateDurationMs(trimmed, rate), modelId);
}
