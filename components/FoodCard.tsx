"use client";

import { useCallback, useEffect, useState } from "react";
import { useCollapse } from "./useCollapse";

type Place = { id: string; name: string; category: string; address: string; distance: number; url: string };
type Primary = "food" | "cafe";

// 시간대 → 추천 성격 + 이모지
function getSlot(hour: number): { msg: string; emoji: string; primary: Primary } {
  if (hour >= 6 && hour < 11) return { msg: "아침이에요. 커피 한 잔 어때요?", emoji: "☕", primary: "cafe" };
  if (hour >= 11 && hour < 14) return { msg: "점심 먹을 시간!", emoji: "🍚", primary: "food" };
  if (hour >= 14 && hour < 17) return { msg: "나른한 오후, 카페 타임", emoji: "🍰", primary: "cafe" };
  if (hour >= 17 && hour < 21) return { msg: "저녁 뭐 먹지?", emoji: "🍽️", primary: "food" };
  return { msg: "야식이 당기는 시간이네요", emoji: "🌙", primary: "food" };
}

const FALLBACK = { lat: 35.1577, lng: 129.0594, label: "부산 서면" };

const fmtDist = (m: number) => (!Number.isFinite(m) ? "" : m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);
const shortCat = (c: string) => (c ? c.split(">").map((s) => s.trim()).pop() || c : "");

const DEFAULT_RADIUS = 1000;

