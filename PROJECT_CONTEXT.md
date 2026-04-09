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
- URL 입력 시 500ms debounce 후 백그라운드 메타데이터+excerpt 추출 (`extractLinkPreview`)
- 프리뷰가 이미 도착한 상태에서 저장하면 `status: 'done'`으로 바로 완료 (중복 fetch 방지)
- 프리뷰 로딩 중 저장 시 기존 `processScrap` 백그라운드 처리 경로 사용
- URL 입력창 우측 × 버튼 → 전체 폼 초기화
- 화면 우상단 × 버튼 → 취소 후 피드로 이동
- 리마인드 프리셋 (시간 선택 + 커스텀 날짜/시간 피커)

### 저장 (Share Extension — iOS 공유 시트)
- Safari/Instagram/X 등 외부 앱에서 공유 → insightful 선택
- **컴팩트 하단 카드 시트 UI** (에어드롭 스타일, 전체 화면 아님)
  - 공유된 URL 호스트명 표시
  - bucket 선택 (읽을 거리 / 해볼 거리)
  - 한 줄 메모 입력
  - 리마인드 프리셋 (없음 / 오늘 저녁 / 내일 아침)
  - 저장 버튼 → "저장됨" 피드백 → 자동 닫힘
- 본앱을 열지 않고 extension 안에서 저장 완료
- **저장 방식**: App Groups UserDefaults (`group.com.juny.insightful`) pending queue
- **본앱 연동**: 본앱 foreground 시 pending queue 읽어서 처리 (미구현 — 다음 작업)
- 기술 구현: 커스텀 `UIViewController` (SLComposeServiceViewController 제거), 프로그래밍 방식 UI, NSExtensionPrincipalClass 방식

### 메타데이터 추출 (lib/extract.ts)
- `extractLinkPreview(url, {timeoutMs, signal})` → `{rawTitle, rawDescription, imageUrl, siteName, excerpt}`
- HTML fetch 후 OG/Twitter meta 태그 + `<article>`/`<main>` → `<p>` 본문 heuristic
- RESTRICTED_PLATFORMS (Instagram, Threads, X, Facebook, TikTok) → HTML 없이 siteName만 반환
- AbortController 기반 timeout(8s) + 외부 signal 취소 지원
- NOISE_PATTERNS 필터 (cookie, subscribe, copyright 등)

### 피드 (FeedScreen)
- 카드 좌 스와이프 → 보관 / 우 스와이프 → 삭제
- 스와이프 자동 닫힘: 다른 카드 스와이프, 스크롤, 다른 카드 탭 시 열린 스와이프 자동 복귀 (iOS Mail 패턴)
- swipe delete + undo toast (4초, 복수 카드 지원)
- 보관 toast ("보관함으로 이동됨")
- ★ 중요만 필터, 보관함 버튼, 사이드 메뉴
- **다중 선택 모드**: 카드 long press → 체크박스 UI → 일괄 보관/삭제
  - 일괄 보관: 확인 없이 즉시
  - 일괄 삭제: Alert 확인 → undo toast
  - 스와이프 비활성, FAB 숨김

### 보관함 (ArchiveScreen)
- Modal pageSheet 형태, 보관된 카드만 표시
- 카드 우 스와이프 → 복원
- **다중 선택 모드**: long press → 체크박스 UI → 일괄 복구
- 스와이프 자동 닫힘 동일 적용
- **헤더**: 커스텀 정렬 — 제목 절대 중앙, 닫기 버튼 좌측 absolute 배치, pageSheet이므로 SafeAreaView 불필요

