"use client";

import { useEffect, useState } from "react";
import { useCollapse } from "./useCollapse";

const KEY = "portal.briefing.v1";

export default function BriefingCard() {
  const { collapsed, toggle } = useCollapse("briefing");
  const [text, setText] = useState("");
  const [at, setAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (saved) { setText(saved.text); setAt(saved.at); }
    } catch {}
  }, []);

  const generate = async () => {
    setLoading(true);
    setErr("");
    try {
      // 이미 떠 있는 위젯들과 같은 데이터를 수집
      const [cal, gm, nw, rn] = await Promise.all([
        fetch("/api/calendar").then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
        fetch("/api/gmail").then((r) => (r.ok ? r.json() : { messages: [] })).catch(() => ({ messages: [] })),
        fetch("/api/news/google").then((r) => (r.ok ? r.json() : { news: [] })).catch(() => ({ news: [] })),
        fetch("/api/runs").then((r) => (r.ok ? r.json() : { runs: [] })).catch(() => ({ runs: [] })),
      ]);
      const r = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: cal.events ?? [],
          mails: (gm.messages ?? []).map((m: Record<string, string>) => ({ from: m.from, subject: m.subject })),
          news: (nw.news ?? []).map((n: Record<string, string>) => n.title),
          runs: (rn.runs ?? []).slice(0, 5).map((r: Record<string, unknown>) => ({
            date: r.run_date, km: r.distance_km, pace: r.pace, hr: r.avg_hr,
          })),
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error === "no-key" ? "no-key" : "fetch");
      }
      const d = await r.json();
      const now = new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(new Date());
      setText(d.briefing);
      setAt(now);
      localStorage.setItem(KEY, JSON.stringify({ text: d.briefing, at: now }));
    } catch (e) {
      setErr(
        (e as Error).message === "no-key"
          ? "Vercel 환경변수에 ANTHROPIC_API_KEY를 추가해 주세요."
          : "브리핑 생성에 실패했어요. 잠시 후 다시 시도해 주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card band-orange">
      <div className="card-head">
        <span className="material-icons-round">auto_awesome</span>
        <span className="card-title">AI 브리핑</span>
        {at && <span className="memo-saved" style={{ margin: 0 }}>{at} 생성</span>}
              <button className="collapse-btn" onClick={toggle} aria-label={collapsed ? "펼치기" : "접기"}>
          <span className="material-icons-round">{collapsed ? "expand_more" : "expand_less"}</span>
        </button>
      </div>

      {!collapsed && (
      <div className="card-body">

      {text && <p className="briefing-text">{text}</p>}
      {!text && !loading && (
        <p className="empty">버튼을 누르면 일정·메일·뉴스를 종합해 오늘의 브리핑을 만들어 드려요.</p>
      )}
      {err && <p className="empty" style={{ color: "var(--signal)" }}>{err}</p>}

      <button className="briefing-btn" onClick={generate} disabled={loading}>
        <span className="material-icons-round" style={{ fontSize: 18 }}>
          {loading ? "hourglass_top" : "auto_awesome"}
        </span>
        {loading ? "비서가 정리하는 중…" : text ? "브리핑 다시 생성" : "오늘 브리핑 생성"}
      </button>
    </div>
      )}
    </section>
  );
}
