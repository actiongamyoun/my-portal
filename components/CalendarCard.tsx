"use client";

import { useEffect, useState } from "react";

type Ev = { id: string; title: string; start: string; allDay: boolean; location: string; link: string };

export default function CalendarCard() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setEvents(d.events))
      .catch(() => setErr(true));
  }, []);

  const fmt = (e: Ev) =>
    e.allDay
      ? "종일"
      : new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false,
        }).format(new Date(e.start));

  return (
    <section className="card">
      <div className="card-head">
        <span className="material-icons-round">event</span>
        <span className="card-title">오늘 일정</span>
        {events && <span className="badge">{events.length}</span>}
      </div>
      {err && <p className="empty">일정을 불러오지 못했어요. 다시 로그인해 보세요.</p>}
      {!err && !events && (<><div className="skeleton" /><div className="skeleton" style={{ width: "70%" }} /></>)}
      {events?.length === 0 && <p className="empty">오늘 일정이 없어요. 여유로운 하루! 🎉</p>}
      {events?.map((e) => (
        <a key={e.id} className="event" href={e.link} target="_blank" rel="noreferrer">
          <span className="event-time">{fmt(e)}</span>
          <span>
            <span className="event-title">{e.title}</span>
            {e.location && <div className="event-loc">{e.location}</div>}
          </span>
        </a>
      ))}
    </section>
  );
}
