"use client";

import { useEffect, useState } from "react";
import { useCollapse } from "./useCollapse";
import { useSyncedState } from "./useSyncedState";

type Health = Record<string, boolean>;
type App = { id: number; name: string; url: string; icon: string; color?: string };

const SEED: App[] = [
  { id: 1, name: "MATHLAND 5", url: "https://mathland5.vercel.app", icon: "calculate", color: "#0f5e9c" },
  { id: 2, name: "사장님 ERP", url: "https://sazangnym-erp.vercel.app", icon: "storefront", color: "#0f9c6e" },
  { id: 3, name: "비밀고백", url: "https://gohaeseongsa.vercel.app", icon: "favorite", color: "#d94335" },
  { id: 4, name: "우리동네상가", url: "https://sang-ga.vercel.app", icon: "location_city", color: "#0e8c9c" },
  { id: 5, name: "PSP REPORT", url: "https://psp-inspection.vercel.app", icon: "fact_check", color: "#5b53d4" },
  { id: 6, name: "이슬점 계산기", url: "https://humidity-dew.vercel.app", icon: "water_drop", color: "#0f5e9c" },
];

// 아이콘 팔레트
const ICONS = [
  "apps", "calculate", "storefront", "favorite", "location_city", "fact_check", "water_drop",
  "home", "work", "school", "shopping_cart", "restaurant", "fitness_center", "directions_run",
  "music_note", "movie", "sports_esports", "photo_camera", "palette", "code", "terminal",
  "cloud", "folder", "description", "event", "mail", "chat", "phone", "map", "public",
  "attach_money", "trending_up", "account_balance", "lightbulb", "build", "settings",
  "star", "bookmark", "flag", "bolt", "science", "rocket_launch", "pets", "local_cafe",
];

// 색상 팔레트
const COLORS = ["#0f5e9c", "#0f9c6e", "#d94335", "#5b53d4", "#d98e0b", "#0e8c9c", "#b23a5e", "#5a6470"];

const DEFAULT_COLOR = "#0f5e9c";

export default function AppsCard() {
  const { collapsed, toggle } = useCollapse("apps");
  const [apps, setApps, loaded] = useSyncedState<App[]>("apps", SEED);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("apps");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [editId, setEditId] = useState<number | null>(null);
  const [health, setHealth] = useState<Health>({});

  useEffect(() => {
    if (!loaded || apps.length === 0) return;
    const urls = apps.map((a) => a.url).join(",");
    fetch(`/api/health?urls=${encodeURIComponent(urls)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setHealth(d.results ?? {}))
      .catch(() => {});
  }, [loaded, apps]);

  const resetForm = () => { setName(""); setUrl(""); setIcon("apps"); setColor(DEFAULT_COLOR); setAdding(false); setEditId(null); };

  const add = () => {
    const n = name.trim();
    let u = url.trim();
    if (!n || !u) return;
    if (!/^https?:\/\//.test(u)) u = "https://" + u;
    setApps((p) => [...p, { id: Date.now(), name: n, url: u, icon, color }]);
    resetForm();
  };

  const startEdit = (a: App) => {
    setEditId(a.id); setAdding(true);
    setName(a.name); setUrl(a.url); setIcon(a.icon); setColor(a.color ?? DEFAULT_COLOR);
  };

  const saveEdit = () => {
    const n = name.trim();
    let u = url.trim();
    if (!n || !u) return;
    if (!/^https?:\/\//.test(u)) u = "https://" + u;
    setApps((p) => p.map((a) => (a.id === editId ? { ...a, name: n, url: u, icon, color } : a)));
    resetForm();
  };

  return (
    <section className="card band-cyan">
      <div className="card-head">
        <span className="material-icons-round">rocket_launch</span>
        <span className="card-title">내 앱</span>
        <button className="text-btn" onClick={() => { setEditing((v) => !v); resetForm(); }}>
          {editing ? "완료" : "편집"}
        </button>
        <button className="collapse-btn" onClick={toggle} aria-label={collapsed ? "펼치기" : "접기"}>
          <span className="material-icons-round">{collapsed ? "expand_more" : "expand_less"}</span>
        </button>
      </div>

      {!collapsed && (
      <div className="card-body">
        <div className={`apps-grid${editing ? " editing" : ""}`}>
          {apps.map((a) => (
            <a key={a.id} className="app-tile" href={editing ? undefined : a.url} target="_blank" rel="noreferrer"
               onClick={(e) => { if (editing) { e.preventDefault(); startEdit(a); } }}>
              {health[a.url] !== undefined && (
                <span className={`app-dot ${health[a.url] ? "ok" : "bad"}`} title={health[a.url] ? "정상" : "응답 없음"} />
              )}
              <span className="material-icons-round" style={{ color: a.color ?? DEFAULT_COLOR }}>{a.icon}</span>
              <span className="app-name">{a.name}</span>
              {editing && (
                <button className="app-del" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setApps((p) => p.filter((x) => x.id !== a.id)); }} aria-label={`${a.name} 삭제`}>
                  <span className="material-icons-round" style={{ fontSize: 16 }}>cancel</span>
                </button>
              )}
            </a>
          ))}
        </div>

        {adding ? (
          <div className="app-add-form">
            <div className="icon-preview" style={{ background: color }}>
              <span className="material-icons-round" style={{ color: "#fff", fontSize: 26 }}>{icon}</span>
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="앱 이름" aria-label="앱 이름" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" aria-label="앱 URL" onKeyDown={(e) => e.key === "Enter" && (editId ? saveEdit() : add())} />

            <div className="picker-label">아이콘</div>
            <div className="icon-picker">
              {ICONS.map((ic) => (
                <button key={ic} className={`icon-opt${icon === ic ? " on" : ""}`} onClick={() => setIcon(ic)} aria-label={ic}>
                  <span className="material-icons-round" style={{ fontSize: 19 }}>{ic}</span>
                </button>
              ))}
            </div>

            <div className="picker-label">색상</div>
            <div className="color-picker">
              {COLORS.map((c) => (
                <button key={c} className={`color-opt${color === c ? " on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button className="run-btn" style={{ flex: 1, padding: 9 }} onClick={editId ? saveEdit : add}>
                {editId ? "저장" : "추가하기"}
              </button>
              <button className="run-btn" style={{ flex: "0 0 auto", padding: "9px 14px", background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)" }} onClick={resetForm}>
                취소
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 10, textAlign: "center" }}>
            <button className="text-btn" onClick={() => setAdding(true)}>+ 앱 추가</button>
          </div>
        )}
        {editing && !adding && <div className="stock-note">타일을 누르면 아이콘·색 수정 / × 로 삭제</div>}
      </div>
      )}
    </section>
  );
}
