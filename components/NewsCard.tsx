"use client";

import { useEffect, useState } from "react";
import { useCollapse } from "./useCollapse";

type News = { title: string; link: string; source: string; pubDate: string };

export default function NewsCard() {
  const { collapsed, toggle } = useCollapse("news");
  const [tab, setTab] = useState<"google" | "naver">("google");
  const [query, setQuery] = useState("경제");
  const [input, setInput] = useState("경제");
  const [news, setNews] = useState<News[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setNews(null);
    setErr(false);
    const url = tab === "google" ? "/api/news/google" : `/api/news/naver?q=${encodeURIComponent(query)}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setNews(d.news))
      .catch(() => setErr(true));
  }, [tab, query]);

  const rel = (d: string) => {
    const t = new Date(d).getTime();
    if (!t) return "";
    const m = Math.floor((Date.now() - t) / 60000);
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  };

  return (
    <section className="card band-slate">
      <div className="card-head">
        <span className="material-icons-round">newspaper</span>
        <span className="card-title">뉴스</span>
              <button className="collapse-btn" onClick={toggle} aria-label={collapsed ? "펼치기" : "접기"}>
          <span className="material-icons-round">{collapsed ? "expand_more" : "expand_less"}</span>
        </button>
      </div>

      {!collapsed && (
      <div className="card-body">
      <div className="news-tabs">
        <button className={`news-tab${tab === "google" ? " active" : ""}`} onClick={() => setTab("google")}>
          구글 헤드라인
        </button>
        <button className={`news-tab${tab === "naver" ? " active" : ""}`} onClick={() => setTab("naver")}>
          네이버 검색
        </button>
      </div>
      {tab === "naver" && (
        <div className="news-search">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setQuery(input.trim() || "경제")}
            placeholder="검색어 후 Enter"
            aria-label="뉴스 검색어"
          />
        </div>
      )}
      {err && <p className="empty">{tab === "naver" ? "네이버 API 키를 확인해 주세요 (.env)" : "뉴스를 불러오지 못했어요."}</p>}
      {!err && !news && (<><div className="skeleton" /><div className="skeleton" style={{ width: "85%" }} /><div className="skeleton" style={{ width: "60%" }} /></>)}
      {news?.map((n, i) => (
        <a key={i} className="news-item" href={n.link} target="_blank" rel="noreferrer">
          <div className="news-title">{n.title}</div>
          <div className="news-meta">
            {n.source && `${n.source} · `}{rel(n.pubDate)}
          </div>
        </a>
      ))}
    </div>
      )}
    </section>
  );
}
