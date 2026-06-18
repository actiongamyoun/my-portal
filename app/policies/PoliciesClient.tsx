"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { POLICY_CATEGORIES, CATEGORY_LIST, timeAgo } from "@/components/policyCategories";
import { shareItem } from "@/components/share";

type Policy = {
  id: number; title: string; summary: string | null;
  ministry: string | null; category: string | null; url: string; published_at: string | null;
};

const dayKey = (iso: string | null) => {
  if (!iso) return "날짜 미상";
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });
};

export default function PoliciesClient() {
  const [category, setCategory] = useState("전체");
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const doShare = async (e: React.MouseEvent, title: string, url: string, summary?: string) => {
    e.preventDefault(); e.stopPropagation();
    const r = await shareItem(title, url, summary);
    if (r === "copied") { setShareMsg("링크 복사됨"); setTimeout(() => setShareMsg(""), 1500); }
  };
  const offsetRef = useRef(0);

  const fetchPage = useCallback(async (reset: boolean) => {
    setLoading(true);
    const offset = reset ? 0 : offsetRef.current;
    const params = new URLSearchParams({ category, q: submitted, offset: String(offset), limit: "20" });
    try {
      const r = await fetch(`/api/policies/list?${params}&t=${Date.now()}`, { cache: "no-store" });
      const d = await r.json();
      const next = d.policies ?? [];
      setPolicies((prev) => (reset ? next : [...prev, ...next]));
      setTotal(d.total ?? 0);
      offsetRef.current = offset + next.length;
    } catch {
      if (reset) setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [category, submitted]);

  useEffect(() => { offsetRef.current = 0; fetchPage(true); }, [fetchPage]);

  // 날짜별 그룹핑
  const groups: { day: string; items: Policy[] }[] = [];
  for (const p of policies) {
    const k = dayKey(p.published_at);
    const last = groups[groups.length - 1];
    if (last && last.day === k) last.items.push(p);
    else groups.push({ day: k, items: [p] });
  }

  return (
    <main className="pol-page">
      <div className="pol-top">
        <Link href="/" className="pol-back"><span className="material-icons-round">arrow_back</span> 포탈</Link>
      </div>
      <h1 className="pol-h">⚖️ 정책 아카이브</h1>
      <p className="pol-sub">정부 정책·보도자료를 사실 그대로 기록합니다 · 매일 자동 수집{total ? ` · 총 ${total.toLocaleString()}건` : ""}</p>

      <div className="pol-search">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSubmitted(q.trim())}
          placeholder="정책 검색 (예: 청년, 부동산, 전기요금)"
        />
        <button onClick={() => setSubmitted(q.trim())}>검색</button>
      </div>

      <div className="pol-cats">
        {["전체", ...CATEGORY_LIST].map((c) => {
          const meta = POLICY_CATEGORIES[c];
          return (
            <button key={c} className={`pol-cat${category === c ? " on" : ""}`} onClick={() => setCategory(c)}>
              {meta && <span className="material-icons-round" style={{ color: category === c ? "#fff" : meta.color }}>{meta.icon}</span>}
              {c}
            </button>
          );
        })}
      </div>

      {groups.map((g) => (
        <div key={g.day}>
          <div className="pol-day">{g.day}</div>
          {g.items.map((p) => {
            const meta = POLICY_CATEGORIES[p.category ?? "기타"] ?? POLICY_CATEGORIES["기타"];
            const open = openId === p.id;
            return (
              <div key={p.id} className="pol-item" onClick={() => setOpenId(open ? null : p.id)}>
                <span className="material-icons-round pol-ic" style={{ color: meta.color }}>{meta.icon}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="pol-title">
                    {p.title}
                    <span className="pol-badge" style={{ background: meta.color + "1a", color: meta.color }}>{p.category ?? "기타"}</span>
                  </div>
                  <div className="pol-meta">{p.ministry ?? "정부"} · {timeAgo(p.published_at)}</div>
                  {open && (
                    <div className="pol-summary">
                      {p.summary ? `${meta.emoji} ${p.summary}` : "요약이 아직 없어요."}
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="policy-link" onClick={(e) => e.stopPropagation()}>원문 보기 ↗</a>
                      <button className="policy-share" onClick={(e) => doShare(e, p.title, p.url, p.summary ?? undefined)}>공유하기 ↗</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {loading && <div className="pol-loading">불러오는 중…</div>}
      {!loading && policies.length === 0 && <p className="pol-empty">해당하는 정책이 없어요.</p>}
      {!loading && policies.length < total && (
        <button className="pol-more" onClick={() => fetchPage(false)}>더보기 ({policies.length}/{total})</button>
      )}
      {shareMsg && <div className="share-toast">{shareMsg}</div>}
    </main>
  );
}
