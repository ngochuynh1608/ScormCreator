"use client";

import { useCallback, useEffect, useState } from "react";
import {
  OVERVIEW_RANGES,
  type AdminOverviewPayload,
  type OverviewRangeDays,
  type OverviewStatusKind,
} from "@/lib/admin/overview-types";
import {
  BarChart,
  ChartDataTable,
  LineChart,
  RankedBars,
  Sparkline,
} from "@/components/AdminOverviewCharts";

const RANGE_LABEL: Record<OverviewRangeDays, string> = {
  7: "7 ngày",
  30: "30 ngày",
  90: "90 ngày",
  180: "6 tháng",
};

function pillClass(kind: OverviewStatusKind): string {
  if (kind === "good") return "admin-dash-pill admin-dash-pill-good";
  if (kind === "warn") return "admin-dash-pill admin-dash-pill-warn";
  return "admin-dash-pill admin-dash-pill-bad";
}

export function AdminOverviewDashboard() {
  const [range, setRange] = useState<OverviewRangeDays>(30);
  const [data, setData] = useState<AdminOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRevenueTable, setShowRevenueTable] = useState(false);
  const [showConvTable, setShowConvTable] = useState(false);

  const load = useCallback(async (nextRange: OverviewRangeDays, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/overview?range=${nextRange}`, { signal });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Không tải được tổng quan");
      setData(body as AdminOverviewPayload);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void load(range, ac.signal);
    return () => ac.abort();
  }, [load, range]);

  return (
    <section className="admin-overview">
      <div className="admin-panel-head">
        <div>
          <h1 className="brand-font admin-title">Tổng quan</h1>
          <p className="admin-desc">
            Số liệu nền tảng chuyển đổi PPTX/PDF → SCORM, giọng đọc AI, credit &
            gói đăng ký.
          </p>
        </div>
        <div className="admin-dash-range" role="group" aria-label="Khoảng thời gian">
          {OVERVIEW_RANGES.map((days) => (
            <button
              key={days}
              type="button"
              className={`admin-dash-range-btn${range === days ? " is-active" : ""}`}
              aria-pressed={range === days}
              onClick={() => setRange(days)}
            >
              {RANGE_LABEL[days]}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="admin-alert-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="admin-dash-kpi-grid">
        {(data?.kpis || placeholders()).map((kpi) => (
          <article className="admin-dash-card admin-dash-stat" key={kpi.id}>
            <div className="admin-dash-stat-label">{kpi.label}</div>
            <div className="admin-dash-stat-value">
              {loading && !data ? "…" : kpi.value}
            </div>
            <div className="admin-dash-stat-bottom">
              <span className={`admin-dash-delta ${kpi.up ? "is-up" : "is-down"}`}>
                {kpi.up ? "↑" : "↓"} {kpi.delta}{" "}
                <span className="admin-dash-delta-muted">so với kỳ trước</span>
              </span>
            </div>
            <Sparkline values={kpi.spark} up={kpi.up} />
          </article>
        ))}
      </div>

      <div className="admin-dash-status-row">
        {(data?.statuses || statusPlaceholders()).map((s) => (
          <div className="admin-dash-status" key={s.name}>
            <span
              className={`admin-dash-status-dot is-${s.level}`}
              aria-hidden
            />
            <span className="admin-dash-status-name">{s.name}</span>
            <span className="admin-dash-status-state">{s.state}</span>
          </div>
        ))}
      </div>

      <div className="admin-dash-charts">
        <article className="admin-dash-card">
          <div className="admin-dash-card-head">
            <div>
              <h2 className="admin-dash-card-title">Doanh thu theo thời gian</h2>
              <p className="admin-dash-card-sub">
                Gói đăng ký so với nạp credit — 6 tháng gần nhất, đơn vị triệu ₫
              </p>
            </div>
            <button
              type="button"
              className="admin-dash-toggle"
              onClick={() => setShowRevenueTable((v) => !v)}
            >
              {showRevenueTable ? "Xem biểu đồ" : "Xem dạng bảng"}
            </button>
          </div>
          {data ? (
            showRevenueTable ? (
              <ChartDataTable chart={data.revenue} colPrefix="Tháng" />
            ) : (
              <LineChart chart={data.revenue} />
            )
          ) : (
            <div className="admin-dash-chart-skel" aria-hidden />
          )}
        </article>

        <article className="admin-dash-card">
          <div className="admin-dash-card-head">
            <div>
              <h2 className="admin-dash-card-title">Credit tiêu thụ theo mục đích</h2>
              <p className="admin-dash-card-sub">
                Tỷ trọng hoạt động chuyển đổi & TTS trong kỳ đã chọn
              </p>
            </div>
          </div>
          {data ? (
            <RankedBars items={data.creditMix} />
          ) : (
            <div className="admin-dash-chart-skel admin-dash-chart-skel-sm" aria-hidden />
          )}
        </article>
      </div>

      <div className="admin-dash-charts admin-dash-charts-2">
        <article className="admin-dash-card">
          <div className="admin-dash-card-head">
            <div>
              <h2 className="admin-dash-card-title">
                Lượt chuyển đổi PPTX / PDF → SCORM
              </h2>
              <p className="admin-dash-card-sub">Theo tuần — 8 tuần gần nhất</p>
            </div>
            <button
              type="button"
              className="admin-dash-toggle"
              onClick={() => setShowConvTable((v) => !v)}
            >
              {showConvTable ? "Xem biểu đồ" : "Xem dạng bảng"}
            </button>
          </div>
          {data ? (
            showConvTable ? (
              <ChartDataTable chart={data.conversions} colPrefix="Tuần" />
            ) : (
              <BarChart chart={data.conversions} />
            )
          ) : (
            <div className="admin-dash-chart-skel" aria-hidden />
          )}
        </article>

        <article className="admin-dash-card">
          <div className="admin-dash-card-head">
            <div>
              <h2 className="admin-dash-card-title">Phân bổ gói đăng ký</h2>
              <p className="admin-dash-card-sub">Tỷ lệ người dùng theo từng gói</p>
            </div>
          </div>
          {data ? (
            <RankedBars items={data.plans} />
          ) : (
            <div className="admin-dash-chart-skel admin-dash-chart-skel-sm" aria-hidden />
          )}
        </article>
      </div>

      <div className="admin-dash-tables">
        <article className="admin-dash-card">
          <div className="admin-dash-card-head">
            <div>
              <h2 className="admin-dash-card-title">Giao dịch gần đây</h2>
              <p className="admin-dash-card-sub">Nạp credit & đăng ký gói</p>
            </div>
          </div>
          <div className="admin-dash-table-wrap">
            <table className="admin-dash-list">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Loại giao dịch</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentTransactions.length ? (
                  data.recentTransactions.map((row, i) => (
                    <tr key={`${row.email}-${row.time}-${i}`}>
                      <td>
                        <div className="admin-dash-cell-user">{row.user}</div>
                        {row.email ? (
                          <div className="admin-dash-cell-sub">{row.email}</div>
                        ) : null}
                      </td>
                      <td>{row.type}</td>
                      <td className="admin-dash-amount">{row.amount}</td>
                      <td>
                        <span className={pillClass(row.statusKind)}>{row.status}</span>
                      </td>
                      <td className="admin-dash-time">{row.time}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="admin-dash-empty-cell">
                      {loading ? "Đang tải…" : "Chưa có giao dịch."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-dash-card">
          <div className="admin-dash-card-head">
            <div>
              <h2 className="admin-dash-card-title">Lượt chuyển đổi gần đây</h2>
              <p className="admin-dash-card-sub">
                File → SCORM, kèm giọng đọc AI (nếu có)
              </p>
            </div>
          </div>
          <div className="admin-dash-table-wrap">
            <table className="admin-dash-list">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>File</th>
                  <th>Giọng đọc AI</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentConversions.length ? (
                  data.recentConversions.map((row, i) => (
                    <tr key={`${row.file}-${row.time}-${i}`}>
                      <td>
                        <div className="admin-dash-cell-user">{row.user}</div>
                      </td>
                      <td>
                        <div className="admin-dash-cell-user">{row.file}</div>
                        <div className="admin-dash-cell-sub">→ SCORM</div>
                      </td>
                      <td>{row.tts}</td>
                      <td>
                        <span className={pillClass(row.statusKind)}>{row.status}</span>
                      </td>
                      <td className="admin-dash-time">{row.time}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="admin-dash-empty-cell">
                      {loading ? "Đang tải…" : "Chưa có lượt chuyển đổi."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}

function placeholders(): AdminOverviewPayload["kpis"] {
  return [
    { id: "users", label: "Tổng người dùng", value: "…", delta: "0%", up: true, spark: [0, 0] },
    { id: "active", label: "Người dùng hoạt động (30N)", value: "…", delta: "0%", up: true, spark: [0, 0] },
    { id: "conversions", label: "Lượt chuyển đổi (30N)", value: "…", delta: "0%", up: true, spark: [0, 0] },
    { id: "success", label: "Tỷ lệ chuyển đổi thành công", value: "…", delta: "0đ", up: true, spark: [0, 0] },
    { id: "tts", label: "Lượt gọi API giọng đọc AI", value: "…", delta: "0%", up: true, spark: [0, 0] },
    { id: "revenue", label: "Doanh thu kỳ này", value: "…", delta: "0%", up: true, spark: [0, 0] },
  ];
}

function statusPlaceholders(): AdminOverviewPayload["statuses"] {
  return [
    { name: "Dịch vụ chuyển đổi SCORM", state: "…", level: "good" },
    { name: "API giọng đọc AI (Text-to-Audio)", state: "…", level: "good" },
    { name: "Cổng thanh toán PayOS", state: "…", level: "good" },
    { name: "Email OTP", state: "…", level: "good" },
  ];
}
