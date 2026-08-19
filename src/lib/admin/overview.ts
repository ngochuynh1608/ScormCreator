import { listUsers, resolveUserRole } from "@/lib/auth/users";
import { isPlanExpired } from "@/lib/auth/plan-expiry";
import { listPlans } from "@/lib/auth/plans";
import type { AuthUser, SubscriptionPlan } from "@/lib/auth/types";
import { listCreditOrders, listCreditTransactions } from "@/lib/credits";
import type { CreditOrder } from "@/lib/credits/types";
import { listProjects, listJobs } from "@/lib/db";
import { toResendPublicConfig } from "@/lib/email/settings";
import { getQueueMetrics, convertQueueMax } from "@/lib/jobs/queues";
import { isPayosConfigured } from "@/lib/payos/client";
import { listPlanOrders } from "@/lib/subscription/orders";
import type { PlanOrder } from "@/lib/subscription/types";
import { getEveraiApiKey } from "@/lib/tts/settings";
import type { Project, TtsJob } from "@/lib/types";
import type {
  AdminOverviewPayload,
  OverviewConversionRow,
  OverviewKpi,
  OverviewRangeDays,
  OverviewRankedItem,
  OverviewStatus,
  OverviewStatusKind,
  OverviewTransactionRow,
} from "./overview-types";

const SPARK_BUCKETS = 12;
const DAY_MS = 86_400_000;

function ts(iso: string | undefined): number {
  if (!iso) return NaN;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : NaN;
}

function inRange(iso: string | undefined, start: number, end: number): boolean {
  const n = ts(iso);
  return Number.isFinite(n) && n >= start && n < end;
}

function trimDecimal(value: string): string {
  return value.replace(".", ",").replace(/,0$/, "");
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("vi-VN");
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${trimDecimal((n / 1_000_000).toFixed(1))}M`;
  if (n >= 10_000) return `${trimDecimal((n / 1000).toFixed(1))}K`;
  return fmtInt(n);
}

function fmtVnd(n: number): string {
  return `${Math.round(n).toLocaleString("vi-VN")}₫`;
}

function fmtRevenueShort(n: number): string {
  if (n >= 1_000_000) {
    return `${trimDecimal((n / 1_000_000).toFixed(1))}tr ₫`;
  }
  return fmtVnd(n);
}

function fmtPct(n: number): string {
  return `${n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

function deltaPct(curr: number, prev: number): { text: string; up: boolean } {
  if (prev <= 0 && curr <= 0) return { text: "0%", up: true };
  if (prev <= 0) return { text: "+100%", up: true };
  const pct = ((curr - prev) / prev) * 100;
  const up = pct >= 0;
  const abs = Math.abs(pct).toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
  });
  return { text: `${up ? "+" : "−"}${abs}%`, up };
}

function deltaPoints(curr: number, prev: number): { text: string; up: boolean } {
  const d = curr - prev;
  const up = d >= 0;
  const abs = Math.abs(d).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  return { text: `${up ? "+" : "−"}${abs}đ`, up };
}

function formatRelativeVi(iso: string, now: number): string {
  const n = ts(iso);
  if (!Number.isFinite(n)) return "—";
  const diff = Math.max(0, now - n);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(n).toLocaleDateString("vi-VN");
}

function bucketIndex(time: number, start: number, end: number, n: number): number {
  const span = Math.max(1, end - start);
  const i = Math.floor(((time - start) / span) * n);
  return Math.min(n - 1, Math.max(0, i));
}

function sparkCounts(
  timestamps: number[],
  start: number,
  end: number,
  n = SPARK_BUCKETS,
): number[] {
  const arr = Array.from({ length: n }, () => 0);
  for (const t of timestamps) {
    if (!Number.isFinite(t) || t < start || t >= end) continue;
    arr[bucketIndex(t, start, end, n)] += 1;
  }
  return arr;
}

