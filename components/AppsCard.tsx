"use client";

import { useEffect, useState } from "react";

type Health = Record<string, boolean>;

type App = { id: number; name: string; url: string; icon: string };
const KEY = "portal.apps.v1";

const SEED: App[] = [
  { id: 1, name: "MATHLAND 5", url: "https://mathland5.vercel.app", icon: "calculate" },
  { id: 2, name: "사장님 ERP", url: "https://sazangnym-erp.vercel.app", icon: "storefront" },
  { id: 3, name: "비밀고백", url: "https://gohaeseongsa.vercel.app", icon: "favorite" },
  { id: 4, name: "우리동네상가", url: "https://sang-ga.vercel.app", icon: "location_city" },
  { id: 5, name: "PSP REPORT", url: "https://psp-inspection.vercel.app", icon: "fact_check" },
  { id: 6, name: "이슬점 계산기", url: "https://humidity-dew.vercel.app", icon: "water_drop" },
];

export default function AppsCard() {
  const [apps, setApps] = useState<App[]>([]);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [health, setHealth] = useState<Health>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      setApps(saved ? JSON.parse(saved) : SEED);
    } catch {
      setApps(SEED);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(apps));
  }, [apps, loaded]);

  useEffect(() => {
    if (!loaded || apps.length === 0) return;
    const urls = apps.map((a) => a.url).join(",");
    fetch(`/api/health?urls=${encodeURIComponent(urls)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setHealth(d.results ?? {}))
      .catch(() => {});
  }, [loaded, apps]);

  const add = () => {
    const n = name.trim();
    let u = url.trim();
    if (!n || !u) return;
    if (!/^https?:\/\//.test(u)) u = "https://" + u;
    setApps((p) => [...p, { id: Date.now(), name: n, url: u, icon: "apps" }]);
    setName(""); setUrl(""); setAdding(false);
  };

  return (
    <section className="card band-cyan">
      <div className="card-head">
        <span className="material-icons-round">rocket_launch</span>
        <span className="card-title">내 앱</span>
        <button className="text-btn" onClick={() => setEditing((v) => !v)}>
          {editing ? "완료" : "편집"}
        </button>
      </div>

      <div className="card-body">
      <div className={`apps-grid${editing ? " editing" : ""}`}>
        {apps.map((a) => (
          <a key={a.id} className="app-tile" href={editing ? undefined : a.url} target="_blank" rel="noreferrer">
            {health[a.url] !== undefined && (
              <span
                className={`app-dot ${health[a.url] ? "ok" : "bad"}`}
                title={health[a.url] ? "정상" : "응답 없음"}
              />
            )}
            <span className="material-icons-round">{a.icon}</span>
            <span className="app-name">{a.name}</span>
            {editing && (
              <button
                className="app-del"
                onClick={(e) => {
                  e.preventDefault();
                  setApps((p) => p.filter((x) => x.id !== a.id));
                }}
                aria-label={`${a.name} 삭제`}
              >
                <span className="material-icons-round" style={{ fontSize: 16 }}>cancel</span>
              </button>
            )}
          </a>
        ))}
      </div>
      {adding ? (
        <div className="app-add-form">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="앱 이름" aria-label="앱 이름" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" aria-label="앱 URL" onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="text-btn" onClick={add}>추가하기</button>
        </div>
      ) : (
        <div style={{ marginTop: 10, textAlign: "center" }}>
          <button className="text-btn" onClick={() => setAdding(true)}>+ 앱 추가</button>
        </div>
      )}
    </div>
    </section>
  );
}
