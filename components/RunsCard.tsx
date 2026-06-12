"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Run = {
  id: number; run_date: string; distance_km: number; duration_min: number | null;
  pace: string | null; avg_hr: number | null; calories: number | null;
  notes: string | null; analysis: string | null;
};

export default function RunsCard() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch("/api/runs")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRuns(d.runs))
      .catch(() => setRuns([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (payload: { text?: string; image?: { data: string; media_type: string } }) => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "fail");
      setMsg(`✓ ${d.run.run_date} · ${d.run.distance_km}km 기록 저장됨`);
      setText("");
      load();
    } catch (e) {
      const m = (e as Error).message;
      setMsg(
        m === "parse" ? "기록을 읽지 못했어요. 더 선명한 캡처나 자세한 텍스트로!"
        : m === "no-key" || m === "no-db" ? "환경변수(ANTHROPIC_API_KEY / Supabase)를 확인해 주세요"
        : "분석 실패 — 잠시 후 다시 시도해 주세요"
      );
    } finally {
      setBusy(false);
    }
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { setMsg("사진이 너무 커요 (4MB 이하)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result).split(",")[1];
      submit({ image: { data, media_type: f.type || "image/jpeg" } });
    };
    reader.readAsDataURL(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthKm = (runs ?? [])
    .filter((r) => r.run_date?.startsWith(ym))
    .reduce((a, r) => a + (Number(r.distance_km) || 0), 0);
  const latest = runs?.[0];

  return (
    <section className="card band-rose">
      <div className="card-head">
        <span className="material-icons-round">directions_run</span>
        <span className="card-title">러닝 코치</span>
        {runs && <span className="badge">이번 달 {monthKm.toFixed(1)}km</span>}
      </div>

      <div className="card-body">
        <textarea
          className="run-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="러닝앱 기록을 붙여넣거나, 아래에서 캡처 사진을 올려주세요"
          disabled={busy}
          aria-label="러닝 기록 입력"
        />
        <div className="run-actions">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <button className="run-btn secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <span className="material-icons-round" style={{ fontSize: 16 }}>photo_camera</span>
            사진 분석
          </button>
          <button className="run-btn" onClick={() => text.trim() && submit({ text })} disabled={busy || !text.trim()}>
            <span className="material-icons-round" style={{ fontSize: 16 }}>{busy ? "hourglass_top" : "auto_awesome"}</span>
            {busy ? "코치가 분석 중…" : "텍스트 분석"}
          </button>
        </div>
        {msg && <div className="cal-msg" style={{ margin: "8px 0 0" }}>{msg}</div>}

        {latest?.analysis && (
          <div className="run-analysis">
            <strong>🏃 최근 분석 ({latest.run_date})</strong>
            <br />{latest.analysis}
          </div>
        )}

        {!runs && (<><div className="skeleton" /><div className="skeleton" style={{ width: "70%" }} /></>)}
        {runs?.length === 0 && <p className="empty">첫 러닝 기록을 올려보세요!</p>}
        {runs?.slice(0, 5).map((r) => (
          <div key={r.id} className="run-row" title={r.notes ?? ""}>
            <span className="run-date">{r.run_date?.slice(5)}</span>
            <span className="run-km">{Number(r.distance_km).toFixed(1)}km</span>
            {r.avg_hr && <span className="sub-hr">♥ {r.avg_hr}</span>}
            <span className="run-pace">{r.pace ?? (r.duration_min ? `${Math.round(r.duration_min)}분` : "")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
