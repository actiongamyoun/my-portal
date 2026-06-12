"use client";

import { useCallback, useEffect, useState } from "react";

type Quote = {
  input: string;
  name?: string;
  price?: number;
  change?: number;
  changePct?: number;
  error?: boolean;
};

const INDICES = [
  { symbol: "^KS11", label: "코스피" },
  { symbol: "^KQ11", label: "코스닥" },
  { symbol: "^IXIC", label: "나스닥" },
  { symbol: "^GSPC", label: "S&P 500" },
];
const KEY = "portal.watchlist.v1";

function fmt(n: number, krw: boolean) {
  return n.toLocaleString("ko-KR", {
    minimumFractionDigits: krw ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export default function StocksCard() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try { setWatchlist(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(watchlist));
  }, [watchlist, loaded]);

  const load = useCallback(() => {
    if (!loaded) return;
    const symbols = [...INDICES.map((i) => i.symbol), ...watchlist];
    fetch(`/api/stocks?symbols=${encodeURIComponent(symbols.join(","))}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setQuotes(d.quotes))
      .catch(() => setQuotes([]));
  }, [loaded, watchlist]);

  useEffect(() => { load(); }, [load]);

  const add = () => {
    const v = input.trim().toUpperCase();
    if (!v || watchlist.includes(v)) return;
    setWatchlist((p) => [...p, v]);
    setInput("");
  };

  const byInput = (s: string) => quotes?.find((q) => q.input === s);

  const Row = ({ label, q }: { label: string; q?: Quote }) => {
    const up = (q?.change ?? 0) > 0;
    const down = (q?.change ?? 0) < 0;
    const krw = !q?.input?.startsWith("^") || q?.input === "^KS11" || q?.input === "^KQ11";
    return (
      <div className="stock-row">
        <span className="stock-name">{label}</span>
        {q && !q.error && q.price != null ? (
          <>
            <span className="stock-price">{fmt(q.price, krw)}</span>
            <span className={`stock-chg ${up ? "up" : down ? "down" : "flat"}`}>
              {up ? "▲" : down ? "▼" : "–"} {Math.abs(q.changePct ?? 0).toFixed(2)}%
            </span>
          </>
        ) : (
          <span className="stock-chg flat">{quotes ? "조회 실패" : "…"}</span>
        )}
        {editing && q && (
          <button
            className="del"
            onClick={() => setWatchlist((p) => p.filter((x) => x !== q.input))}
            aria-label={`${label} 삭제`}
            style={{ display: "inline-flex" }}
          >
            <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <section className="card band-violet">
      <div className="card-head">
        <span className="material-icons-round">trending_up</span>
        <span className="card-title">시세</span>
        <button className="text-btn" onClick={load} aria-label="새로고침" style={{ marginRight: 8 }}>
          <span className="material-icons-round" style={{ fontSize: 16 }}>refresh</span>
        </button>
        <button className="text-btn" onClick={() => setEditing((v) => !v)}>
          {editing ? "완료" : "편집"}
        </button>
      </div>

      <div className="card-body">

      {INDICES.map((i) => (
        <Row key={i.symbol} label={i.label} q={byInput(i.symbol)} />
      ))}

      {watchlist.length > 0 && <div className="stock-divider">관심종목</div>}
      {watchlist.map((s) => {
        const q = byInput(s);
        return <Row key={s} label={q?.name ?? s} q={q ?? { input: s }} />;
      })}

      {editing && (
        <div className="todo-input-row" style={{ marginTop: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="종목코드 6자리 또는 심볼 (예: 005930, AAPL)"
            aria-label="관심종목 추가"
          />
          <button className="icon-btn" onClick={add} aria-label="추가">
            <span className="material-icons-round">add</span>
          </button>
        </div>
      )}
      <div className="stock-note">야후 파이낸스 · 지연 시세</div>
    </div>
    </section>
  );
}
