import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken || session.error)
    return NextResponse.json({ error: "auth" }, { status: 401 });

  const h = { Authorization: `Bearer ${session.accessToken}` };
  const base = "https://gmail.googleapis.com/gmail/v1/users/me";

  try {
    const [listRes, labelRes] = await Promise.all([
      fetch(`${base}/messages?q=is:unread%20category:primary&maxResults=6`, { headers: h, cache: "no-store" }),
      fetch(`${base}/labels/INBOX`, { headers: h, cache: "no-store" }),
    ]);
    if (!listRes.ok) throw new Error("gmail list");
    const list = await listRes.json();
    const label = labelRes.ok ? await labelRes.json() : {};
    const ids: { id: string }[] = list.messages ?? [];

    const messages = await Promise.all(
      ids.map(async (m) => {
        const r = await fetch(
          `${base}/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: h, cache: "no-store" }
        );
        const d = await r.json();
        const hd = (name: string) =>
          d.payload?.headers?.find((x: { name: string; value: string }) => x.name === name)?.value ?? "";
        return {
          id: m.id,
          from: hd("From").replace(/<.*>/, "").replace(/"/g, "").trim(),
          subject: hd("Subject"),
          date: hd("Date"),
          snippet: d.snippet ?? "",
        };
      })
    );
    return NextResponse.json({ unread: label.messagesUnread ?? messages.length, messages });
  } catch {
    return NextResponse.json({ error: "fetch" }, { status: 500 });
  }
}
