"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { POLICY_CATEGORIES } from "./policyCategories";
import { shareItem } from "./share";
import { useCollapse } from "./useCollapse";

type News = { title: string; link: string; source: string; pubDate: string };
type Policy = { id: number; title: string; summary: string | null; ministry: string | null; category: string | null; url: string; published_at: string | null };

type TabId = "google" | "naver" | "ai" | "ship" | "policy";

// 고정 키워드 탭: 네이버 검색을 미리 정한 쿼리로 호출
const PRESET_QUERY: Record<string, string> = {
  ai: "AI 인공지능 OR 생성형AI OR 챗GPT",
  ship: "조선업 OR 조선소 OR 선박수주 OR 선박도장",
};


export default function NewsCard() {
  const { collapsed, toggle } = useCollapse("news");
  const [tab, setTab] = useState<TabId>("google");
  const [query, setQuery] = useState("경제");
  const [input, setInput] = useState("경제");
  const [news, setNews] = useState<News[] | null>(null);
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const doShare = async (e: React.MouseEvent, title: string, url: string, summary?: string) => {
    e.preventDefault(); e.stopPropagation();
    const r = await shareItem(title, url, summary);
    if (r === "copied") { setShareMsg("링크 복사됨"); setTimeout(() => setShareMsg(""), 1500); }
  };
  const [err, setErr] = useState(false);

  useEffect(() => {
    setErr(false);
    if (tab === "policy") {
      setPolicies(null);
      fetch(`/api/policies?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setPolicies(d.policies))
        .catch(() => setErr(true));
      return;
    }
    setNews(null);
    let url: string;
    if (tab === "google") url = "/api/news/google";
    else if (tab === "naver") url = `/api/news/search?q=${encodeURIComponent(query)}`;
    else url = `/api/news/search?q=${encodeURIComponent(PRESET_QUERY[tab] ?? "")}`;
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
          뉴스 헤드라인
        </button>
        <button className={`news-tab${tab === "naver" ? " active" : ""}`} onClick={() => setTab("naver")}>
          네이버 검색
        </button>
        <button className={`news-tab${tab === "ai" ? " active" : ""}`} onClick={() => setTab("ai")}>
          <span className="material-icons-round" style={{ fontSize: 13, verticalAlign: "-2px" }}>smart_toy</span> AI
        </button>
        <button className={`news-tab${tab === "ship" ? " active" : ""}`} onClick={() => setTab("ship")}>
          <span className="material-icons-round" style={{ fontSize: 13, verticalAlign: "-2px" }}>directions_boat</span> 조선·선박
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
      {err && <p className="empty">{tab === "policy" ? "정책 데이터를 불러오지 못했어요. Supabase 설정을 확인해 주세요." : tab === "naver" ? "검색 결과를 불러오지 못했어요. 다른 키워드로 시도해 보세요." : "뉴스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."}</p>}
      {!err && tab !== "policy" && !news && (<><div className="skeleton" /><div className="skeleton" style={{ width: "85%" }} /><div className="skeleton" style={{ width: "60%" }} /></>)}
      {!err && tab === "policy" && !policies && (<><div className="skeleton" /><div className="skeleton" style={{ width: "85%" }} /></>)}
      {tab === "policy" && policies?.length === 0 && <p className="empty">아직 수집된 정책이 없어요. 수집기가 첫 실행되면 채워집니다.</p>}
      {tab === "policy" && policies?.map((p) => {
        const c = POLICY_CATEGORIES[p.category ?? "기타"] ?? POLICY_CATEGORIES["기타"];
        const open = openId === p.id;
        return (
          <div key={p.id} className="news-item policy-item" onClick={() => setOpenId(open ? null : p.id)} style={{ cursor: "pointer" }}>
            <span className="material-icons-round policy-icon" style={{ color: c.color }}>{c.icon}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="news-title">{p.title}</span>
              <span className="news-meta" style={{ display: "block" }}>{p.ministry ?? "정부"} · {rel(p.published_at ?? "")}</span>
              {open && (
                <span className="policy-summary">
                  {p.summary ? `${c.emoji} ${p.summary}` : "요약이 아직 없어요."}
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="policy-link" onClick={(e) => e.stopPropagation()}>원문 보기 ↗</a>
                  <button className="policy-share" onClick={(e) => doShare(e, p.title, p.url, p.summary ?? undefined)}>공유하기 ↗</button>
                </span>
              )}
            </span>
          </div>
        );
      })}
      {shareMsg && <div className="share-toast">{shareMsg}</div>}
      {tab === "policy" && policies && policies.length > 0 && (
        <Link href="/policies" className="policy-all">정책 아카이브 전체 보기 →</Link>
      )}
      {tab !== "policy" && news?.map((n, i) => (
        <a key={i} className="news-item" href={n.link} target="_blank" rel="noreferrer">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="news-title">{n.title}</div>
            <div className="news-meta">
              {n.source && `${n.source} · `}{rel(n.pubDate)}
            </div>
          </div>
          <button className="share-btn" onClick={(e) => doShare(e, n.title, n.link)} aria-label="공유">
            <span className="material-icons-round">ios_share</span>
          </button>
        </a>
      ))}
    </div>
      )}
    </section>
  );
}
