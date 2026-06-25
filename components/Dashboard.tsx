"use client";

import { useEffect, useState } from "react";
import CalendarCard from "./CalendarCard";
import BriefingCard from "./BriefingCard";
import StocksCard from "./StocksCard";
import RunsCard from "./RunsCard";
import CampCard from "./CampCard";
import FoodCard from "./FoodCard";
import PortfolioCard from "./PortfolioCard";
import GmailCard from "./GmailCard";
import TodoCard from "./TodoCard";
import MemoCard from "./MemoCard";
import NewsCard from "./NewsCard";
import AppsCard from "./AppsCard";
import AiToolsCard from "./AiToolsCard";

type Weather = { temp: number; desc: string; city: string; humidity: number };
type Fx = { usdKrw: number; jpy100Krw: number };

export default function Dashboard() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [fx, setFx] = useState<Fx | null>(null);

  useEffect(() => {
    const loadWeather = (qs = "") =>
      fetch(`/api/weather${qs}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setWeather)
        .catch(() => { if (qs) loadWeather(); }); // 좌표 조회 실패 시 기본 지역 폴백

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          loadWeather(`?lat=${pos.coords.latitude.toFixed(2)}&lon=${pos.coords.longitude.toFixed(2)}`),
        () => loadWeather(), // 권한 거부/실패 → 기본 지역
        { timeout: 5000, maximumAge: 600000 }
      );
    } else {
      loadWeather();
    }
    fetch("/api/fx").then((r) => (r.ok ? r.json() : null)).then(setFx).catch(() => {});
  }, []);

  return (
    <>
      <div className="chips">
        <span className="chip">
          <span className="material-icons-round">wb_sunny</span>
          {weather ? (
            <>
              <span className="num">{weather.temp}°</span>
              <span>{weather.city}</span>
              <span className="sub">{weather.desc} · 습도 {weather.humidity}%</span>
            </>
          ) : (
            <span className="sub">날씨 로딩…</span>
          )}
        </span>
        <span className="chip chip-fx">
          <span className="material-icons-round">currency_exchange</span>
          {fx ? (
            <>
              <span className="num">$1 = {fx.usdKrw.toLocaleString()}원</span>
              <span className="num">¥100 = {fx.jpy100Krw.toLocaleString()}원</span>
            </>
          ) : (
            <span className="sub">환율 로딩…</span>
          )}
        </span>
      </div>

      <div className="grid">
        <div className="col">
          <BriefingCard />
          <CalendarCard />
          <TodoCard />
        </div>
        <div className="col">
          <GmailCard />
          <RunsCard />
          <CampCard />
          <FoodCard />
          <MemoCard />
        </div>
        <div className="col">
          <StocksCard />
          <PortfolioCard />
          <NewsCard />
          <AppsCard />
          <AiToolsCard />
        </div>
      </div>
    </>
  );
}
