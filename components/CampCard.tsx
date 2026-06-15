"use client";

import { useEffect, useState } from "react";
import { useCollapse } from "./useCollapse";
import { useSyncedState } from "./useSyncedState";

type Camp = {
  id: number; name: string; lat: number; lon: number;
  bookUrl?: string; memo?: string;
};
type WeatherDay = { temp: number; desc: string; icon: string; pop: number };

const SEED: Camp[] = [
  { id: 1, name: "달음산 오토캠핑장", lat: 35.30, lon: 129.21, bookUrl: "https://www.busan.go.kr", memo: "전기 A구역 추천" },
  { id: 2, name: "양산 에덴밸리", lat: 35.42, lon: 129.00, bookUrl: "", memo: "" },
  { id: 3, name: "거제 해금강", lat: 34.74, lon: 128.66, bookUrl: "", memo: "노을 명당" },
];

function emoji(icon: string) {
  const c = icon?.slice(0, 2);
  return ({ "01": "☀️", "02": "🌤", "03": "⛅", "04": "☁️", "09": "🌧", "10": "🌦", "11": "⛈", "13": "❄️", "50": "🌫" } as Record<string, string>)[c] ?? "🌡";
}

function CampWeather({ lat, lon }: { lat: number; lon: number }) {
  const [w, setW] = useState<{ sat: WeatherDay | null; sun: WeatherDay | null } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch(`/api/camp-weather?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (d.error) setErr(true); else setW(d); })
      .catch(() => setErr(true));
  }, [lat, lon]);

  if (err) return <span className="camp-wx-err">날씨 정보 없음</span>;
  if (!w) return <span className="camp-wx-err">날씨 로딩…</span>;

  const Day = ({ label, d }: { label: string; d: WeatherDay | null }) =>
    d ? (
      <span className="camp-day">
        <b>{label}</b> {emoji(d.icon)} {d.temp}°
        {d.pop >= 30 && <span className="camp-pop"> 💧{d.pop}%</span>}
      </span>
    ) : (
      <span className="camp-day"><b>{label}</b> –</span>
    );

  return (
    <span className="camp-wx">
      <Day label="토" d={w.sat} />
      <Day label="일" d={w.sun} />
    </span>
  );
}

export default function CampCard() {
  const { collapsed, toggle } = useCollapse("camp");
  const [camps, setCamps] = useSyncedState<Camp[]>("camps", SEED);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [coord, setCoord] = useState("");
  const [bookUrl, setBookUrl] = useState("");
  const [memo, setMemo] = useState("");

  const reset = () => { setName(""); setCoord(""); setBookUrl(""); setMemo(""); setAdding(false); setEditId(null); };

  const parseCoord = (s: string): [number, number] | null => {
    const m = s.split(",").map((x) => parseFloat(x.trim()));
    if (m.length === 2 && Number.isFinite(m[0]) && Number.isFinite(m[1])) return [m[0], m[1]];
    return null;
  };

  const save = () => {
    const n = name.trim();
    const c = parseCoord(coord);
    if (!n || !c) return;
    let u = bookUrl.trim();
    if (u && !/^https?:\/\//.test(u)) u = "https://" + u;
    if (editId) {
      setCamps((p) => p.map((x) => x.id === editId ? { ...x, name: n, lat: c[0], lon: c[1], bookUrl: u, memo: memo.trim() } : x));
    } else {
      setCamps((p) => [...p, { id: Date.now(), name: n, lat: c[0], lon: c[1], bookUrl: u, memo: memo.trim() }]);
    }
    reset();
  };

  const startEdit = (c: Camp) => {
    setEditId(c.id); setAdding(true);
    setName(c.name); setCoord(`${c.lat}, ${c.lon}`); setBookUrl(c.bookUrl ?? ""); setMemo(c.memo ?? "");
  };

  return (
    <section className="card band-forest">
      <div className="card-head">
        <span className="material-icons-round">cabin</span>
        <span className="card-title">캠핑</span>
        <button className="text-btn" onClick={() => { setEditing((v) => !v); reset(); }}>
          {editing ? "완료" : "편집"}
        </button>
        <button className="collapse-btn" onClick={toggle} aria-label={collapsed ? "펼치기" : "접기"}>
          <span className="material-icons-round">{collapsed ? "expand_more" : "expand_less"}</span>
        </button>
      </div>

      {!collapsed && (
      <div className="card-body">
        {camps.length === 0 && <p className="empty">자주 가는 캠핑장을 추가해 보세요.</p>}

        {camps.map((c) => (
          <div key={c.id} className="camp-row">
            <div className="camp-main">
              <div className="camp-name">
                {c.name}
                {editing && (
                  <button className="text-btn" style={{ marginLeft: 6, fontSize: 11 }} onClick={() => startEdit(c)}>수정</button>
                )}
                {editing && (
                  <button className="text-btn" style={{ marginLeft: 4, fontSize: 11, color: "var(--signal)" }} onClick={() => setCamps((p) => p.filter((x) => x.id !== c.id))}>삭제</button>
                )}
              </div>
              <CampWeather lat={c.lat} lon={c.lon} />
              {c.memo && <div className="camp-memo">📍 {c.memo}</div>}
            </div>
            <div className="camp-actions">
              {c.bookUrl && (
                <a className="camp-btn" href={c.bookUrl} target="_blank" rel="noreferrer" title="예약 페이지">
                  <span className="material-icons-round">event_available</span>
                </a>
              )}
              <a className="camp-btn" href={`https://map.naver.com/v5/search/${encodeURIComponent(c.name)}`} target="_blank" rel="noreferrer" title="지도">
                <span className="material-icons-round">place</span>
              </a>
            </div>
          </div>
        ))}

        {adding ? (
          <div className="app-add-form">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="캠핑장 이름" aria-label="이름" />
            <input value={coord} onChange={(e) => setCoord(e.target.value)} placeholder="위도, 경도 (예: 35.30, 129.21)" aria-label="좌표" />
            <input value={bookUrl} onChange={(e) => setBookUrl(e.target.value)} placeholder="예약 페이지 URL (선택)" aria-label="예약 URL" />
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 — 사이트 번호 등 (선택)" aria-label="메모" onKeyDown={(e) => e.key === "Enter" && save()} />
            <div className="camp-coord-help">좌표는 네이버지도에서 장소 우클릭 → 좌표 확인, 또는 구글지도 핀 클릭 시 표시</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="run-btn" style={{ flex: 1, padding: 9 }} onClick={save}>{editId ? "저장" : "추가하기"}</button>
              <button className="run-btn" style={{ flex: "0 0 auto", padding: "9px 14px", background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)" }} onClick={reset}>취소</button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 8, textAlign: "center" }}>
            <button className="text-btn" onClick={() => setAdding(true)}>+ 캠핑장 추가</button>
          </div>
        )}
      </div>
      )}
    </section>
  );
}