function sparkSums(
  points: { t: number; v: number }[],
  start: number,
  end: number,
  n = SPARK_BUCKETS,
): number[] {
  const arr = Array.from({ length: n }, () => 0);
  for (const p of points) {
    if (!Number.isFinite(p.t) || p.t < start || p.t >= end) continue;
    arr[bucketIndex(p.t, start, end, n)] += p.v;
  }
  return arr;
}

function sparkRates(
  items: { t: number; ok: boolean; fail: boolean }[],
  start: number,
  end: number,
  n = SPARK_BUCKETS,
): number[] {
  const ok = Array.from({ length: n }, () => 0);
  const fail = Array.from({ length: n }, () => 0);
  for (const item of items) {
    if (!Number.isFinite(item.t) || item.t < start || item.t >= end) continue;
    const i = bucketIndex(item.t, start, end, n);
    if (item.ok) ok[i] += 1;
    if (item.fail) fail[i] += 1;
  }
  return ok.map((good, i) => {
    const den = good + fail[i];
    return den > 0 ? (good / den) * 100 : 0;
  });
}

function sparkCumulative(counts: number[], baseline: number): number[] {
  let acc = baseline;
  return counts.map((c) => {
    acc += c;
    return acc;
  });
}

function sourceKind(fileName: string): "pptx" | "pdf" | "other" {
  const n = (fileName || "").trim().toLowerCase();
  if (n.endsWith(".pptx") || n.endsWith(".ppt")) return "pptx";
  if (n.endsWith(".pdf")) return "pdf";
  return "other";
}

function projectHasTts(project: Project, ttsProjectIds: Set<string>): boolean {
  if (ttsProjectIds.has(project.id)) return true;
  return project.slides.some(
    (slide) => slide.type === "content" && Boolean(slide.audioPath),
  );
}

function conversionStatus(status: Project["status"]): {
  label: string;
  kind: OverviewStatusKind;
} {
  if (status === "ready") return { label: "Hoàn tất", kind: "good" };
  if (status === "processing") return { label: "Đang xử lý", kind: "warn" };
  return { label: "Lỗi", kind: "bad" };
}

function orderStatus(status: CreditOrder["status"] | PlanOrder["status"]): {
  label: string;
  kind: OverviewStatusKind;
} {
  if (status === "paid") return { label: "Thành công", kind: "good" };
  if (status === "pending") return { label: "Đang xử lý", kind: "warn" };
  if (status === "rejected") return { label: "Thất bại", kind: "bad" };
  return { label: "Đã hủy", kind: "bad" };
}

function toPercents(
  parts: { label: string; amount: number }[],
): OverviewRankedItem[] {
  const total = parts.reduce((sum, part) => sum + part.amount, 0);
  if (total <= 0) return parts.map((part) => ({ label: part.label, value: 0 }));
  const rounded = parts.map((part) => ({
    label: part.label,
    value: Math.round((part.amount / total) * 100),
  }));
  const drift = 100 - rounded.reduce((sum, part) => sum + part.value, 0);
  if (rounded.length > 0 && drift !== 0) {
    let best = 0;
    for (let i = 1; i < rounded.length; i++) {
      if (rounded[i].value > rounded[best].value) best = i;
    }
    rounded[best].value += drift;
  }
  return rounded;
}

function successRate(projects: Project[]): number | null {
  let ready = 0;
  let failed = 0;
  for (const project of projects) {
    if (project.status === "ready") ready += 1;
    else if (project.status === "error") failed += 1;
  }
  const den = ready + failed;
  if (den === 0) return null;
  return (ready / den) * 100;
}

function lastNMonths(n: number, now: Date): { labels: string[]; keys: string[] } {
  const labels: string[] = [];
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(`T${d.getMonth() + 1}`);
    keys.push(`${d.getFullYear()}-${d.getMonth()}`);
  }
  return { labels, keys };
}

