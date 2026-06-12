"use client";

import { useEffect, useState } from "react";

const KEY = "portal.collapse.v1";

export function useCollapse(id: string) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(!!JSON.parse(localStorage.getItem(KEY) ?? "{}")[id]);
    } catch {}
  }, [id]);

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        const all = JSON.parse(localStorage.getItem(KEY) ?? "{}");
        all[id] = next;
        localStorage.setItem(KEY, JSON.stringify(all));
      } catch {}
      return next;
    });

  return { collapsed, toggle };
}
