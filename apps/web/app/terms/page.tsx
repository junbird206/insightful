import Link from 'next/link'

import { SiteFooter } from '@/components/site-footer'

export const metadata = {
  title: '이용약관 · Insightful',
  description: 'Insightful 서비스 이용약관입니다.',
}

export default function TermsPage() {
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
            <p className="eyebrow">Terms</p>
            <h1>이용약관</h1>
            <p className="legal-meta">최종 업데이트: 2026년 4월 20일</p>
          </header>

          <section>
            <h2>제1조 (목적)</h2>
            <p>
              본 약관은 정성준(이하 &ldquo;운영자&rdquo;)이 제공하는 인사이트풀(이하
              &ldquo;서비스&rdquo;)의 이용 조건 및 절차, 이용자와 운영자의 권리·의무·책임 사항을
              규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2>제2조 (서비스의 제공)</h2>
            <ul>
              <li>이용자가 저장한 링크·메모·태그·리마인드를 보관하고 동기화합니다.</li>
              <li>모바일 앱과 웹 환경에서 동일한 라이브러리를 제공합니다.</li>
              <li>
                현재 본 서비스는 무료 MVP(Minimum Viable Product) 단계로 제공되며, 기능·디자인·
                사양은 사전 고지 없이 변경될 수 있습니다.
              </li>
            </ul>
          </section>

          <section>
            <h2>제3조 (이용자의 의무)</h2>
            <ul>
              <li>본인의 계정 정보(이메일·비밀번호)를 타인에게 양도·대여하지 않습니다.</li>
              <li>저작권을 침해하거나 불법적인 콘텐츠를 저장·공유하지 않습니다.</li>
              <li>
                서비스 운영을 방해하는 행위(부정 접근, 자동화 봇 사용, 비정상적 트래픽 발생 등)를
                하지 않습니다.
              </li>
            </ul>
          </section>

          <section>
            <h2>제4조 (콘텐츠의 소유권)</h2>
            <p>
              이용자가 저장한 모든 데이터(링크·메모·태그·리마인드 등)의 소유권은 이용자 본인에게
              있습니다. 운영자는 이를 서비스 제공 목적 외에는 활용하지 않으며, 분석·판매·광고
              목적으로 사용하지 않습니다.
            </p>
          </section>

          <section>
            <h2>제5조 (서비스의 변경 및 중단)</h2>
            <p>
              운영자는 시스템 점검, 기술적 변경, 법령 변경 등 사유가 있을 경우 서비스 일부 또는
              전부를 변경하거나 중단할 수 있습니다. 사전 고지가 가능한 경우 공지사항 또는 본
              페이지를 통해 안내합니다.
            </p>
          </section>

          <section>
            <h2>제6조 (책임의 제한)</h2>
            <ul>
              <li>
                본 서비스는 무료 MVP 단계로 제공되며, 데이터 손실·서비스 중단·알림 미수신 등으로
                인해 발생하는 직·간접적 손해에 대해 운영자는 책임지지 않습니다.
              </li>
              <li>
                중요한 데이터는 별도 백업을 권장하며, 이용자가 입력한 콘텐츠의 정확성·합법성에
                대한 책임은 이용자 본인에게 있습니다.
              </li>
            </ul>
          </section>

          <section>
            <h2>제7조 (계정 해지)</h2>
            <p>
              이용자는 모바일 앱의 설정 메뉴에서 언제든지 회원 탈퇴할 수 있으며, 탈퇴 시 모든
              데이터는 즉시 삭제됩니다.
            </p>
          </section>

          <section>
            <h2>제8조 (분쟁 해결)</h2>
            <p>
              본 약관과 관련된 분쟁은 대한민국 법령을 준거법으로 하며, 분쟁 발생 시 양측은
              상호 협의에 따라 해결하는 것을 원칙으로 합니다.
            </p>
          </section>

          <section>
            <h2>제9조 (문의처)</h2>
            <ul>
              <li>운영자: 정성준 (Junbird)</li>
              <li>
                이메일:{' '}
                <a href="mailto:junbird521@gmail.com">junbird521@gmail.com</a>
              </li>
            </ul>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  )
}
