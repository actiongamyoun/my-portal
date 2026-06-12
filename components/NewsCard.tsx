"use client";

import { useEffect, useState } from "react";
import { useCollapse } from "./useCollapse";

type News = { title: string; link: string; source: string; pubDate: string };
type Policy = { id: number; title: string; ministry: string | null; category: string | null; url: string; published_at: string | null };

const POLICY_CATEGORIES: Record<string, { icon: string; color: string }> = {
  "경제·금융":     { icon: "account_balance",    color: "#166F5B" },
  "부동산":        { icon: "apartment",          color: "#A0522D" },
  "산업·과학기술": { icon: "science",            color: "#2D5BA8" },
  "외교·안보":     { icon: "public",             color: "#6B4FA0" },
  "에너지·환경":   { icon: "bolt",               color: "#3F7A33" },
  "사회·복지":     { icon: "volunteer_activism", color: "#B23A5E" },
  "행정·정치":     { icon: "gavel",              color: "#5A6470" },
  "기타":          { icon: "category",           color: "#7A7568" },
};

export default function NewsCard() {
  const { collapsed, toggle } = useCollapse("news");
  const [tab, setTab] = useState<"google" | "naver" | "policy">("google");
  const [query, setQuery] = useState("경제");
  const [input, setInput] = useState("경제");
  const [news, setNews] = useState<News[] | null>(null);
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setErr(false);
    if (tab === "policy") {
      setPolicies(null);
      fetch("/api/policies")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setPolicies(d.policies))
        .catch(() => setErr(true));
      return;
    }
    setNews(null);
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
        <button className={`news-tab${tab === "policy" ? " active" : ""}`} onClick={() => setTab("policy")}>
          <span className="material-icons-round" style={{ fontSize: 13, verticalAlign: "-2px" }}>gavel</span> 정책
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
      {err && <p className="empty">{tab === "naver" ? "네이버 API 키를 확인해 주세요 (.env)" : tab === "policy" ? "정책 데이터를 불러오지 못했어요. Supabase 설정을 확인해 주세요." : "뉴스를 불러오지 못했어요."}</p>}
      {!err && tab !== "policy" && !news && (<><div className="skeleton" /><div className="skeleton" style={{ width: "85%" }} /><div className="skeleton" style={{ width: "60%" }} /></>)}
      {!err && tab === "policy" && !policies && (<><div className="skeleton" /><div className="skeleton" style={{ width: "85%" }} /></>)}
      {tab === "policy" && policies?.length === 0 && <p className="empty">아직 수집된 정책이 없어요. 수집기가 첫 실행되면 채워집니다.</p>}
      {tab === "policy" && policies?.map((p) => {
        const c = POLICY_CATEGORIES[p.category ?? "기타"] ?? POLICY_CATEGORIES["기타"];
        return (
          <a key={p.id} className="news-item policy-item" href={p.url} target="_blank" rel="noopener noreferrer">
            <span className="material-icons-round policy-icon" style={{ color: c.color }}>{c.icon}</span>
            <span style={{ minWidth: 0 }}>
              <span className="news-title">{p.title}</span>
              <span className="news-meta" style={{ display: "block" }}>{p.ministry ?? "정부"} · {rel(p.published_at ?? "")}</span>
            </span>
          </a>
        );
      })}
      {tab !== "policy" && news?.map((n, i) => (
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
