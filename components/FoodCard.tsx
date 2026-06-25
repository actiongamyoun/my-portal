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

export default function FoodCard({ radius = 1000, count = 4 }: { radius?: number; count?: number }) {
  const { collapsed, toggle } = useCollapse("food");
  const [status, setStatus] = useState<"locating" | "loading" | "ready" | "error">("locating");
  const [food, setFood] = useState<Place[]>([]);
  const [cafe, setCafe] = useState<Place[]>([]);
  const [error, setError] = useState("");
  const [usedFallback, setUsedFallback] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const fetchPlaces = useCallback(async (lat: number, lng: number) => {
    setStatus("loading"); setError("");
    try {
      const res = await fetch(`/api/places?lat=${lat}&lng=${lng}&radius=${radius}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "요청 실패");
      setFood(data.food ?? []); setCafe(data.cafe ?? []); setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패"); setStatus("error");
    }
  }, [radius]);

  const locate = useCallback(() => {
    setStatus("locating"); setError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setUsedFallback(true); setCoords(FALLBACK); fetchPlaces(FALLBACK.lat, FALLBACK.lng); return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUsedFallback(false);
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c); fetchPlaces(c.lat, c.lng);
      },
      () => { setUsedFallback(true); setCoords(FALLBACK); fetchPlaces(FALLBACK.lat, FALLBACK.lng); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, [fetchPlaces]);

  useEffect(() => { locate(); }, [locate]);

  const refresh = () => { if (coords) fetchPlaces(coords.lat, coords.lng); else locate(); };

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
