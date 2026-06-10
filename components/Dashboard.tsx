"use client";

import { useEffect, useState } from "react";
import CalendarCard from "./CalendarCard";
import GmailCard from "./GmailCard";
import TodoCard from "./TodoCard";
import MemoCard from "./MemoCard";
import NewsCard from "./NewsCard";
import AppsCard from "./AppsCard";

type Weather = { temp: number; desc: string; city: string; humidity: number };
type Fx = { usdKrw: number; jpy100Krw: number };

export default function Dashboard() {
  const [now, setNow] = useState("");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [fx, setFx] = useState<Fx | null>(null);

  useEffect(() => {
    const tick = () =>
      setNow(
        new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        }).format(new Date())
      );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("/api/weather").then((r) => (r.ok ? r.json() : null)).then(setWeather).catch(() => {});
    fetch("/api/fx").then((r) => (r.ok ? r.json() : null)).then(setFx).catch(() => {});
  }, []);

  return (
    <>
      <div className="chips">
        <span className="chip">
          <span className="material-icons-round">schedule</span>
          <span className="num">{now || "--:--:--"}</span>
        </span>
        <span className="chip">
          <span className="material-icons-round">wb_sunny</span>
          {weather ? (
            <>
              <span className="num">{weather.temp}°</span>
              <span className="sub">{weather.desc} · 습도 {weather.humidity}%</span>
            </>
          ) : (
            <span className="sub">날씨 로딩…</span>
          )}
        </span>
        <span className="chip">
          <span className="material-icons-round">currency_exchange</span>
          {fx ? (
            <>
              <span className="num">${"1"} = {fx.usdKrw.toLocaleString()}원</span>
              <span className="sub">¥100 = {fx.jpy100Krw.toLocaleString()}원</span>
            </>
          ) : (
            <span className="sub">환율 로딩…</span>
          )}
        </span>
      </div>

      <div className="grid">
        <div className="col">
          <CalendarCard />
          <TodoCard />
        </div>
        <div className="col">
          <GmailCard />
          <MemoCard />
        </div>
        <div className="col">
          <NewsCard />
          <AppsCard />
        </div>
      </div>
    </>
  );
}
