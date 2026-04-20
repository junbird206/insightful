# PROJECT_CONTEXT.md

## 프로젝트명
insightful

## 제품 한 줄
SNS 피드에서 발견한 유용한 게시물을 저장하고, 나중에 다시 읽거나(To Read) 실행할 수 있게(To Do) 회수해주는 모바일 세컨드 브레인.

---

## 핵심 정의
- 저장이 아니라 **회수(retrieval)**가 핵심
- 단순 북마크·AI 요약 앱이 아님
- 저장 후 망각되는 콘텐츠를 다시 꺼내 활용하도록 돕는 서비스

---

## MVP 구조

### 탭 구성
| 탭 | 역할 |
|---|---|
| **Recent** | 전체 저장물 최신순 피드 |
| **To Read** | 다시 읽고 싶은 저장물 |
| **To Do** | 실제로 적용·실행하고 싶은 저장물 |

### Bucket
- `read` — To Read
- `do` — To Do

### 데이터 모델 (Scrap)
`id`, `originalUrl`, `createdAt`, `openedAt`, `status`, `sourcePlatform`, `siteName`, `imageUrl`, `rawTitle`, `rawDescription`, `bucket`, `memo`, `tags`, `starred`, `suggestedMemo`, `remindAt`, `archivedAt`

---

## 핵심 기능

### 저장 (Add 화면 — 인앱)
- URL 입력 → bucket 선택 → 태그 선택(공용 pool에서) → 메모 입력 → 저장
- **suggestedMemo**: 링크 프리뷰 기반 자동 메모 초안 생성 (유료 API 미사용)
  - 우선순위: rawTitle → excerpt(본문 첫 문단) → rawDescription → 태그 → siteName
  - 형식: `{topic} — {읽어보기|실천해보기}`
- **추천 메모 UX**: 메모 필드에 회색 오버레이 텍스트로 표시 (`pointerEvents="none"`). 터치하면 사라지고 직접 입력 가능. 미터치 시 추천 메모가 저장값으로 사용됨.
- URL 입력 시 500ms debounce 후 백그라운드 메타데이터+excerpt 추출 (`extractLinkPreview`)
- 프리뷰가 이미 도착한 상태에서 저장하면 `status: 'done'`으로 바로 완료 (중복 fetch 방지)
- 프리뷰 로딩 중 저장 시 기존 `processScrap` 백그라운드 처리 경로 사용
- URL 입력창 우측 × 버튼 → 전체 폼 초기화
- 화면 우상단 × 버튼 → 취소 후 피드로 이동
- 리마인드 프리셋 (시간 선택 + 커스텀 날짜/시간 피커)

### 저장 (Share Extension — iOS 공유 시트)
- Safari/Instagram/X 등 외부 앱에서 공유 → insightful 선택
- **컴팩트 하단 카드 시트 UI** (UIKit 네이티브, Auto Layout 기반 bottom sheet)
  - UIScrollView 안에 UIStackView → 내용 길이에 맞게 카드 높이 자동 조절
  - `cardView.top >= safeArea.top + 20` 제한 → 내용 초과 시 스크롤
  - `scrollView.frameHeight = contentStack.height` (priority 750) → 카드가 내용을 감싸되, 화면 초과 시 깨짐 없이 스크롤
  - URL 바: 흰색 bg + `#E8E8E8` border, `cornerRadius: 8` (Add 화면 미러링)
  - bucket 선택 (📖 To Read / ⚡ To Do) — 흰색 bg + `#E8E8E8` border, `cornerRadius: 8`, `fontSize: 13` (Add 화면 미러링)
  - **태그 칩 바**: App Groups UserDefaults에서 tagPool 로드, 수평 스크롤, 선택 토글 + "추가" 버튼 — `cornerRadius: 16`, `padding: 8/14`
  - 메모 입력 — 흰색 bg + `#E8E8E8` border, `cornerRadius: 8`, 높이 48px + **추천 메모** (회색 텍스트, 터치 시 클리어 — Add 화면과 동일 UX)
  - 리마인드 프리셋 칩: 수평 스크롤, `fontSize: 13`, `cornerRadius: 16`, `padding: 8/14` (Add 화면과 동일 스타일)
  - 리마인드 선택 시: 🔔 미리보기 라벨 + **4열 커스텀 UIPickerView** 표시 (Add 화면의 RemindPicker와 동일 구조)
    - 4열: 날짜(오늘/내일/날짜) + 오전/오후 + 시(12시간제) + 분(5분 단위)
    - `#F7F7F7` 배경, `cornerRadius: 12`, 높이 180px
    - 날짜 옵션: 오늘부터 30일 (과거 날짜 없음)
  - 과거 시간 선택 시: 저장 버튼 비활성화(opacity 0.4) + 빨간 경고 "현재 시각 이후로 설정해주세요" (`#DC2626`)
  - 저장 버튼 "저장" → "저장됨" 피드백 → 자동 닫힘
  - **키보드 대응**: `keyboardWillChangeFrameNotification` 관찰 → cardBottom constraint 조정 → 카드 전체가 키보드 위로 이동
