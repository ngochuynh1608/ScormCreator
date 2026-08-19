export const OVERVIEW_RANGES = [7, 30, 90, 180] as const;
export type OverviewRangeDays = (typeof OVERVIEW_RANGES)[number];

export type OverviewKpi = {
  id: string;
  label: string;
  value: string;
  delta: string;
  up: boolean;
  spark: number[];
};

export type OverviewStatusLevel = "good" | "warning" | "critical";

export type OverviewStatus = {
  name: string;
  state: string;
  level: OverviewStatusLevel;
};

export type OverviewChartSeries = {
  name: string;
  values: number[];
};

export type OverviewChart = {
  categories: string[];
  series: OverviewChartSeries[];
  unit?: string;
};

export type OverviewRankedItem = {
  label: string;
  value: number;
};

export type OverviewStatusKind = "good" | "warn" | "bad";

export type OverviewTransactionRow = {
  user: string;
  email: string;
  type: string;
  amount: string;
  status: string;
  statusKind: OverviewStatusKind;
  time: string;
};

export type OverviewConversionRow = {
  user: string;
  file: string;
  tts: string;
  status: string;
  statusKind: OverviewStatusKind;
  time: string;
};

export type AdminOverviewPayload = {
  range: OverviewRangeDays;
  kpis: OverviewKpi[];
  statuses: OverviewStatus[];
  revenue: OverviewChart;
  creditMix: OverviewRankedItem[];
  conversions: OverviewChart;
  plans: OverviewRankedItem[];
  recentTransactions: OverviewTransactionRow[];
  recentConversions: OverviewConversionRow[];
};

export function parseOverviewRange(raw: string | null): OverviewRangeDays {
  const n = Number(raw);
  if (n === 7 || n === 30 || n === 90 || n === 180) return n;
  return 30;
}