export default function FoodCard({ count = 4 }: { count?: number }) {
  const { collapsed, toggle } = useCollapse("food");
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [status, setStatus] = useState<"locating" | "loading" | "ready" | "error">("locating");
  const [food, setFood] = useState<Place[]>([]);
  const [cafe, setCafe] = useState<Place[]>([]);
  const [error, setError] = useState("");
  const [usedFallback, setUsedFallback] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [picks, setPicks] = useState<(Place & { reason: string })[] | null>(null);
  const [recBusy, setRecBusy] = useState(false);
  const [recErr, setRecErr] = useState("");

  const fetchPlaces = useCallback(async (lat: number, lng: number, r: number) => {
    setStatus("loading"); setError("");
    try {
      const res = await fetch(`/api/places?lat=${lat}&lng=${lng}&radius=${r}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "요청 실패");
      setFood(data.food ?? []); setCafe(data.cafe ?? []); setStatus("ready"); setPicks(null); setRecErr("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패"); setStatus("error");
    }
  }, []);

  const locate = useCallback(() => {
    setStatus("locating"); setError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setUsedFallback(true); setCoords(FALLBACK); fetchPlaces(FALLBACK.lat, FALLBACK.lng, radius); return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUsedFallback(false);
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c); fetchPlaces(c.lat, c.lng, radius);
      },
      () => { setUsedFallback(true); setCoords(FALLBACK); fetchPlaces(FALLBACK.lat, FALLBACK.lng, radius); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, [fetchPlaces, radius]);

  useEffect(() => { locate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => { if (coords) fetchPlaces(coords.lat, coords.lng, radius); else locate(); };

  // 슬라이더로 반경 변경 → 현재 위치로 즉시 재조회
  const onRadiusChange = (r: number) => {
    setRadius(r);
    if (coords) fetchPlaces(coords.lat, coords.lng, r);
  };

  // Claude에게 선별 추천 요청
  const askClaude = async () => {
    setRecBusy(true); setRecErr(""); setPicks(null);
    try {
      const r = await fetch("/api/places/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food, cafe, primary: slot.primary }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "fail");
      setPicks(d.picks ?? []);
    } catch (e) {
      const m = (e as Error).message;
      setRecErr(m === "no-key" ? "ANTHROPIC_API_KEY를 확인해 주세요" : m === "empty" ? "추천할 가게가 없어요" : "추천 실패 — 다시 시도해 주세요");
    } finally {
      setRecBusy(false);
    }
  };

  const slot = getSlot(new Date().getHours());
  const sections = slot.primary === "food"
    ? [{ primary: true, emoji: "🍚", title: "밥집", data: food }, { primary: false, emoji: "☕", title: "카페", data: cafe }]
    : [{ primary: true, emoji: "☕", title: "카페", data: cafe }, { primary: false, emoji: "🍚", title: "밥집", data: food }];

  return (
    <section className="card band-tangerine">
      <div className="card-head">
        <span className="material-icons-round">restaurant</span>
        <span className="card-title">주변 맛집·카페</span>
        <button className="text-btn" onClick={refresh} aria-label="새로고침" disabled={status === "loading" || status === "locating"}>
          <span className="material-icons-round" style={{ fontSize: 16 }}>refresh</span>
        </button>
        <button className="collapse-btn" onClick={toggle} aria-label={collapsed ? "펼치기" : "접기"}>
          <span className="material-icons-round">{collapsed ? "expand_more" : "expand_less"}</span>
        </button>
      </div>

      {!collapsed && (
      <div className="card-body">
        <div className="food-slot">{slot.emoji} {slot.msg}</div>

        {status === "ready" && (food.length > 0 || cafe.length > 0) && (
          <div className="food-rec">
            {!picks && !recBusy && !recErr && (
              <button className="food-rec-btn" onClick={askClaude}>
                <span className="material-icons-round" style={{ fontSize: 16 }}>auto_awesome</span>
                Claude에게 추천받기
              </button>
            )}
            {recBusy && <div className="food-rec-loading">✨ Claude가 고르는 중…</div>}
            {recErr && (
              <div className="food-rec-err">{recErr}
                <button className="text-btn" onClick={askClaude} style={{ marginLeft: 6 }}>다시</button>
              </div>
            )}
            {picks && picks.length > 0 && (
              <div className="food-picks">
                <div className="food-picks-head">
                  <span>✨ Claude 추천</span>
                  <button className="text-btn" onClick={askClaude} style={{ fontSize: 11 }}>다시 추천</button>
                </div>
                {picks.map((p) => (
                  <a key={p.id} className="food-pick" href={p.url} target="_blank" rel="noreferrer">
                    <div className="food-pick-top">
                      <span className="food-pick-name">{p.name}</span>
                      <span className="food-dist">{fmtDist(p.distance)}</span>
                    </div>
                    <div className="food-pick-reason">{p.reason}</div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="food-radius">
          <div className="food-radius-head">
            <span>검색 반경</span>
            <span className="food-radius-val">{fmtDist(radius)}</span>
          </div>
          <input
            type="range" min="300" max="20000" step="100" value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            onMouseUp={(e) => onRadiusChange(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => onRadiusChange(Number((e.target as HTMLInputElement).value))}
            className="food-slider"
            aria-label="검색 반경"
          />
          <div className="food-radius-ticks"><span>300m</span><span>5km</span><span>10km</span><span>20km</span></div>
        </div>

        {usedFallback && status !== "locating" && (
          <div className="food-note">
            위치 권한이 없어 <b>{FALLBACK.label}</b> 기준이에요.
            <button className="text-btn" onClick={locate} style={{ marginLeft: 6 }}>내 위치로</button>
          </div>
        )}

        {status === "locating" && <p className="empty">위치 확인 중…</p>}
        {status === "loading" && (<><div className="skeleton" /><div className="skeleton" style={{ width: "65%" }} /></>)}
        {status === "error" && (
          <div className="empty">
            {error.includes("KAKAO") ? "카카오 API 키를 확인해 주세요 (KAKAO_REST_API_KEY)" : error}
            <br /><button className="text-btn" onClick={refresh} style={{ marginTop: 6 }}>다시 시도</button>
          </div>
        )}

        {status === "ready" && sections.map((s) => (
          <div key={s.title} className={`food-sec${s.primary ? " primary" : ""}`}>
            <div className="food-sec-head">
              <span>{s.emoji} {s.title}</span>
              {s.primary && <span className="food-now">지금 추천</span>}
            </div>
            {s.data.length === 0 ? (
              <p className="empty" style={{ padding: "4px 0" }}>이 근처엔 없네요.</p>
            ) : (
              s.data.slice(0, count).map((p) => (
                <a key={p.id} className="food-item" href={p.url} target="_blank" rel="noreferrer">
                  <span className="food-item-main">
                    <span className="food-name">{p.name}</span>
                    <span className="food-cat">{shortCat(p.category)}</span>
                  </span>
                  <span className="food-dist">{fmtDist(p.distance)}</span>
                </a>
              ))
            )}
          </div>
        ))}

        <div className="stock-note">카카오맵 기반 · 반경 {fmtDist(radius)}</div>
      </div>
      )}
    </section>
  );
}