- 본앱을 열지 않고 extension 안에서 저장 완료
- **저장 방식**: App Groups UserDefaults (`group.com.juny.insightful`) pending queue
- **저장 데이터**: url, bucket, memo, remindAt, createdAt, tagsJson (JSON-encoded string array)
- **본앱 연동**: 본앱 foreground 시 pending queue 읽어서 import (`lib/import-pending.ts`)
- 기술 구현: 커스텀 `UIViewController`, 프로그래밍 방식 UI, NSExtensionPrincipalClass 방식

### 네이티브 브릿지 (InsightfulPendingQueue)
- **Swift 모듈**: `ios/insightful/InsightfulPendingQueue.swift`
- **Obj-C 브릿지**: `ios/insightful/InsightfulPendingQueue.m` (RCT_EXTERN_MODULE)
- **Bridging Header**: `ios/insightful/insightful-Bridging-Header.h` → `#import <React/RCTBridgeModule.h>`
- **기능**: `getPending()`, `clearPending()`, `setTagPool(tags)` — 모두 App Groups UserDefaults 경유
- **태그 동기화 흐름**: 본앱 `getTagPool()` → Supabase에서 로드 → `syncTagPoolToExtension()` → native module → UserDefaults → Share Extension `loadTagPool()`

### 로컬 알림 (expo-notifications)
- `lib/notifications.ts`: `requestNotificationPermission()`, `scheduleReminder()`, `cancelReminder()`, `cancelReminders()`
- 스크랩 ID를 notification identifier로 사용 → 정확한 취소/재스케줄
- `lib/storage.ts`의 CRUD에 훅: save→schedule, update→reschedule, delete/archive→cancel
- `app/_layout.tsx`에서 로그인 후 알림 권한 요청
- **aps-environment 이슈**: `expo-notifications` 플러그인이 자동 주입하는 Push entitlement이 무료 Personal Team에서 빌드 에러 유발 → `plugins/strip-push-entitlement.js` config plugin으로 제거

### 메타데이터 추출 (lib/extract.ts)
- `extractLinkPreview(url, {timeoutMs, signal})` → `{rawTitle, rawDescription, imageUrl, siteName, excerpt}`
- HTML fetch 후 OG/Twitter meta 태그 + `<article>`/`<main>` → `<p>` 본문 heuristic
- RESTRICTED_PLATFORMS (Instagram, Threads, X, Facebook, TikTok) → HTML 없이 siteName만 반환
- AbortController 기반 timeout(8s) + 외부 signal 취소 지원
- NOISE_PATTERNS 필터 (cookie, subscribe, copyright 등)

### 피드 (FeedScreen)
- **헤더 구조**:
  - 좌측: insightful 로고 이미지 (`assets/images/logo-wordmark.png`) — 탭 시 **좌측 사이드 메뉴** 열림
  - 우측 액션: `★ 중요만 | 선택 | 보관함 | 🔍 검색`
  - 햄버거(☰) 메뉴 제거 → 로고가 메뉴 진입점 역할
- **인라인 검색 모드** (우측 🔍 탭):
  - 헤더가 `[← 뒤로] [검색 입력창] [✕ 클리어]`로 전환, 키보드 자동 포커스
  - **검색어 대상**: `rawTitle` + `memo` 만 (URL/description/siteName 제외 → 노이즈 감소)
  - **최소 2글자** 이상 입력 시 텍스트 매칭 실행
  - **검색 조건 바** (태그 바 자리에 표시, 2행):
    - Row 1: 기간(`전체`/`오늘`/`이번 주`/`이번 달`) + 분류(`전체`/`To Read`/`To Do`)
    - Row 2: 출처(`모든 출처`/`Instagram`/`Twitter`/`YouTube`/`Web`) + 태그 칩
  - 모든 필터는 검색어와 AND 조합
  - 검색 중 기존 태그 바 숨김, 중요만/태그 필터 일시 해제
  - 선택 모드와 검색 모드는 배타적 (동시 활성화 불가)
