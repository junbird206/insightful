import Link from 'next/link'

import { SiteFooter } from '@/components/site-footer'

export const metadata = {
  title: '개인정보처리방침 · Insightful',
  description: 'Insightful 서비스의 개인정보처리방침입니다.',
}

export default function PrivacyPage() {
  return (
    <>
      <main className="legal-shell">
        <div className="legal-topbar">
          <Link className="legal-back" href="/">
            ← 홈으로
          </Link>
        </div>

        <article className="legal-article">
          <header className="legal-header">
            <p className="eyebrow">Privacy</p>
            <h1>개인정보처리방침</h1>
            <p className="legal-meta">최종 업데이트: 2026년 4월 20일</p>
          </header>

          <section>
            <h2>1. 수집하는 개인정보 항목</h2>
            <p>
              인사이트풀(이하 &ldquo;서비스&rdquo;)은 서비스 제공을 위해 다음의 정보를 수집합니다.
            </p>
            <ul>
              <li>
                <strong>계정 정보:</strong> 이메일 주소, 비밀번호(암호화 저장), 닉네임, Google
                계정 연동 시 Google에서 제공하는 기본 프로필 정보
              </li>
              <li>
                <strong>이용 데이터:</strong> 사용자가 직접 저장한 링크(URL), 메모, 태그, 저장 목적,
                리마인드 시각, 별표(중요표시) 등
              </li>
              <li>
                <strong>기기/접속 정보:</strong> 모바일 앱 푸시 알림을 위한 디바이스 토큰, 접속
                IP 주소, 브라우저/OS 정보 (서비스 안정성 목적)
              </li>
            </ul>
          </section>

          <section>
            <h2>2. 개인정보의 수집 및 이용 목적</h2>
            <ul>
              <li>회원 식별 및 로그인 인증</li>
              <li>저장 카드(스크랩) 동기화 및 사용자별 라이브러리 제공</li>
              <li>리마인드 알림 발송</li>
              <li>서비스 안정성 모니터링 및 오류 대응</li>
              <li>이용자 문의 응대</li>
            </ul>
          </section>

          <section>
            <h2>3. 개인정보의 보유 및 이용 기간</h2>
            <p>
              회원 탈퇴 시 모든 개인정보 및 이용 데이터는 즉시 삭제됩니다. 단, 관련 법령에 따라
              보관이 필요한 경우(예: 부정 이용 기록 등)는 해당 법령에서 정한 기간 동안 보관할 수
              있습니다.
            </p>
          </section>

          <section>
            <h2>4. 개인정보의 처리 위탁 및 제3자 제공</h2>
            <p>
              서비스는 안정적인 운영을 위해 다음 업체에 일부 처리 업무를 위탁하고 있습니다.
            </p>
            <ul>
              <li>
                <strong>Supabase, Inc.</strong> — 사용자 인증 및 데이터베이스 호스팅
              </li>
              <li>
                <strong>Apple Inc. / Google LLC</strong> — 모바일 푸시 알림 전송 (APNs / FCM)
              </li>
            </ul>
            <p>위 위탁 외에는 이용자의 개인정보를 제3자에게 제공하지 않습니다.</p>
          </section>

          <section>
            <h2>5. 이용자의 권리</h2>
            <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
            <ul>
              <li>본인 정보의 열람·수정 (서비스 내 닉네임/카드 편집 기능)</li>
              <li>회원 탈퇴 및 데이터 삭제 요청</li>
              <li>개인정보 처리에 대한 문의 및 이의 제기</li>
            </ul>
            <p>
              회원 탈퇴는 모바일 앱의 설정 메뉴에서 진행할 수 있으며, 그 외 사항은 아래 문의처로
              연락주시기 바랍니다.
            </p>
          </section>

          <section>
            <h2>6. 쿠키 및 로컬 저장소 사용</h2>
            <p>
              서비스는 로그인 세션 유지를 위해 브라우저의 로컬 저장소(localStorage)를 사용합니다.
              광고 또는 행동 추적용 쿠키는 사용하지 않습니다.
            </p>
          </section>

          <section>
            <h2>7. 개인정보 보호 책임자 및 문의처</h2>
            <ul>
              <li>운영자: 정성준 (Junbird)</li>
              <li>
                이메일:{' '}
                <a href="mailto:junbird521@gmail.com">junbird521@gmail.com</a>
              </li>
            </ul>
          </section>

          <section>
            <h2>8. 개정 안내</h2>
            <p>
              본 방침은 서비스 정책 변경 또는 관련 법령 개정에 따라 수정될 수 있으며, 변경 시
              공지사항 또는 본 페이지를 통해 사전 안내합니다.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  )
}