function monthKey(iso: string): string | null {
  const n = ts(iso);
  if (!Number.isFinite(n)) return null;
  const d = new Date(n);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function lastNWeeks(n: number, now: Date): { labels: string[]; starts: number[] } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = end.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(end);
  thisMonday.setDate(end.getDate() - mondayOffset);

  const labels: string[] = [];
  const starts: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(thisMonday);
    start.setDate(thisMonday.getDate() - i * 7);
    labels.push(`T${n - i}`);
    starts.push(start.getTime());
  }
  return { labels, starts };
}

function weekIndex(time: number, starts: number[]): number {
  const weekMs = 7 * DAY_MS;
  for (let i = 0; i < starts.length; i++) {
    if (time >= starts[i] && time < starts[i] + weekMs) return i;
  }
  return -1;
}

function effectivePlan(
  user: AuthUser,
  plansById: Map<string, SubscriptionPlan>,
  freePlan: SubscriptionPlan | undefined,
): SubscriptionPlan | undefined {
  if (user.planId && !isPlanExpired(user.planExpiresAt)) {
    const assigned = plansById.get(user.planId);
    if (assigned) return assigned;
  }
  return freePlan;
}

function learnerUsers(users: AuthUser[]): AuthUser[] {
  return users.filter((user) => resolveUserRole(user) !== "admin");
}

export async function buildAdminOverview(
  range: OverviewRangeDays,
): Promise<AdminOverviewPayload> {
  const nowDate = new Date();
  const now = nowDate.getTime();
  const start = now - range * DAY_MS;
  const prevStart = start - range * DAY_MS;

  const [
    users,
    plans,
    projects,
    jobs,
    creditOrders,
    planOrders,
    creditTx,
    queues,
    payosOn,
    emailCfg,
    ttsKey,
  ] = await Promise.all([
    listUsers(),
    listPlans(),
    listProjects(),
    listJobs(),
    listCreditOrders(),
    listPlanOrders(),
    listCreditTransactions(),
    getQueueMetrics().catch(() => null),
    isPayosConfigured(),
    toResendPublicConfig(),
    getEveraiApiKey(),
  ]);

  const learners = learnerUsers(users);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const plansById = new Map(plans.map((plan) => [plan.id, plan]));
  const freePlan =
    plans.find((plan) => plan.monthlyPrice === 0) || plans[0];

  const ttsProjectIds = new Set(
    jobs.filter((job) => job.status !== "cancelled").map((job) => job.projectId),
  );

  const kpis = buildKpis({
    learners,
    projects,
    jobs,
    creditOrders,
    planOrders,
    start,
    end: now,
    prevStart,
    prevEnd: start,
  });

  const statuses = buildStatuses({
    projects,
    jobs,
    creditOrders,
    planOrders,
    queues,
    payosOn,
    emailConfigured: emailCfg.configured,
    ttsConfigured: Boolean(ttsKey),
    now,
  });

  const revenue = buildRevenueChart(creditOrders, planOrders, nowDate);
  const conversions = buildConversionsChart(projects, nowDate);
  const creditMix = buildCreditMix(projects, jobs, creditTx, start, now);
  const planMix = buildPlanMix(learners, plans, plansById, freePlan);

  return {
    range,
    kpis,
    statuses,
    revenue,
    creditMix,
    conversions,
    plans: planMix,
    recentTransactions: buildRecentTransactions(
      creditOrders,
      planOrders,
      usersById,
      now,
    ),
    recentConversions: buildRecentConversions(
      projects,
      usersById,
      ttsProjectIds,
      now,
    ),
  };
}

