"use client";

import { useEffect, useState } from "react";
import { useCollapse } from "./useCollapse";

type Mail = { id: string; from: string; subject: string; snippet: string; date: string };

export default function GmailCard() {
  const { collapsed, toggle } = useCollapse("gmail");
  const [data, setData] = useState<{ unread: number; messages: Mail[] } | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/gmail")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr(true));
  }, []);

  const rel = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  };

  return (
    <section className="card band-red">
      <div className="card-head">
        <span className="material-icons-round">mail</span>
        <span className="card-title">Gmail 미읽음</span>
        {data && <span className={`badge${data.unread > 0 ? " signal" : ""}`}>{data.unread}</span>}
              <button className="collapse-btn" onClick={toggle} aria-label={collapsed ? "펼치기" : "접기"}>
          <span className="material-icons-round">{collapsed ? "expand_more" : "expand_less"}</span>
        </button>
      </div>

      {!collapsed && (
      <div className="card-body">
      {err && <p className="empty">메일을 불러오지 못했어요. 다시 로그인해 보세요.</p>}
      {!err && !data && (<><div className="skeleton" /><div className="skeleton" style={{ width: "80%" }} /></>)}
      {data?.messages.length === 0 && <p className="empty">미읽음 메일이 없어요. 인박스 제로! ✨</p>}
      {data?.messages.map((m) => (
        <a key={m.id} className="mail" href={`https://mail.google.com/mail/u/0/#inbox/${m.id}`} target="_blank" rel="noreferrer">
          <div className="mail-from">
            <span>{m.from}</span>
            <span>{m.date ? rel(m.date) : ""}</span>
          </div>
          <div className="mail-subject">{m.subject || "(제목 없음)"}</div>
          <div className="mail-snippet">{m.snippet}</div>
        </a>
      ))}
    </div>
      )}
    </section>
  );
}
