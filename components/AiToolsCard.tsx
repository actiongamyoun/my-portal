"use client";

import { useEffect, useState } from "react";
import { useCollapse } from "./useCollapse";

type Tool = { id: number; name: string; url: string; color: string; short: string };
const KEY = "portal.aitools.v1";

// 프리셋: 브랜드 컬러 + 약자(아이콘 폰트 없이 텍스트 배지)
const PRESETS: { name: string; url: string; color: string; short: string }[] = [
  { name: "Claude",     url: "https://claude.ai",                  color: "#d97757", short: "Cl" },
  { name: "ChatGPT",    url: "https://chatgpt.com",                color: "#10a37f", short: "GPT" },
  { name: "Gemini",     url: "https://gemini.google.com",          color: "#4285f4", short: "Ge" },
  { name: "Perplexity", url: "https://perplexity.ai",              color: "#20808d", short: "Px" },
  { name: "Grok",       url: "https://grok.com",                   color: "#1d1d1f", short: "Gr" },
  { name: "Copilot",    url: "https://copilot.microsoft.com",      color: "#0a6ed1", short: "Co" },
];

export default function AiToolsCard() {
  const { collapsed, toggle } = useCollapse("aitools");
  const [tools, setTools] = useState<Tool[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // 첫 방문: Claude/ChatGPT/Gemini 기본 세팅
      setTools(saved ? JSON.parse(saved) : PRESETS.slice(0, 3).map((p, i) => ({ id: i + 1, ...p })));
    } catch {
      setTools(PRESETS.slice(0, 3).map((p, i) => ({ id: i + 1, ...p })));
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(tools));
  }, [tools, loaded]);

  const has = (u: string) => tools.some((t) => t.url.replace(/\/$/, "") === u.replace(/\/$/, ""));

  const addPreset = (p: typeof PRESETS[number]) => {
    if (has(p.url)) return;
    setTools((prev) => [...prev, { id: Date.now(), ...p }]);
  };

  const addCustom = () => {
    const n = name.trim();
    let u = url.trim();
    if (!n || !u) return;
    if (!/^https?:\/\//.test(u)) u = "https://" + u;
    const color = "#6c63d6";
    setTools((prev) => [...prev, { id: Date.now(), name: n, url: u, color, short: n.slice(0, 2) }]);
    setName(""); setUrl(""); setAdding(false);
  };

  const remove = (id: number) => setTools((prev) => prev.filter((t) => t.id !== id));

  return (
    <section className="card band-indigo">
      <div className="card-head">
        <span className="material-icons-round">smart_toy</span>
        <span className="card-title">AI 도구함</span>
        <button className="collapse-btn" onClick={toggle} aria-label={collapsed ? "펼치기" : "접기"}>
          <span className="material-icons-round">{collapsed ? "expand_more" : "expand_less"}</span>
        </button>
      </div>

      {!collapsed && (
      <div className="card-body">
        {/* 내 AI 도구 그리드 */}
        <div className="ai-grid">
          {tools.map((t) => (
            <a key={t.id} className="ai-tile" href={t.url} target="_blank" rel="noopener noreferrer">
              <span className="ai-badge" style={{ background: t.color }}>{t.short}</span>
              <span className="ai-name">{t.name}</span>
              <button
                className="ai-del"
                onClick={(e) => { e.preventDefault(); remove(t.id); }}
                aria-label={`${t.name} 삭제`}
              >
                <span className="material-icons-round" style={{ fontSize: 14 }}>close</span>
              </button>
            </a>
          ))}
        </div>

        {/* 프리셋 빠른 추가 */}
        <div className="ai-presets">
          <div className="ai-presets-label">빠른 추가</div>
          <div className="ai-preset-row">
            {PRESETS.map((p) => {
              const added = has(p.url);
              return (
                <button
                  key={p.name}
                  className={`ai-chip${added ? " added" : ""}`}
                  onClick={() => addPreset(p)}
                  disabled={added}
                  title={added ? "이미 추가됨" : `${p.name} 추가`}
                >
                  <span className="ai-chip-dot" style={{ background: p.color }} />
                  {p.name}
                  {added && <span className="material-icons-round" style={{ fontSize: 13 }}>check</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 직접 추가 */}
        {adding ? (
          <div className="app-add-form">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" aria-label="AI 도구 이름" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" aria-label="AI 도구 URL" onKeyDown={(e) => e.key === "Enter" && addCustom()} />
            <button className="text-btn" onClick={addCustom}>추가하기</button>
          </div>
        ) : (
          <div style={{ marginTop: 8, textAlign: "center" }}>
            <button className="text-btn" onClick={() => setAdding(true)}>+ 직접 추가</button>
          </div>
        )}
      </div>
      )}
    </section>
  );
}