function buildKpis(input: {
  learners: AuthUser[];
  projects: Project[];
  jobs: TtsJob[];
  creditOrders: CreditOrder[];
  planOrders: PlanOrder[];
  start: number;
  end: number;
  prevStart: number;
  prevEnd: number;
}): OverviewKpi[] {
  const { learners, projects, jobs, creditOrders, planOrders, start, end, prevStart, prevEnd } =
    input;

  const totalUsers = learners.length;
  const usersCreatedNow = learners.filter((user) =>
    inRange(user.createdAt, start, end),
  ).length;
  const baselineBeforeRange = Math.max(0, totalUsers - usersCreatedNow);
  const userDelta = deltaPct(totalUsers, baselineBeforeRange);
  const userSpark = sparkCumulative(
    sparkCounts(
      learners.map((user) => ts(user.createdAt)),
      start,
      end,
    ),
    baselineBeforeRange,
  );

  const activeNow = activeUserIds(projects, jobs, creditOrders, planOrders, start, end);
  const activePrev = activeUserIds(
    projects,
    jobs,
    creditOrders,
    planOrders,
    prevStart,
    prevEnd,
  );
  const activeDelta = deltaPct(activeNow.size, activePrev.size);

  const convNow = projects.filter((project) => inRange(project.createdAt, start, end));
  const convPrev = projects.filter((project) =>
    inRange(project.createdAt, prevStart, prevEnd),
  );
  const convDelta = deltaPct(convNow.length, convPrev.length);

  const rateNow = successRate(convNow);
  const ratePrev = successRate(convPrev);
  const rateDelta =
    rateNow == null
      ? { text: "0đ", up: true }
      : deltaPoints(rateNow, ratePrev ?? rateNow);

  const ttsNow = jobs.filter((job) => inRange(job.createdAt, start, end));
  const ttsPrev = jobs.filter((job) => inRange(job.createdAt, prevStart, prevEnd));
  const ttsDelta = deltaPct(ttsNow.length, ttsPrev.length);

  const revNow = paidRevenue(creditOrders, planOrders, start, end);
  const revPrev = paidRevenue(creditOrders, planOrders, prevStart, prevEnd);
  const revDelta = deltaPct(revNow, revPrev);

  return [
    {
      id: "users",
      label: "Tổng người dùng",
      value: fmtInt(totalUsers),
      delta: userDelta.text,
      up: userDelta.up,
      spark: userSpark,
    },
    {
      id: "active",
      label: `Người dùng hoạt động (${rangeLabel(end - start)})`,
      value: fmtInt(activeNow.size),
      delta: activeDelta.text,
      up: activeDelta.up,
      spark: sparkCounts([...activeEventTimes(projects, jobs, creditOrders, planOrders)], start, end),
    },
    {
      id: "conversions",
      label: `Lượt chuyển đổi (${rangeLabel(end - start)})`,
      value: fmtCompact(convNow.length),
      delta: convDelta.text,
      up: convDelta.up,
      spark: sparkCounts(
        convNow.map((project) => ts(project.createdAt)),
        start,
        end,
      ),
    },
    {
      id: "success",
      label: "Tỷ lệ chuyển đổi thành công",
      value: rateNow == null ? "—" : fmtPct(rateNow),
      delta: rateDelta.text,
      up: rateDelta.up,
      spark: sparkRates(
        convNow.map((project) => ({
          t: ts(project.createdAt),
          ok: project.status === "ready",
          fail: project.status === "error",
        })),
        start,
        end,
      ),
    },
    {
      id: "tts",
      label: "Lượt gọi API giọng đọc AI",
      value: fmtCompact(ttsNow.length),
      delta: ttsDelta.text,
      up: ttsDelta.up,
      spark: sparkCounts(
        ttsNow.map((job) => ts(job.createdAt)),
        start,
        end,
      ),
    },
    {
      id: "revenue",
      label: "Doanh thu kỳ này",
      value: fmtRevenueShort(revNow),
      delta: revDelta.text,
      up: revDelta.up,
      spark: sparkSums(
        [
          ...creditOrders
            .filter((order) => order.status === "paid")
            .map((order) => ({ t: ts(order.updatedAt || order.createdAt), v: order.priceVnd })),
          ...planOrders
            .filter((order) => order.status === "paid")
            .map((order) => ({ t: ts(order.updatedAt || order.createdAt), v: order.priceVnd })),
        ],
        start,
        end,
      ),
    },
  ];
}

