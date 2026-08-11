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
  { id: "everai-v1.6", label: "everai-v1.6 (khuyến nghị)" },
  { id: "everai-v1.5", label: "everai-v1.5" },
  { id: "everai-v1.5-turbo", label: "everai-v1.5-turbo (nhanh, rẻ hơn)" },
  { id: "everai-v1", label: "everai-v1" },
] as const;

export const DEFAULT_VOICE = "vi_female_kieunhi_mn";
export const DEFAULT_MODEL = "everai-v1.6";

export function findEveraiVoice(code: string): EveraiVoice | undefined {
  return EVERAI_VOICES.find((v) => v.code === code);
}

/** Estimate EverAI credits from billed character count + voice rate. */
export function estimateCredits(characters: number, voiceCode: string): number {
  const voice = findEveraiVoice(voiceCode);
  const per1k = voice?.creditsPer1k ?? 1000;
  const chars = Math.max(0, Math.ceil(characters));
  return Math.max(1, Math.ceil((chars * per1k) / 1000));
}
