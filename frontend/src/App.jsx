import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./app.css";

function categoriseWait(waitType) {
  if (!waitType) return null;
  const CPU = ["SOS_SCHEDULER_YIELD", "CXPACKET", "CXCONSUMER", "THREADPOOL"];
  const IO = ["WRITELOG", "ASYNC_IO_COMPLETION", "IO_COMPLETION", "NETWORK_IO"];
  const MEM = [
    "RESOURCE_SEMAPHORE",
    "RESOURCE_SEMAPHORE_QUERY_COMPILE",
    "CMEMTHREAD",
    "SOS_MEMORY_TOPLEVELBLOCKALLOCATOR",
  ];
  if (CPU.includes(waitType)) return "CPU";
  if (IO.includes(waitType) || waitType.startsWith("PAGEIOLATCH")) return "IO";
  if (MEM.includes(waitType)) return "Memory";
  return "Other";
}

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function msToHms(ms) {
  const totalSec = Math.floor((ms || 0) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}

const COLORS = {
  CPU: "#4F46E5",
  IO: "#06B6D4",
  Memory: "#F59E0B",
  Other: "#9CA3AF",
};

export default function App() {
  const [stats, setStats] = useState([]);
  const [requests, setRequests] = useState([]);
  const [lastTs, setLastTs] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    setErr("");
    try {
      setLoading(true);

      const [waitRes, reqRes] = await Promise.all([
        fetch("/api/wait-stats"),
        fetch("/api/active-requests"),
      ]);

      if (!waitRes.ok) throw new Error(`wait-stats HTTP ${waitRes.status}`);
      if (!reqRes.ok) throw new Error(`active-requests HTTP ${reqRes.status}`);

      const waitJson = await waitRes.json();
      const reqJson = await reqRes.json();

      if (!waitJson?.ok) throw new Error(`wait-stats returned ok=false`);
      if (!reqJson?.ok) throw new Error(`active-requests returned ok=false`);

      const mappedStats = waitJson.data.map((r) => ({
        wait_type: r.wait_type,
        category: r.category ?? categoriseWait(r.wait_type),
        tasks: r.tasks,
        wait_ms: r.wait_time_ms,
        signal_ms: r.signal_wait_time_ms,
        resource_ms: r.resource_wait_time_ms,
        max_ms: r.max_wait_time_ms,
        avg_ms: Math.round(r.avg_wait_ms),
      }));

      const mappedReq = reqJson.data.map((r) => ({
        sid: r.session_id,
        status: r.status,
        wait_type: r.wait_type,
        category: categoriseWait(r.wait_type),
        wait_ms: r.wait_ms,
        cpu_ms: r.cpu_ms,
        reads: r.logical_reads,
        cmd: r.command,
        db: r.db_name,
        blocking: r.blocking_session_id,
      }));

      setStats(mappedStats);
      setRequests(mappedReq);
      setLastTs(fmtTime(new Date()));
    } catch (e) {
      console.error(e);
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  // --- Derived data for visuals ---
  const kpis = useMemo(() => {
    const totalWaitMs = stats.reduce((a, r) => a + (r.wait_ms || 0), 0);
    const worstAvg = stats.reduce((max, r) => (r.avg_ms > max.avg_ms ? r : max), { avg_ms: 0 });
    const topWait = stats[0]?.wait_type ?? "—";
    return {
      totalWaitMs,
      topWait,
      activeReqCount: requests.length,
      worstAvgWaitType: worstAvg.wait_type ?? "—",
      worstAvgMs: worstAvg.avg_ms ?? 0,
    };
  }, [stats, requests]);

  const waitByCategory = useMemo(() => {
    const agg = new Map();
    for (const r of stats) {
      const cat = r.category || "Other";
      agg.set(cat, (agg.get(cat) || 0) + (r.wait_ms || 0));
    }
    return Array.from(agg.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  const topWaitTypes = useMemo(() => {
    return stats
      .slice()
      .sort((a, b) => (b.wait_ms || 0) - (a.wait_ms || 0))
      .slice(0, 12)
      .map((r) => ({
        wait_type: r.wait_type,
        wait_ms: r.wait_ms,
        avg_ms: r.avg_ms,
        category: r.category,
      }));
  }, [stats]);

  const containerStyle = {
    minHeight: "100vh",
    background: "#0B1020",
    color: "#E5E7EB",
    fontFamily: "Segoe UI, Arial, sans-serif",
  };

  const cardStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12,
    padding: 16,
  };

  const gridStyle = {
    display: "grid",
    gap: 16,
  };

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>SQL Wait Dashboard</h1>
            <div style={{ opacity: 0.75, marginTop: 6 }}>
              Last refresh: {lastTs || "—"} {loading ? " • loading…" : ""}
            </div>
          </div>
          <button
            onClick={refresh}
            style={{
              background: "#4F46E5",
              color: "white",
              border: 0,
              padding: "10px 14px",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Refresh now
          </button>
        </div>

        {err && (
          <div style={{ ...cardStyle, marginTop: 16, borderColor: "rgba(239,68,68,0.6)" }}>
            <strong style={{ color: "#FCA5A5" }}>Error:</strong> {err}
            <div style={{ opacity: 0.8, marginTop: 6 }}>
              Tip: verify the backend is healthy at <code>http://localhost:3001/api/health</code>. [1](https://v3.vitejs.dev/guide/)
            </div>
          </div>
        )}

        {/* KPI Row */}
        <div style={{ ...gridStyle, gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 18 }}>
          <div style={cardStyle}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Total Wait Time</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{msToHms(kpis.totalWaitMs)}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Top Wait Type</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{kpis.topWait}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Active Requests</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{kpis.activeReqCount}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Worst Avg Wait</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
              {kpis.worstAvgWaitType}
            </div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>{kpis.worstAvgMs} ms</div>
          </div>
        </div>

        {/* Charts */}
        <div style={{ ...gridStyle, gridTemplateColumns: "1fr 1.2fr", marginTop: 16 }}>
          {/* Donut / Pie */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Wait Time by Category</div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={waitByCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {waitByCategory.map((entry) => (
                      <Cell key={entry.name} fill={COLORS[entry.name] || COLORS.Other} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => msToHms(value)}
                    contentStyle={{ background: "#111827", border: "1px solid #374151" }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top waits bar chart */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Top Wait Types (by total wait time)</div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={topWaitTypes} margin={{ top: 10, right: 16, left: 0, bottom: 30 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="wait_type"
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={70}
                    tick={{ fill: "#CBD5E1", fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: "#CBD5E1", fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) =>
                      name === "wait_ms" ? msToHms(value) : value
                    }
                    contentStyle={{ background: "#111827", border: "1px solid #374151" }}
                  />
                  <Bar dataKey="wait_ms" fill="#06B6D4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Active Requests Table */}
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Active Requests</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.85 }}>
                  <th style={{ padding: "8px 10px" }}>SID</th>
                  <th style={{ padding: "8px 10px" }}>DB</th>
                  <th style={{ padding: "8px 10px" }}>Status</th>
                  <th style={{ padding: "8px 10px" }}>Wait Type</th>
                  <th style={{ padding: "8px 10px" }}>Category</th>
                  <th style={{ padding: "8px 10px" }}>Wait</th>
                  <th style={{ padding: "8px 10px" }}>CPU</th>
                  <th style={{ padding: "8px 10px" }}>Reads</th>
                  <th style={{ padding: "8px 10px" }}>Blocking</th>
                </tr>
              </thead>
              <tbody>
                {requests.slice(0, 25).map((r) => (
                  <tr key={r.sid} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: "8px 10px" }}>{r.sid}</td>
                    <td style={{ padding: "8px 10px" }}>{r.db}</td>
                    <td style={{ padding: "8px 10px" }}>{r.status}</td>
                    <td style={{ padding: "8px 10px" }}>{r.wait_type || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.10)",
                        }}
                      >
                        {r.category || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px" }}>{msToHms(r.wait_ms)}</td>
                    <td style={{ padding: "8px 10px" }}>{msToHms(r.cpu_ms)}</td>
                    <td style={{ padding: "8px 10px" }}>{r.reads}</td>
                    <td style={{ padding: "8px 10px" }}>{r.blocking ?? "—"}</td>
                  </tr>
                ))}
                {requests.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} style={{ padding: 12, opacity: 0.8 }}>
                      No active requests returned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
            Showing up to 25 rows.
          </div>
        </div>
      </div>
    </div>
  );
}