function rangeLabel(spanMs: number): string {
  const days = Math.round(spanMs / DAY_MS);
  if (days <= 7) return "7N";
  if (days <= 30) return "30N";
  if (days <= 90) return "90N";
  return "6 tháng";
}

function activeUserIds(
  projects: Project[],
  jobs: TtsJob[],
  creditOrders: CreditOrder[],
  planOrders: PlanOrder[],
  start: number,
  end: number,
): Set<string> {
  const ids = new Set<string>();
  for (const project of projects) {
    if (
      project.ownerId &&
      (inRange(project.createdAt, start, end) || inRange(project.updatedAt, start, end))
    ) {
      ids.add(project.ownerId);
    }
  }
  for (const job of jobs) {
    if (job.ownerId && inRange(job.createdAt, start, end)) ids.add(job.ownerId);
  }
  for (const order of creditOrders) {
    if (inRange(order.createdAt, start, end)) ids.add(order.userId);
  }
  for (const order of planOrders) {
    if (inRange(order.createdAt, start, end)) ids.add(order.userId);
  }
  return ids;
}

function activeEventTimes(
  projects: Project[],
  jobs: TtsJob[],
  creditOrders: CreditOrder[],
  planOrders: PlanOrder[],
): number[] {
  return [
    ...projects.map((project) => ts(project.updatedAt || project.createdAt)),
    ...jobs.map((job) => ts(job.createdAt)),
    ...creditOrders.map((order) => ts(order.createdAt)),
    ...planOrders.map((order) => ts(order.createdAt)),
  ].filter(Number.isFinite);
}

function paidRevenue(
  creditOrders: CreditOrder[],
  planOrders: PlanOrder[],
  start: number,
  end: number,
): number {
  let sum = 0;
  for (const order of creditOrders) {
    if (order.status === "paid" && inRange(order.updatedAt || order.createdAt, start, end)) {
      sum += order.priceVnd || 0;
    }
  }
  for (const order of planOrders) {
    if (order.status === "paid" && inRange(order.updatedAt || order.createdAt, start, end)) {
      sum += order.priceVnd || 0;
    }
  }
  return sum;
}

