// 공유 헬퍼: 모바일은 네이티브 공유 시트, 미지원 시 클립보드 복사
export async function shareItem(title: string, url: string, summary?: string): Promise<"shared" | "copied" | "fail"> {
  const text = summary ? `${title}\n\n${summary}` : title;
  try {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share({ title, text, url });
      return "shared";
    }
  } catch {
    return "fail"; // 사용자가 취소한 경우 등
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return "copied";
  } catch {
    return "fail";
  }
}
