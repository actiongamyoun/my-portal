"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCollapse } from "./useCollapse";

type Split = { km: number; pace_sec: number };
type Zone = { zone: string; min: number };
type Run = {
  id: number; run_date: string; distance_km: number; duration_min: number | null;
  pace: string | null; avg_hr: number | null; max_hr: number | null;
  cadence_avg: number | null; stride_cm: number | null; calories: number | null;
  vo2max: number | null; recovery_hours: number | null;
  splits: Split[] | null; hr_zones: Zone[] | null;
  notes: string | null; analysis: string | null;
};

const ZONE_COLOR: Record<string, string> = {
  "워밍업": "#5aa9e6", "강화": "#27c08d", "중강도": "#f0b429", "고강도": "#ff7a3d", "최대": "#d92d4c",
};

const fmtPace = (sec: number) => `${Math.floor(sec / 60)}'${String(Math.round(sec % 60)).padStart(2, "0")}"`;

export default function RunsCard() {
  const { collapsed, toggle } = useCollapse("runs");
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

  const submit = async (payload: { text?: string; images?: { data: string; media_type: string }[] }) => {
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
        m === "parse" ? "기록을 읽지 못했어요. 요약·심박·케이던스 화면을 따로 캡처해서 올려보세요!"
        : m === "no-key" || m === "no-db" ? "환경변수(ANTHROPIC_API_KEY / Supabase)를 확인해 주세요"
        : "분석 실패 — 잠시 후 다시 시도해 주세요"
      );
    } finally {
      setBusy(false);
    }
  };

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []).slice(0, 3);
    if (files.length === 0) return;
    let total = 0;
    for (const f of files) total += f.size;
    if (total > 3.5 * 1024 * 1024) { setMsg("사진 용량 합이 너무 커요 (총 3.5MB 이하, 최대 3장)"); return; }

    const images = await Promise.all(
      files.map((f) => new Promise<{ data: string; media_type: string }>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res({ data: String(reader.result).split(",")[1], media_type: f.type || "image/jpeg" });
        reader.onerror = rej;
        reader.readAsDataURL(f);
      }))
    ).catch(() => null);
    if (fileRef.current) fileRef.current.value = "";
    if (!images) { setMsg("사진을 읽지 못했어요"); return; }
    submit({ images, text: text.trim() || undefined });
  };

  // 이번 달 누적
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthKm = (runs ?? []).filter((r) => r.run_date?.startsWith(ym))
    .reduce((a, r) => a + (Number(r.distance_km) || 0), 0);
  const latest = runs?.[0];

  // 주간 거리 추세 (최근 6주, 월요일 시작)
  const weeks: { label: string; km: number }[] = [];
  if (runs) {
    const monday = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0,0,0,0); return x; };
    const thisMon = monday(new Date());
    for (let i = 5; i >= 0; i--) {
      const start = new Date(thisMon); start.setDate(start.getDate() - i * 7);
      const end = new Date(start); end.setDate(end.getDate() + 7);
      const km = runs.filter((r) => {
        const d = new Date(r.run_date + "T00:00:00");
        return d >= start && d < end;
      }).reduce((a, r) => a + (Number(r.distance_km) || 0), 0);
      weeks.push({ label: `${start.getMonth() + 1}/${start.getDate()}`, km });
    }
  }
  const maxWeek = Math.max(...weeks.map((w) => w.km), 1);

  // 스플릿 차트 데이터
  const splits = latest?.splits ?? [];
  const maxSec = Math.max(...splits.map((s) => s.pace_sec), 1);
  const minSec = Math.min(...splits.map((s) => s.pace_sec), Infinity);
  const zones = latest?.hr_zones ?? [];
  const zoneTotal = zones.reduce((a, z) => a + (z.min || 0), 0);

  return (
    <section className="card band-rose">
      <div className="card-head">
        <span className="material-icons-round">directions_run</span>
        <span className="card-title">러닝 코치</span>
        {runs && <span className="badge">이번 달 {monthKm.toFixed(1)}km</span>}
        <button className="collapse-btn" onClick={toggle} aria-label={collapsed ? "펼치기" : "접기"}>
          <span className="material-icons-round">{collapsed ? "expand_more" : "expand_less"}</span>
        </button>
      </div>

      {!collapsed && (
      <div className="card-body">
        <textarea
          className="run-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="캡처를 올리거나 기록 텍스트 붙여넣기 (사진은 한 번에 최대 3장 — 요약·심박·케이던스 화면)"
          disabled={busy}
          aria-label="러닝 기록 입력"
        />
        <div className="run-actions">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <button className="run-btn secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <span className="material-icons-round" style={{ fontSize: 16 }}>photo_library</span>
            사진 분석 (1~3장)
          </button>
          <button className="run-btn" onClick={() => text.trim() && submit({ text })} disabled={busy || !text.trim()}>
            <span className="material-icons-round" style={{ fontSize: 16 }}>{busy ? "hourglass_top" : "auto_awesome"}</span>
            {busy ? "분석 중…" : "텍스트 분석"}
          </button>
        </div>
        {msg && <div className="cal-msg" style={{ margin: "8px 0 0" }}>{msg}</div>}

        {latest?.analysis && (
          <div className="run-analysis">
            <strong>🏃 {latest.run_date} · {Number(latest.distance_km).toFixed(2)}km
              {latest.pace ? ` · ${latest.pace}` : ""}{latest.avg_hr ? ` · ♥${latest.avg_hr}` : ""}
              {latest.cadence_avg ? ` · ${latest.cadence_avg}spm` : ""}</strong>
            <br />{latest.analysis}
          </div>
        )}

        {splits.length > 1 && (
          <div className="chart-block">
            <div className="chart-title">km당 페이스</div>
            {splits.map((s) => (
              <div key={s.km} className="split-row">
                <span className="split-km">{s.km}</span>
                <div className="split-track">
                  <div
                    className="split-bar"
                    style={{
                      width: `${Math.max((s.pace_sec / maxSec) * 100, 18)}%`,
                      background: s.pace_sec === minSec ? "#1f8a62" : s.pace_sec === maxSec ? "#d96a32" : "#c2477a",
                    }}
                  >{fmtPace(s.pace_sec)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {zoneTotal > 0 && (
          <div className="chart-block">
            <div className="chart-title">심박 존 분포</div>
            <div className="zone-bar">
              {zones.map((z) => (
                <div key={z.zone} className="zone-seg"
                  style={{ width: `${(z.min / zoneTotal) * 100}%`, background: ZONE_COLOR[z.zone] ?? "#9aa7b5" }}
                  title={`${z.zone} ${Math.round(z.min)}분`} />
              ))}
            </div>
            <div className="zone-legend">
              {zones.map((z) => (
                <span key={z.zone}>
                  <i style={{ background: ZONE_COLOR[z.zone] ?? "#9aa7b5" }} />{z.zone} {Math.round(z.min)}분
                </span>
              ))}
            </div>
          </div>
        )}

        {weeks.some((w) => w.km > 0) && (
          <div className="chart-block">
            <div className="chart-title">주간 거리 추세 (6주)</div>
            <div className="week-chart">
              {weeks.map((w, i) => (
                <div key={i} className="week-col">
                  <span className="week-km">{w.km > 0 ? w.km.toFixed(0) : ""}</span>
                  <div className="week-bar" style={{ height: `${Math.max((w.km / maxWeek) * 64, w.km > 0 ? 6 : 2)}px` }} />
                  <span className="week-label">{w.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!runs && (<><div className="skeleton" /><div className="skeleton" style={{ width: "70%" }} /></>)}
        {runs?.length === 0 && <p className="empty">첫 러닝 기록을 올려보세요!</p>}
        {runs && runs.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {runs.slice(0, 5).map((r) => (
              <div key={r.id} className="run-row" title={r.notes ?? ""}>
                <span className="run-date">{r.run_date?.slice(5)}</span>
                <span className="run-km">{Number(r.distance_km).toFixed(1)}km</span>
                {r.avg_hr && <span className="sub-hr">♥ {r.avg_hr}</span>}
                {r.cadence_avg && <span className="sub-hr" style={{ color: "var(--muted)" }}>{r.cadence_avg}spm</span>}
                <span className="run-pace">{r.pace ?? (r.duration_min ? `${Math.round(r.duration_min)}분` : "")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </section>
  );
}