function buildStatuses(input: {
  projects: Project[];
  jobs: TtsJob[];
  creditOrders: CreditOrder[];
  planOrders: PlanOrder[];
  queues: Awaited<ReturnType<typeof getQueueMetrics>> | null;
  payosOn: boolean;
  emailConfigured: boolean;
  ttsConfigured: boolean;
  now: number;
}): OverviewStatus[] {
  const hourAgo = input.now - 60 * 60 * 1000;
  const recentProjects = input.projects.filter((project) =>
    inRange(project.updatedAt || project.createdAt, hourAgo, input.now + 1),
  );
  const errorRecent = recentProjects.filter((project) => project.status === "error").length;
  const convertWaiting =
    (input.queues?.convert.waiting || 0) +
    (input.queues?.convert.active || 0) +
    (input.queues?.convert.delayed || 0);
  const convertMax = convertQueueMax();
  const convertFailed = input.queues?.convert.failed || 0;

  let convert: OverviewStatus = {
    name: "Dịch vụ chuyển đổi SCORM",
    state: "Hoạt động tốt",
    level: "good",
  };
  if (convertFailed >= 5 || errorRecent >= 3) {
    convert = {
      name: convert.name,
      state: "Có lỗi gần đây",
      level: "warning",
    };
  } else if (convertWaiting >= Math.max(2, Math.floor(convertMax * 0.8))) {
    convert = {
      name: convert.name,
      state: "Hàng đợi cao",
      level: "warning",
    };
  }

  const ttsErrors = input.jobs.filter(
    (job) => job.status === "error" && inRange(job.updatedAt || job.createdAt, hourAgo, input.now + 1),
  ).length;
  let tts: OverviewStatus;
  if (!input.ttsConfigured) {
    tts = {
      name: "API giọng đọc AI (Text-to-Audio)",
      state: "Chưa cấu hình",
      level: "warning",
    };
  } else if (ttsErrors >= 3) {
    tts = {
      name: "API giọng đọc AI (Text-to-Audio)",
      state: "Có lỗi gần đây",
      level: "warning",
    };
  } else {
    tts = {
      name: "API giọng đọc AI (Text-to-Audio)",
      state: "Hoạt động tốt",
      level: "good",
    };
  }

  const pendingConfirmed = [...input.creditOrders, ...input.planOrders].filter(
    (order) => order.status === "pending" && Boolean(order.transferConfirmedAt),
  ).length;
  let payos: OverviewStatus;
  if (!input.payosOn) {
    payos = {
      name: "Cổng thanh toán PayOS",
      state: "Chưa cấu hình",
      level: "warning",
    };
  } else if (pendingConfirmed >= 5) {
    payos = {
      name: "Cổng thanh toán PayOS",
      state: "Độ trễ cao",
      level: "warning",
    };
  } else {
    payos = {
      name: "Cổng thanh toán PayOS",
      state: "Hoạt động tốt",
      level: "good",
    };
  }

  const email: OverviewStatus = input.emailConfigured
    ? { name: "Email OTP", state: "Hoạt động tốt", level: "good" }
    : { name: "Email OTP", state: "Chưa cấu hình", level: "warning" };

  return [convert, tts, payos, email];
}

