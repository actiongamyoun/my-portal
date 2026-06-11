import { auth, signIn, signOut } from "@/auth";
import Dashboard from "@/components/Dashboard";

function kstGreeting() {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hour12: false }).format(new Date())
  );
  if (h < 6) return "고요한 새벽이에요";
  if (h < 12) return "좋은 아침이에요";
  if (h < 18) return "활기찬 오후예요";
  return "수고 많았어요, 저녁이에요";
}

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="signin-wrap">
        <div className="signin-card">
          <div className="signin-logo">
            <span className="material-icons-round">dashboard</span>
          </div>
          <div className="signin-title">MY PORTAL</div>
          <p className="signin-desc">
            일정 · 메일 · 할일 · 뉴스를 한 화면에서.
            <br />
            Google 계정으로 시작하세요.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button className="google-btn" type="submit">
              <span className="material-icons-round">login</span>
              Google로 로그인
            </button>
          </form>
        </div>
      </div>
    );
  }

  const name = session.user.name?.split(" ")[0] ?? "찐";
  const dateStr = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  }).format(new Date());

  return (
    <main className="shell">
      <div className="topbar">
        <div className="greet">
          {kstGreeting()}, {name} 님
          <span className="date">{dateStr}</span>
        </div>
        <div className="topbar-right">
          {session.user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar" src={session.user.image} alt="프로필" />
          )}
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button className="signout-btn" type="submit">로그아웃</button>
          </form>
        </div>
      </div>
      <Dashboard />
    </main>
  );
}
