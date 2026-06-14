"use client";

import { useEffect, useRef, useState } from "react";

// 서버(prefs)와 동기화되는 상태. localStorage를 캐시로 써서 즉시 표시하고,
// 마운트 시 서버 값으로 덮어쓰며, 변경 시 디바운스로 서버에 저장한다.
export function useSyncedState<T>(key: string, initial: T) {
  const lsKey = `portal.sync.${key}`;
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true);

  // 1) localStorage 캐시 즉시 로드 → 2) 서버 값으로 동기화
  useEffect(() => {
    let alive = true;
    try {
      const cached = localStorage.getItem(lsKey);
      if (cached) setValue(JSON.parse(cached));
    } catch {}

    fetch(`/api/prefs?key=${key}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!alive) return;
        if (d.value !== null && d.value !== undefined) {
          setValue(d.value);
          try { localStorage.setItem(lsKey, JSON.stringify(d.value)); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) { skipSave.current = true; setReady(true); } });

    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 변경 시: localStorage 즉시 + 서버 디바운스 저장
  useEffect(() => {
    if (!ready) return;
    if (skipSave.current) { skipSave.current = false; return; }
    try { localStorage.setItem(lsKey, JSON.stringify(value)); } catch {}
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch("/api/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      }).catch(() => {});
    }, 600);
  }, [value, ready, key, lsKey]);

  return [value, setValue, ready] as const;
}