- **태그 필터 바** (비검색 모드):
  - 수평 ScrollView에 pill 칩 (height 28, fontSize 12)
  - 오른쪽 끝에 `...` 버튼이 `position: absolute`로 오버레이 (그림자 효과로 플로팅 느낌)
  - `...` 탭 → pageSheet 모달로 전체 태그 목록 (flexWrap grid)
  - 전체 태그 시트에서 태그 토글 + 필터 초기화 + **태그 추가 (+) 버튼** (보라색 계열)
  - 다중 태그 선택 → **교집합(AND)** 필터
- 카드 좌 스와이프 → 보관 / 우 스와이프 → 삭제
- 스와이프 자동 닫힘: 다른 카드 스와이프, 스크롤, 다른 카드 탭 시 열린 스와이프 자동 복귀 (iOS Mail 패턴)
- swipe delete + undo toast (4초, 복수 카드 지원)
- 보관 toast ("보관함으로 이동됨")
- **다중 선택 모드**: 카드 long press → 체크박스 UI → 일괄 보관/삭제

### 편집 시트 (EditScrapSheet)
- 카드 long press → Modal pageSheet
- bucket 변경, 태그 선택, 메모 편집, 리마인드 변경
- **하단 full-width 저장 버튼** (상단 텍스트 버튼에서 변경)
- dirty check → 변경 없으면 저장 버튼 비활성화
- 취소 시 변경사항 있으면 Alert 확인

### 보관함 (ArchiveScreen)
- Modal pageSheet 형태, 보관된 카드만 표시
- 카드 우 스와이프 → 복원
- **다중 선택 모드**: long press → 체크박스 UI → 일괄 복구
- 스와이프 자동 닫힘 동일 적용