### 카드 (ScrapCard)
- 읽음 상태: opacity 아닌 **배경색(#F3F3F3) + 텍스트 톤 다운**으로 표현 (스와이프 시 오버레이 방지)
- 본문 표시 우선순위: memo → suggestedMemo → URL fallback (memo/suggestedMemo 동일 스타일)
- 탭 → 원문 열기 + openedAt 기록
- 카드 하단 태그 칩 표시
- 리마인드 라벨 (지남/오늘/내일/날짜)

### 태그 시스템
- **공용 tag pool** 기반 — 저장 화면에서는 기존 태그 선택만, 생성은 태그 관리에서
- 검색창 아래 **태그 바**(가로 스크롤) + **전체 태그 시트**(⋯ 버튼)
- 다중 태그 선택은 **AND(교집합)** — 회수 정밀도 우선
- 태그 시트에서 적용한 태그만 좌측 promote, 인라인 탭은 순서 변경 없음 (`promotedTags` 패턴)
- 태그 관리: 생성 / 이름 변경 / 삭제 (long press)

### 회수·필터
- memo 기반 텍스트 검색
- 태그 필터 (AND)
- starred 필터
- unread 필터

### 리마인드
- 프리셋 기반 날짜 선택 + DateTimePicker 커스텀
- 카드에 리마인드 라벨 표시 (지남 시 회색 처리)
- 실제 푸시 알림은 미구현 (expo-notifications 예정)

---

## 기술 스택
- React Native (Expo ~54, React 19, New Architecture enabled)
- Supabase (Auth + Postgres DB + RLS)
- AsyncStorage (세션 persistence)
- expo-router (탭 네비게이션 + 인증 라우팅)
- react-native-gesture-handler (Swipeable) + react-native-reanimated
- expo-dev-client (development build)
- TypeScript strict mode

---

## 프로젝트 설정
- **bundleIdentifier**: `com.juny.insightful`
- **scheme**: `insightful`
- **Expo workflow**: Development Build (expo-dev-client)
- **Xcode**: 26.4 (iOS SDK 26.4)
- **DEVELOPMENT_TEAM**: `KHBBH8NY4T` (무료 Apple ID — 7일 서명)

---

## iOS 네이티브 설정 (2026-04-10 기준)

### Xcode 프로젝트 구조
- `ios/` 폴더는 `npx expo prebuild --platform ios`로 생성 (`.gitignore`에 포함, 커밋 안 함)
- **objectVersion**: 56 (CocoaPods 호환 — Xcode 16+ 기본값 70에서 수동 다운그레이드)
- **주의**: Xcode가 프로젝트를 다시 열면 objectVersion을 70으로 올릴 수 있음 → `pod install` 깨짐 → 56으로 되돌려야 함

### Share Extension (InsightfulShare)
- **Target**: InsightfulShare (`com.juny.insightful.InsightfulShare`)
- **파일 위치**: `ios/InsightfulShare/`
  - `ShareViewController.swift` — 커스텀 UIViewController (하단 카드 시트)
  - `Info.plist` — NSExtensionPrincipalClass 방식 (Storyboard 아님)
  - `InsightfulShare.entitlements` — App Groups
  - `Base.lproj/MainInterface.storyboard` — 미사용 (레거시, 제거 가능)
- **Scheme**: `insightful.xcscheme`에 InsightfulShare BuildActionEntry 명시적 추가됨
- **pbxproj 수동 관리 항목**:
  - PBXFileSystemSynchronizedRootGroup 제거 → 전통적 PBXGroup + 명시적 PBXFileReference로 변환
  - objectVersion 56 유지
  - InsightfulShare Sources/Resources 빌드 페이즈에 파일 명시적 등록
  - Embed Foundation Extensions (dstSubfolderSpec=13) → PlugIns/InsightfulShare.appex

### App Groups
- **identifier**: `group.com.juny.insightful`
- 양쪽 entitlements에 등록 완료:
  - `ios/insightful/insightful.entitlements`
  - `ios/InsightfulShare/InsightfulShare.entitlements`

### 빌드 명령어
```bash
# xcode-select 확인 (CommandLineTools가 아닌 Xcode.app이어야 함)
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

# pod install + 빌드
cd ios && pod install && cd ..
npx expo run:ios --device

# DerivedData 초기화가 필요한 경우
rm -rf ~/Library/Developer/Xcode/DerivedData/insightful-*
```

### 알려진 이슈
- `expo prebuild --clean` 실행 시 ios/ 폴더가 재생성되므로, Share Extension 관련 수동 설정(InsightfulShare target, scheme, entitlements, objectVersion 56)이 모두 사라짐 → prebuild 후 재설정 필요
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
    add.tsx        — 링크 저장 화면
  _layout.tsx      — 루트 레이아웃 (인증 분기)

components/
  feed-screen.tsx  — 피드 화면 (스와이프, 다중선택, undo, 보관)
  scrap-card.tsx   — 카드 컴포넌트 (읽음 상태, 리마인드 등)
  archive-screen.tsx — 보관함 Modal (커스텀 헤더 정렬)
  undo-toast.tsx   — 삭제 undo 토스트
  remind-picker.tsx — 리마인드 DateTimePicker
  side-menu.tsx    — 사이드 메뉴
  my-page.tsx      — 마이페이지

lib/
  auth.tsx         — Supabase Auth + 세션 관리
  storage.ts       — Supabase CRUD (save, get, update, delete, bulk ops)
  extract.ts       — URL 메타데이터 + 본문 excerpt 추출
  suggested-memo.ts — 링크 프리뷰 기반 suggestedMemo 생성
  process.ts       — 백그라운드 스크랩 처리 (fetch → suggestedMemo 재생성 → DB 업데이트)
  remind-presets.ts — 리마인드 프리셋 설정
  tag-pool.ts      — 태그 풀 관리

types/
  scrap.ts         — Scrap, Bucket, ScrapStatus, SourcePlatform 타입

supabase/
  schema.sql       — DB 스키마

ios/ (gitignore, prebuild로 생성)
  insightful/      — 메인 앱 네이티브 코드
  InsightfulShare/  — Share Extension (수동 추가)
```

---

## MVP 제외 항목
- To Go bucket / regionLabel / areaLabel / 지도 기반 UX
- AI API 호출 (유료 API 미사용 원칙)
- 자동 태그 부착
- 실제 푸시 리마인드 (expo-notifications)
- reference / 미감 / 코디 등 초기 실험 기능

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

## 다음 작업 (우선순위)
1. **Share Extension 실기 테스트** — 빌드 후 공유 시트에서 커스텀 UI 확인
2. **본앱에서 pending queue 읽기** — App Groups UserDefaults → 본앱 foreground 시 import
3. **Share Extension 태그 지원** — 본앱이 tag pool을 App Groups에 sync → extension에서 읽기
4. Supabase 프로젝트 생성 + 환경변수 설정 + schema.sql 실행
5. 이메일 인증 + 동기화 E2E 테스트
6. 실제 푸시 리마인드 구현 (expo-notifications)
7. Apple Developer 등록 → TestFlight 배포

---

## 시연·심사 기준
- **최종 형태**: 모바일 앱 (PC는 보조 확장)
- **대회 심사 우선순위**: 기획 선명도 → 구현 완성도 → UX 일관성
- 학생개발자 소프트웨어 경진대회 출품작
