# MY PORTAL — 나의 통합 대시보드

일정 · Gmail · 할일 · 메모 · 뉴스 · 날씨 · 환율 · 내 앱 바로가기를 한 화면에.

- **스택**: Next.js 15 + React 19 + NextAuth v5 (Google OAuth) + Vercel
- **디자인**: 3컬럼 그리드, Material Icons Round, Pretendard + IBM Plex Mono
- **PWA**: manifest + 아이콘 포함 (홈 화면 추가 가능)

---

## 1. Google Cloud Console 설정 (필수)

1. https://console.cloud.google.com → 새 프로젝트 생성 (예: `my-portal`)
2. **API 및 서비스 → 라이브러리**에서 아래 2개 검색 후 "사용 설정":
   - **Gmail API**
   - **Google Calendar API**
3. **API 및 서비스 → OAuth 동의 화면**:
   - User Type: **외부** → 앱 이름/이메일 입력
   - 범위 추가: `gmail.readonly`, `calendar.readonly`
   - 테스트 사용자에 본인 Gmail 주소 추가 (게시 전 상태에서는 테스트 사용자만 로그인 가능 — 개인용이면 이 상태로 충분)
4. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**:
   - 유형: **웹 애플리케이션**
   - 승인된 리디렉션 URI에 추가:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://내도메인.vercel.app/api/auth/callback/google` (배포 후)
   - 생성된 **클라이언트 ID / 보안 비밀번호** 복사

## 2. 환경변수

`.env.example`을 복사해 `.env.local` 생성:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AUTH_SECRET=          ← openssl rand -base64 32 로 생성
AUTH_URL=http://localhost:3000
OPENWEATHER_API_KEY=  ← 기존 이슬점 계산기에 쓰던 키 재사용 가능
WEATHER_LAT=35.163
WEATHER_LON=129.163
NAVER_CLIENT_ID=      ← developers.naver.com → 애플리케이션 등록 → 검색 API
NAVER_CLIENT_SECRET=
```

## 3. 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

## 4. Vercel 배포

1. GitHub 새 repo에 push → Vercel Import
2. Vercel 환경변수에 위 항목 전부 입력 (`AUTH_URL`은 배포 도메인으로)
3. 배포 도메인을 Google Cloud Console 리디렉션 URI에 추가 (1-4 참고)

## 위젯 구성

| 위치 | 위젯 | 데이터 |
|---|---|---|
| 상단 칩 | 시계 / 날씨 / 환율 | KST · OpenWeatherMap · frankfurter.app |
| 1열 | 오늘 일정 / 할일 | Google Calendar API · localStorage |
| 2열 | Gmail 미읽음 / 메모 | Gmail API · localStorage (자동저장) |
| 3열 | 뉴스(구글RSS·네이버) / 내 앱 | RSS + 네이버 검색 API · localStorage(편집 가능) |

## 확장 포인트 (Phase 2 후보)

- 할일/메모 Supabase 동기화 (크로스 디바이스)
- 위젯 순서 드래그 변경
- Gmail AI 요약 (Claude API)
- 주식/코인 시세 칩 추가

## 주의

- 미읽음 메일이 있으면 카드 좌측 틱이 **시그널 오렌지**로 바뀝니다.
- "내 앱" 카드는 편집 버튼으로 추가/삭제 가능, localStorage 저장.
- OAuth 동의 화면이 "테스트" 상태면 refresh token이 7일 후 만료될 수 있음 → 개인용이라면 재로그인하거나, 동의 화면을 "프로덕션"으로 게시하면 해소.