### 카드 (ScrapCard)
- 읽음 상태: opacity 아닌 **배경색(#F3F3F3) + 텍스트 톤 다운**으로 표현 (스와이프 시 오버레이 방지)
- 본문 표시 우선순위: memo → suggestedMemo → URL fallback (memo/suggestedMemo 동일 스타일)
- 탭 → 원문 열기 + openedAt 기록
- 카드 하단 태그 칩 표시
- 리마인드 라벨 (지남/오늘/내일/날짜)

### 태그 시스템
- **공용 tag pool** 기반 (Supabase `tag_pools` 테이블)
- 기본 태그: AI활용, 학교생활, 주식, 운동, 콘텐츠아이디어, 자기계발
- 메인 화면 상단 **태그 필터 바** (수평 스크롤 + `...` 오버레이 버튼)
- `...` → 전체 태그 시트 (flexWrap grid + 추가/초기화)
- 다중 태그 선택은 **AND(교집합)** — 회수 정밀도 우선
- 태그 관리: 생성(Add 화면, 태그 시트, Share Extension) / 이름 변경 / 삭제 (long press)
- **Share Extension 동기화**: 본앱 → `InsightfulPendingQueue.setTagPool()` → App Groups UserDefaults → Extension `loadTagPool()`

### 리마인드
- 프리셋: 오늘 저녁 (18:00), 내일 아침 (08:00) — AsyncStorage에 저장, 커스터마이즈 가능
- RemindPicker: 4열 커스텀 Picker (날짜, 오전/오후, 시, 분)
- 카드에 리마인드 라벨 표시 (지남 시 회색 처리)
- **로컬 알림 구현 완료**: expo-notifications, scrap ID 기반 스케줄/취소

### UI/UX 전역
- **StatusBar**: `style="dark"` 강제 (흰색 배경에서 시계/배터리 등 검정색으로 표시)
- **테마**: #111111 (fg), #FAFAFA (bg), #F0F0F0 (chip bg), #888888 (secondary text)
- **디자인 일관성 원칙**: Share Extension UI는 Add 화면의 미러 버전 — 같은 색상, 같은 cornerRadius, 같은 padding, 같은 picker 구조를 사용. 사용자가 공유 시트에서도 동일한 앱 경험을 받도록 설계.

---

## 기술 스택
- React Native (Expo ~54, React 19, New Architecture enabled)
- Supabase (Auth + Postgres DB + RLS)
- AsyncStorage (세션 persistence)
- expo-router (탭 네비게이션 + 인증 라우팅)
- expo-notifications (로컬 알림)
- react-native-gesture-handler (Swipeable) + react-native-reanimated
- @react-native-picker/picker (리마인드 wheel picker)
- expo-dev-client (development build)
- TypeScript strict mode

---

## 프로젝트 설정
- **bundleIdentifier**: `com.juny.insightful`
- **scheme**: `insightful`
- **Expo workflow**: Development Build (expo-dev-client)
- **Xcode**: 26.4 (iOS SDK 26.4)
- **DEVELOPMENT_TEAM**: `KHBBH8NY4T` (무료 Apple ID — 7일 서명)
- **GitHub**: `https://github.com/junbird206/insightful.git` (origin/main)

---

## iOS 네이티브 설정

### Xcode 프로젝트 구조
- `ios/` 폴더는 `npx expo prebuild --platform ios`로 생성
- **objectVersion**: 56 (CocoaPods 호환)

### Share Extension (InsightfulShare)
- **Target**: InsightfulShare (`com.juny.insightful.InsightfulShare`)
- **파일 위치**: `ios/InsightfulShare/`
  - `ShareViewController.swift` — 커스텀 UIViewController (하단 카드 시트, UIKit Auto Layout)
  - `Info.plist` — NSExtensionPrincipalClass 방식 (Storyboard 아님)
  - `InsightfulShare.entitlements` — App Groups
- **pbxproj**: InsightfulShare target, Embed Foundation Extensions, 수동 관리 필수

### Native Module (InsightfulPendingQueue)
- **파일 위치**: `ios/insightful/`
  - `InsightfulPendingQueue.swift` — getPending, clearPending, setTagPool
  - `InsightfulPendingQueue.m` — RCT_EXTERN_MODULE 브릿지
  - `insightful-Bridging-Header.h` — `#import <React/RCTBridgeModule.h>`
- **pbxproj**: main target (insightful)의 Compile Sources에 등록됨

### App Groups
- **identifier**: `group.com.juny.insightful`
- 양쪽 entitlements에 등록:
  - `ios/insightful/insightful.entitlements`
  - `ios/InsightfulShare/InsightfulShare.entitlements`

### Config Plugins
- `plugins/strip-push-entitlement.js` — expo-notifications가 주입하는 aps-environment 제거 (무료 Personal Team 빌드 호환)

### 빌드 명령어
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
cd ios && pod install && cd ..
npx expo run:ios --device

# DerivedData 초기화가 필요한 경우
rm -rf ~/Library/Developer/Xcode/DerivedData/insightful-*
```

### 중요 규칙
- **`npx expo prebuild --clean` 금지** — Share Extension target, App Groups, native module이 모두 파괴됨. 반드시 사전 경고 후 승인 필요.
- CocoaPods가 objectVersion 70을 지원하지 않음 → 56 유지 필수
- 무료 Apple ID는 7일마다 앱 서명 만료 → 재빌드 필요

---

## 주요 파일 구조

```
app/
  (auth)/          — 인증 화면 (로그인/회원가입)
  (tabs)/
    _layout.tsx    — 탭 네비게이션 설정
    index.tsx      — Recent 탭 (FeedScreen filter='recent')
    read.tsx       — To Read 탭
    do.tsx         — To Do 탭
    add.tsx        — 링크 저장 화면 (추천 메모 오버레이)
  _layout.tsx      — 루트 레이아웃 (인증 분기 + 알림 권한 요청)

components/
  feed-screen.tsx  — 피드 화면 (로고 헤더, 인라인 검색, 태그 필터 바, 스와이프, 다중선택, undo, 보관)
  scrap-card.tsx   — 카드 컴포넌트 (읽음 상태, 리마인드 등)
  edit-scrap-sheet.tsx — 편집 모달 (하단 저장 버튼)
  archive-screen.tsx — 보관함 Modal
  remind-picker.tsx — 리마인드 4열 Picker
  undo-toast.tsx   — 삭제 undo 토스트
  side-menu.tsx    — 좌측 사이드 메뉴 (로고 탭으로 진입)
  my-page.tsx      — 마이페이지

lib/
  auth.tsx         — Supabase Auth + 세션 관리
  storage.ts       — Supabase CRUD + 알림 스케줄 훅
  extract.ts       — URL 메타데이터 + 본문 excerpt 추출
  suggested-memo.ts — 링크 프리뷰 기반 suggestedMemo 생성
  process.ts       — 백그라운드 스크랩 처리
  remind-presets.ts — 리마인드 프리셋 설정
  tag-pool.ts      — 태그 풀 관리 (Supabase + Extension sync)
  notifications.ts — 로컬 알림 스케줄/취소
  pending-queue.ts — Native module 브릿지 (Share Extension ↔ 본앱)
  import-pending.ts — pending queue import 로직

plugins/
  strip-push-entitlement.js — aps-environment 제거 config plugin

assets/
  images/
    logo-wordmark.png — 앱 로고 워드마크 (헤더용, 883x327 투명 배경)

types/
  scrap.ts         — Scrap, Bucket, ScrapStatus, SourcePlatform 타입

supabase/
  schema.sql       — DB 스키마

ios/
  insightful/      — 메인 앱 네이티브 코드 + InsightfulPendingQueue 모듈
  InsightfulShare/  — Share Extension (수동 추가)
```

---

## 완료된 작업
1. ~~다중 선택 모드 구현~~ ✅
2. ~~링크 기반 suggestedMemo 자동 생성~~ ✅
3. ~~스와이프 자동 닫힘~~ ✅
4. ~~macOS 업그레이드 + Xcode 26.4 설치~~ ✅
5. ~~Development Build → 아이폰 실기 설치~~ ✅
6. ~~Share Extension 기본 동작 (공유 시트 노출)~~ ✅
7. ~~Share Extension 커스텀 UI (컴팩트 카드 시트)~~ ✅
8. ~~보관함 헤더 레이아웃 polish~~ ✅
9. ~~로컬 알림 구현 (expo-notifications)~~ ✅
10. ~~Push entitlement 빌드 에러 해결~~ ✅
11. ~~StatusBar 다크 모드 강제~~ ✅
12. ~~편집 시트 하단 저장 버튼 레이아웃~~ ✅
13. ~~Share Extension UI 전면 재작성 (태그, picker, 추천 메모, 키보드 대응)~~ ✅
14. ~~InsightfulPendingQueue 네이티브 모듈 복원~~ ✅
15. ~~Add 화면 추천 메모 오버레이 UX~~ ✅
16. ~~메인 화면 태그 필터 바 구현 (스크롤 + ... 오버레이 + 전체 태그 시트)~~ ✅
17. ~~액션 바 / 태그 바 시각적 계층 분리~~ ✅
18. ~~태그 시트에서 태그 추가(+) 기능~~ ✅
19. ~~GitHub 원격 레포 연결 + push~~ ✅
20. ~~Share Extension DatePicker 시인성 수정 (light mode 강제, 5분 단위, 과거 시간 차단)~~ ✅
21. ~~메인 화면 헤더에 로고 이미지 적용 (텍스트 → PNG 워드마크)~~ ✅
22. ~~헤더 구조 개편: 로고 탭 → 좌측 사이드 메뉴, 햄버거 → 검색 버튼~~ ✅
23. ~~사이드 메뉴 우측→좌측 슬라이드 전환~~ ✅
24. ~~인라인 검색 모드 구현 (제목/메모 검색 + 기간/분류/출처/태그 필터 조건 바)~~ ✅
25. ~~Share Extension UI를 Add 화면과 미러링~~ ✅
    - UIDatePicker(.wheels) → 4열 커스텀 UIPickerView
    - URL/메모/bucket 스타일을 Add 화면과 통일 (흰 bg + border)
    - 리마인드 프리셋 칩 스타일 통일
    - 태그 칩 padding 통일
    - 과거 시간 경고 + 저장 버튼 비활성화

## 다음 작업 (우선순위)
1. **Share Extension 실기 테스트** — Xcode rebuild 후 전체 UI 확인 (4열 picker, 스타일 통일, 과거 시간 경고)
2. **검색 UX 실기 테스트** — 검색 모드 진입/종료, 필터 조합, 결과 확인
3. **Pending queue import 실기 테스트** — Share Extension → 본앱 foreground → 카드 생성 확인
4. **알림 실기 테스트** — 리마인드 설정 → 시간 경과 후 알림 수신 확인
5. Apple Developer 등록 → TestFlight 배포
6. UX polish (카드 디자인, 애니메이션 등)

---

## 시연·심사 기준
- **최종 형태**: 모바일 앱 (PC는 보조 확장)
- **대회 심사 우선순위**: 기획 선명도 → 구현 완성도 → UX 일관성
- 학생개발자 소프트웨어 경진대회 출품작
