"use client";

import { useEffect, useRef, useState } from "react";

const KEY = "portal.memo.v1";

export default function MemoCard() {
  const [memo, setMemo] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMemo(localStorage.getItem(KEY) ?? "");
  }, []);

  const onChange = (v: string) => {
    setMemo(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      localStorage.setItem(KEY, v);
      setSavedAt(
        new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        }).format(new Date())
      );
    }, 500);
  };

  return (
    <section className="card band-amber">
      <div className="card-head">
        <span className="material-icons-round">edit_note</span>
        <span className="card-title">메모</span>
      </div>

      <div className="card-body">
      <textarea
        className="memo-area"
        value={memo}
        onChange={(e) => onChange(e.target.value)}
        placeholder="생각나는 것을 바로 적어두세요. 자동 저장됩니다."
        aria-label="메모"
      />
      {savedAt && <div className="memo-saved">저장됨 {savedAt}</div>}
    </div>
    </section>
  );
}
