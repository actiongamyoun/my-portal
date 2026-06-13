"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCollapse } from "./useCollapse";

type Holding = {
  id: number; name: string; code: string | null; market: string; hidden: boolean;
  quantity: number; cost_krw: number; value_krw: number | null; live: boolean;
  pl: number | null; pl_pct: number | null;
};
type Totals = { value_krw: number; pl_krw: number; pl_pct: number };

const won = (n: number) => Math.round(n).toLocaleString("ko-KR");

export default function PortfolioCard() {
  const { collapsed, toggle } = useCollapse("portfolio");
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState<"KR" | "US">("KR");

  useEffect(() => {
    const v = localStorage.getItem("portal.pf.view");
    if (v === "KR" || v === "US") setView(v);
  }, []);
  const switchView = (v: "KR" | "US") => {
    setView(v);
    try { localStorage.setItem("portal.pf.view", v); } catch {}
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const marketRef = useRef<"KR" | "US">("KR");

  const load = useCallback(() => {
    fetch("/api/portfolio")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setHoldings(d.holdings); setTotals(d.totals); })
      .catch(() => { setHoldings([]); setTotals(null); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const setHidden = async (h: Holding, hidden: boolean) => {
    await fetch("/api/portfolio", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: h.id, hidden }),
    }).catch(() => {});
    load();
  };

  const pick = (mk: "KR" | "US") => {
    marketRef.current = mk;
    fileRef.current?.click();
  };

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []).slice(0, 3);
    if (files.length === 0) return;
    if (files.reduce((a, f) => a + f.size, 0) > 3.5 * 1024 * 1024) {
      setMsg("사진 용량 합이 너무 커요 (총 3.5MB 이하)"); return;
    }
    setBusy(true); setMsg("");
    try {
      const images = await Promise.all(
        files.map((f) => new Promise<{ data: string; media_type: string }>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res({ data: String(reader.result).split(",")[1], media_type: f.type || "image/png" });
          reader.onerror = rej;
          reader.readAsDataURL(f);
        }))
      );
      const r = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, market: marketRef.current }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "fail");
      setMsg(`✓ ${d.market === "US" ? "해외" : "국내"} ${d.count}종목으로 갱신됨`);
      load();
    } catch (e) {
      setMsg((e as Error).message === "parse"
        ? "보유 내역을 읽지 못했어요. 표의 종목명~원금 컬럼이 보이게 캡처해 주세요"
        : "동기화 실패 — 잠시 후 다시 시도해 주세요");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const fixCode = async (h: Holding) => {
    const code = window.prompt(`"${h.name}" 종목코드/티커 (한국: 6자리, 미국: 티커)`, h.code ?? "");
    if (code === null) return;
    await fetch("/api/portfolio", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: h.id, code: code.trim() || null }),
    }).catch(() => {});
    load();
  };

  const plClass = (v: number | null) => (v == null ? "flat" : v > 0 ? "up" : v < 0 ? "down" : "flat");

  return (
    <section className="card band-navy">
      <div className="card-head">
        <span className="material-icons-round">account_balance_wallet</span>
        <span className="card-title">포트폴리오</span>
        {totals && (
          <span className={`badge pf-badge ${plClass(totals.pl_pct)}`}>
            {totals.pl_pct > 0 ? "+" : ""}{totals.pl_pct.toFixed(2)}%
          </span>
        )}
        <button className="collapse-btn" onClick={toggle} aria-label={collapsed ? "펼치기" : "접기"}>
          <span className="material-icons-round">{collapsed ? "expand_more" : "expand_less"}</span>
        </button>
      </div>

      {!collapsed && (
      <div className="card-body">
        {totals && holdings && holdings.length > 0 && (
          <div className="pf-summary">
            <div>
              <div className="pf-label">평가금액</div>
              <div className="pf-total">{won(totals.value_krw)}원</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="pf-label">평가손익</div>
              <div className={`pf-pl ${plClass(totals.pl_krw)}`}>
                {totals.pl_krw > 0 ? "+" : ""}{won(totals.pl_krw)}원
              </div>
            </div>
          </div>
        )}

        {!holdings && (<><div className="skeleton" /><div className="skeleton" style={{ width: "75%" }} /></>)}
        {holdings?.length === 0 && (
          <p className="empty">토스증권 PC 보유종목 화면을 캡처해서 아래 버튼으로 올리면 시작됩니다.</p>
        )}

        {holdings && holdings.length > 0 && (() => {
          const all = holdings.filter((h) => (view === "US" ? h.market === "US" : h.market !== "US"));
          const visible = all.filter((h) => !h.hidden);
          const hiddenCount = all.length - visible.length;
          const group = editing ? all : visible;
          const priced = visible.filter((h) => h.value_krw != null && h.cost_krw > 0);
          const gv = priced.reduce((a, h) => a + (h.value_krw ?? 0), 0);
          const gc = priced.reduce((a, h) => a + h.cost_krw, 0);
          const gPct = gc > 0 ? ((gv - gc) / gc) * 100 : 0;
          return (
            <>
              <div className="pf-toggle" role="tablist">
                <button className={`pf-toggle-btn${view === "KR" ? " on" : ""}`} role="tab" aria-selected={view === "KR"} onClick={() => switchView("KR")}>🇰🇷 국내</button>
                <button className={`pf-toggle-btn${view === "US" ? " on" : ""}`} role="tab" aria-selected={view === "US"} onClick={() => switchView("US")}>🇺🇸 해외</button>
              </div>

              <div className="pf-sec" style={{ cursor: "default" }}>
                <span className="pf-count">{visible.length}종목{hiddenCount > 0 ? ` · 숨김 ${hiddenCount}` : ""}</span>
                <span className="pf-sec-sum">{won(gv)}원<em className={plClass(gPct)}> {gPct > 0 ? "+" : ""}{gPct.toFixed(2)}%</em></span>
              </div>

              {group.length === 0 && <p className="empty">{view === "KR" ? "국내" : "해외"} 보유 종목이 없어요.</p>}
              {group.map((h) => (
                <div key={h.id} className={`pf-row${h.hidden ? " pf-hidden" : ""}`}>
                  <span className="pf-name">
                    {h.name}
                    <span className="pf-qty"> {h.quantity}주{!h.live && h.value_krw != null ? " · 캡처값" : ""}</span>
                  </span>
                  {h.value_krw != null ? (
                    <>
                      <span className="pf-value">{won(h.value_krw)}원</span>
                      <span className={`pf-pct ${plClass(h.pl_pct)}`}>
                        {h.pl_pct != null ? `${h.pl_pct > 0 ? "▲" : h.pl_pct < 0 ? "▼" : ""} ${Math.abs(h.pl_pct).toFixed(2)}%` : ""}
                      </span>
                    </>
                  ) : (
                    <button className="text-btn" style={{ marginLeft: "auto", color: "var(--signal)" }} onClick={() => fixCode(h)}>
                      코드 입력 필요
                    </button>
                  )}
                  {editing && (
                    <>
                      <button className="text-btn" onClick={() => setHidden(h, !h.hidden)} aria-label={h.hidden ? "표시" : "숨김"} style={{ display: "inline-flex" }}>
                        <span className="material-icons-round" style={{ fontSize: 16 }}>{h.hidden ? "visibility" : "visibility_off"}</span>
                      </button>
                      <button className="text-btn" onClick={() => fixCode(h)} style={{ fontSize: 11 }}>코드</button>
                    </>
                  )}
                </div>
              ))}
            </>
          );
        })()}

        <div className="run-actions" style={{ marginTop: 12 }}>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <button className="run-btn pf-btn" onClick={() => pick("KR")} disabled={busy}>
            <span className="material-icons-round" style={{ fontSize: 16 }}>{busy ? "hourglass_top" : "sync"}</span>
            🇰🇷 국내 캡처
          </button>
          <button className="run-btn pf-btn" onClick={() => pick("US")} disabled={busy}>
            <span className="material-icons-round" style={{ fontSize: 16 }}>{busy ? "hourglass_top" : "sync"}</span>
            🇺🇸 해외 캡처
          </button>
          {holdings && holdings.length > 0 && (
            <button className="run-btn" style={{ flex: "0 0 auto", padding: "9px 12px", background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)" }}
              onClick={() => setEditing((v) => !v)}>
              {editing ? "완료" : "편집"}
            </button>
          )}
        </div>
        {msg && <div className="cal-msg" style={{ margin: "8px 0 0" }}>{msg}</div>}
        <div className="stock-note">올린 시장(국내/해외)만 교체 · 시세 미확인 종목은 캡처값 표시 · 네이버 지연 시세 기준</div>
      </div>
      )}
    </section>
  );
}
