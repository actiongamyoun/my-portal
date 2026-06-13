export const POLICY_CATEGORIES: Record<string, { icon: string; color: string; emoji: string }> = {
  "경제·금융":     { icon: "account_balance",    color: "#166F5B", emoji: "💰" },
  "부동산":        { icon: "apartment",          color: "#A0522D", emoji: "🏠" },
  "산업·과학기술": { icon: "science",            color: "#2D5BA8", emoji: "🔬" },
  "외교·안보":     { icon: "public",             color: "#6B4FA0", emoji: "🌐" },
  "에너지·환경":   { icon: "bolt",               color: "#3F7A33", emoji: "⚡" },
  "사회·복지":     { icon: "volunteer_activism", color: "#B23A5E", emoji: "🤝" },
  "행정·정치":     { icon: "gavel",              color: "#5A6470", emoji: "🏛" },
  "기타":          { icon: "category",           color: "#7A7568", emoji: "📌" },
};
export const CATEGORY_LIST = Object.keys(POLICY_CATEGORIES);

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
}