function buildRevenueChart(
  creditOrders: CreditOrder[],
  planOrders: PlanOrder[],
  now: Date,
): AdminOverviewPayload["revenue"] {
  const { labels, keys } = lastNMonths(6, now);
  const sub = Array.from({ length: keys.length }, () => 0);
  const credit = Array.from({ length: keys.length }, () => 0);
  const index = new Map(keys.map((key, i) => [key, i]));

  for (const order of planOrders) {
    if (order.status !== "paid") continue;
    const key = monthKey(order.updatedAt || order.createdAt);
    const i = key ? index.get(key) : undefined;
    if (i == null) continue;
    sub[i] += (order.priceVnd || 0) / 1_000_000;
  }
  for (const order of creditOrders) {
    if (order.status !== "paid") continue;
    const key = monthKey(order.updatedAt || order.createdAt);
    const i = key ? index.get(key) : undefined;
    if (i == null) continue;
    credit[i] += (order.priceVnd || 0) / 1_000_000;
  }

  return {
    categories: labels,
    unit: "tr ₫",
    series: [
      { name: "Gói đăng ký", values: sub.map((v) => round1(v)) },
      { name: "Nạp credit", values: credit.map((v) => round1(v)) },
    ],
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function buildConversionsChart(
  projects: Project[],
  now: Date,
): AdminOverviewPayload["conversions"] {
  const { labels, starts } = lastNWeeks(8, now);
  const pptx = Array.from({ length: starts.length }, () => 0);
  const pdf = Array.from({ length: starts.length }, () => 0);
  for (const project of projects) {
    const t = ts(project.createdAt);
    const i = weekIndex(t, starts);
    if (i < 0) continue;
    const kind = sourceKind(project.originalFileName);
    if (kind === "pptx") pptx[i] += 1;
    else if (kind === "pdf") pdf[i] += 1;
  }
  return {
    categories: labels,
    series: [
      { name: "PPTX", values: pptx },
      { name: "PDF", values: pdf },
    ],
  };
}

function buildCreditMix(
  projects: Project[],
  jobs: TtsJob[],
  creditTx: { type: string; amount: number; createdAt: string }[],
  start: number,
  end: number,
): OverviewRankedItem[] {
  const pptx = projects.filter(
    (project) =>
      inRange(project.createdAt, start, end) &&
      sourceKind(project.originalFileName) === "pptx",
  ).length;
  const pdf = projects.filter(
    (project) =>
      inRange(project.createdAt, start, end) &&
      sourceKind(project.originalFileName) === "pdf",
  ).length;
  const ttsDebit = creditTx
    .filter((row) => row.type === "tts_debit" && inRange(row.createdAt, start, end))
    .reduce((sum, row) => sum + Math.abs(row.amount || 0), 0);
  const ttsJobs = jobs.filter((job) => inRange(job.createdAt, start, end)).length;
  const other = projects.filter(
    (project) =>
      inRange(project.createdAt, start, end) &&
      sourceKind(project.originalFileName) === "other",
  ).length;

  return toPercents([
    { label: "Chuyển đổi PPTX", amount: pptx },
    { label: "Chuyển đổi PDF", amount: pdf },
    { label: "Giọng đọc AI (TTS)", amount: ttsDebit > 0 ? ttsDebit : ttsJobs },
    { label: "Khác", amount: other },
  ]);
}

function buildPlanMix(
  learners: AuthUser[],
  plans: SubscriptionPlan[],
  plansById: Map<string, SubscriptionPlan>,
  freePlan: SubscriptionPlan | undefined,
): OverviewRankedItem[] {
  const counts = new Map<string, number>();
  for (const plan of plans) counts.set(plan.name, 0);
  for (const user of learners) {
    const plan = effectivePlan(user, plansById, freePlan);
    const name = plan?.name || "Miễn phí";
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const parts = [...counts.entries()].map(([label, amount]) => ({ label, amount }));
  if (parts.length === 0) return [{ label: "Miễn phí", value: 0 }];
  return toPercents(parts);
}

function buildRecentTransactions(
  creditOrders: CreditOrder[],
  planOrders: PlanOrder[],
  usersById: Map<string, AuthUser>,
  now: number,
): OverviewTransactionRow[] {
  type Row = {
    createdAt: string;
    userId: string;
    type: string;
    amount: number;
    status: CreditOrder["status"];
  };
  const rows: Row[] = [
    ...creditOrders.map((order) => ({
      createdAt: order.createdAt,
      userId: order.userId,
      type: "Nạp credit",
      amount: order.priceVnd || 0,
      status: order.status,
    })),
    ...planOrders.map((order) => ({
      createdAt: order.createdAt,
      userId: order.userId,
      type: `Đăng ký gói ${order.planName}`,
      amount: order.priceVnd || 0,
      status: order.status,
    })),
  ];
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return rows.slice(0, 5).map((row) => {
    const user = usersById.get(row.userId);
    const status = orderStatus(row.status);
    return {
      user: user?.name || row.userId,
      email: user?.email || "",
      type: row.type,
      amount: fmtVnd(row.amount),
      status: status.label,
      statusKind: status.kind,
      time: formatRelativeVi(row.createdAt, now),
    };
  });
}

function buildRecentConversions(
  projects: Project[],
  usersById: Map<string, AuthUser>,
  ttsProjectIds: Set<string>,
  now: number,
): OverviewConversionRow[] {
  const rows = [...projects].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
  return rows.slice(0, 5).map((project) => {
    const owner = project.ownerId ? usersById.get(project.ownerId) : undefined;
    const status = conversionStatus(project.status);
    const file = project.originalFileName?.trim() || project.title || "Bài giảng";
    return {
      user: owner?.name || (project.ownerId ? project.ownerId : "Khách"),
      file,
      tts: projectHasTts(project, ttsProjectIds) ? "Có" : "Không",
      status: status.label,
      statusKind: status.kind,
      time: formatRelativeVi(project.createdAt, now),
    };
  });
}
