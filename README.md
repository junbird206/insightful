# Insightful

> 다시 꺼내 쓰는 지식을 위한 스크랩 앱

링크 하나만 공유해도 자동으로 제목·이미지·요약이 만들어지고, 태그·메모를 붙여 보관한 뒤 원하는 시간에 다시 꺼내볼 수 있습니다.
모바일은 빠르게 담고, 웹은 차분하게 정리하는 두 가지 흐름을 한 백엔드 위에서 동시에 제공합니다.

---

## 데모

- **웹 대시보드**: https://insightful-ten.vercel.app
- **iOS TestFlight**: `_TODO: TestFlight invite link_`
- **심사용 데모 계정**: `user@example.com` / `12345678`

---

## 핵심 기능

### 빠르게 담기
- iOS **Share Extension** (`InsightfulShare`) — 사파리·트위터·뉴스 앱 어디서든 공유 시트에서 한 번에 스크랩
- 백그라운드 큐로 오프라인에서도 공유 가능, 앱 진입 시 자동 처리
- OpenGraph / oEmbed 기반 메타데이터 자동 추출 (제목, 썸네일, 사이트명)

### 정리하기 좋은 카드 UX
- `read` / `do` 두 가지 버킷으로 의도 구분
- 태그 풀(`tag_pools`)로 한 번 쓴 태그는 다른 카드에서도 빠르게 재사용
- 인라인 검색, 멀티 셀렉트, 아카이브, 별표(starred)
- 옅은 메모 자동 제안 (suggested memo) — 본문에서 핵심 한 줄 뽑아 제시

### 다시 꺼내 쓰기
- **리마인드 프리셋**: "오늘 저녁", "내일 아침" 같은 개인화된 알림 슬롯을 직접 설계
- 매일 정해진 시간에 미열람 스크랩을 보여주는 **데일리 리마인더**
- 알림은 로컬 노티(`expo-notifications`)로 즉시 동작

### 웹 대시보드 (Next.js)
- 모바일과 동일한 Supabase를 바라보며 카드 검색·아카이브·태그 정리에 최적화
- 호버 마이크로 인터랙션, 정돈된 타이포그래피
- Toss-스타일 이메일 회원가입 / 로그인 (Google OAuth 없음)

---

## 모노레포 구조

```
insightful/
├── app/                    # 모바일 앱 — Expo Router 화면 (auth, tabs, modal)
├── components/             # 모바일 UI 컴포넌트 (feed-screen, scrap-card, side-menu …)
├── lib/                    # 모바일 도메인 로직 (auth, supabase, notifications,
│                           #                   remind-presets, errors, …)
├── plugins/                # Expo config plugins (strip-push-entitlement 등)
├── ios/                    # 네이티브 iOS 프로젝트
│   ├── insightful/         # 메인 앱 타겟
│   └── InsightfulShare/    # Share Extension 타겟 (Swift)
├── apps/
│   └── web/                # Next.js 15 대시보드
│       ├── app/            # App Router 페이지 (login, signup, dashboard)
│       ├── components/     # 웹 전용 컴포넌트
│       └── lib/            # 웹 도메인 로직 (auth, scraps, errors, …)
├── supabase/
│   └── schema.sql          # Postgres 스키마 + RLS 정책 + RPC
└── CLAUDE.md               # 개발 가이드 (Xcode 빌드 영향, prebuild 금지 등)
```

---

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| 모바일 | Expo SDK 54, React Native 0.81, Expo Router, Reanimated 4 |
| 웹 | Next.js 15 (App Router), React 19 |
| 백엔드 | Supabase (Postgres + Auth + RLS) |
| 알림 | `expo-notifications` (로컬) |
| 네이티브 확장 | iOS Share Extension (Swift) + App Groups |
| 언어 | TypeScript, Swift |

---

## 데이터 모델

`supabase/schema.sql`에 전체 스키마가 정의되어 있습니다.

- **`scraps`** — 모든 스크랩 카드. RLS로 `auth.uid() = user_id` 강제
- **`tag_pools`** — 사용자별 태그 사전 (jsonb 배열, upsert로 관리)
- **`remind_presets`** — 사용자별 알림 프리셋 배열
- **`delete_own_account()`** — 본인 데이터 + auth 계정 삭제 RPC (SECURITY DEFINER)

---

## 로컬에서 실행하기

### 사전 준비
1. Supabase 프로젝트 생성 후 `supabase/schema.sql` SQL Editor에서 실행
2. 루트와 `apps/web/`에 각각 `.env` 파일 복사:

```bash
# 루트(.env) — 모바일용
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# apps/web/.env — 웹용
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 모바일 (iOS)

```bash
npm install
npx pod-install ios           # CocoaPods 설치 (Share Extension 포함)
npx expo run:ios              # 시뮬레이터 / 실기기 실행
```

> ⚠️ `npx expo prebuild --clean`은 절대 실행하지 마세요. 수동으로 추가한
> Share Extension 타겟과 App Groups entitlement가 모두 삭제됩니다.
> 자세한 내용은 `CLAUDE.md` 참고.

### 웹 (Next.js)

```bash
cd apps/web
npm install
npm run dev                   # http://localhost:3000
```

---

## 인증 흐름

- 이메일 + 비밀번호 + 닉네임 기반 가입 (`signUp(email, password, nickname)`)
- 닉네임은 별도 테이블 없이 `auth.users.user_metadata.nickname`에 저장 → 첫 세션부터 추가 RTT 없이 즉시 사용 가능
- 모든 Supabase 에러 메시지는 `lib/errors.ts` (모바일) / `apps/web/lib/errors.ts` (웹)의 `translateAuthError` / `describeDataError`로 한국어 안내 문구에 매핑

---

## 라이선스

해커톤 제출용 데모 프로젝트입니다.
