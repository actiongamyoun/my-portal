"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Ev = { id: string; title: string; start: string; allDay: boolean; location: string; link: string };

export default function CalendarCard() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [err, setErr] = useState(false);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const recRef = useRef<any>(null);
  const finalRef = useRef("");

  useEffect(() => {
    setVoiceOk(
      typeof window !== "undefined" &&
        !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
    return () => { try { recRef.current?.abort(); } catch {} };
  }, []);

  const load = useCallback(() => {
    fetch("/api/calendar")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setEvents(d.events); setErr(false); })
      .catch(() => setErr(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (raw?: string) => {
    const t = (raw ?? text).trim();
    if (!t || adding) return;
    setAdding(true);
    setMsg("");
    try {
      const r = await fetch("/api/calendar/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "fail");
      setMsg(`✓ "${d.summary}" 등록 완료`);
      setText("");
      load();
    } catch (e) {
      const m = (e as Error).message;
      setMsg(
        m === "scope" ? "권한 갱신 필요 — 로그아웃 후 다시 로그인해 주세요"
        : m === "no-key" ? "ANTHROPIC_API_KEY를 환경변수에 추가해 주세요"
        : m === "parse" ? "문장을 이해하지 못했어요. 날짜·시간을 조금 더 명확히!"
        : "등록 실패 — 잠시 후 다시 시도해 주세요"
      );
    } finally {
      setAdding(false);
    }
  }, [text, adding, load]);

  const startVoice = () => {
    if (listening) { try { recRef.current?.stop(); } catch {} return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.continuous = false;
    finalRef.current = "";

    rec.onresult = (e: any) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += tr;
        else interim += tr;
      }
      if (final) finalRef.current += final;
      setText((finalRef.current + interim).trim());
    };
    rec.onerror = (e: any) => {
      setListening(false);
      setMsg(
        e.error === "not-allowed"
          ? "마이크 권한을 허용해 주세요 (주소창 자물쇠 → 마이크)"
          : "음성 인식 실패 — 다시 한번 말씀해 주세요"
      );
    };
    rec.onend = () => {
      setListening(false);
      const t = finalRef.current.trim();
      if (t) add(t); // 원클릭: 말이 끝나면 자동 등록
    };

    setMsg("");
    setListening(true);
    rec.start();
  };

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

      <div className="todo-input-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={listening ? "듣고 있어요… 말씀하세요" : "예: 내일 14시 PSPC 검사 입회"}
          aria-label="자연어 일정 입력"
          disabled={adding}
        />
        {voiceOk && (
          <button
            className={`icon-btn mic${listening ? " listening" : ""}`}
            onClick={startVoice}
            aria-label={listening ? "듣기 중지" : "음성으로 일정 말하기"}
            disabled={adding}
          >
            <span className="material-icons-round">{listening ? "graphic_eq" : "mic"}</span>
          </button>
        )}
        <button className="icon-btn" onClick={() => add()} aria-label="일정 등록" disabled={adding}>
          <span className="material-icons-round">{adding ? "hourglass_top" : "auto_awesome"}</span>
        </button>
      </div>
      {msg && <div className="cal-msg">{msg}</div>}

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
