"use client";

import { useEffect, useState } from "react";

const KEY = "portal.briefing.v1";

export default function BriefingCard() {
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
      const [cal, gm, nw] = await Promise.all([
        fetch("/api/calendar").then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
        fetch("/api/gmail").then((r) => (r.ok ? r.json() : { messages: [] })).catch(() => ({ messages: [] })),
        fetch("/api/news/google").then((r) => (r.ok ? r.json() : { news: [] })).catch(() => ({ news: [] })),
      ]);
      const r = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: cal.events ?? [],
          mails: (gm.messages ?? []).map((m: Record<string, string>) => ({ from: m.from, subject: m.subject })),
          news: (nw.news ?? []).map((n: Record<string, string>) => n.title),
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
    <section className="card tick-signal">
      <div className="card-head">
        <span className="material-icons-round" style={{ color: "var(--signal)" }}>auto_awesome</span>
        <span className="card-title">AI 브리핑</span>
        {at && <span className="memo-saved" style={{ margin: 0 }}>{at} 생성</span>}
      </div>

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
    </section>
  );
}
