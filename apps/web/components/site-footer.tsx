'use client'

import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <div className="brand-mark">
            <img alt="Insightful" className="brand-logo brand-logo-sm" src="/insightful-logo.png" />
          </div>
          <p className="site-footer-tagline">
            흩어진 링크를, 다시 꺼내 쓰는 지식으로.
          </p>
        </div>

        <div className="site-footer-grid">
          <div className="site-footer-col">
            <p className="site-footer-heading">서비스</p>
            <Link href="/privacy">개인정보처리방침</Link>
            <Link href="/terms">이용약관</Link>
          </div>

          <div className="site-footer-col">
            <p className="site-footer-heading">문의 / 제보</p>
            <a href="mailto:junbird521@gmail.com?subject=%5BInsightful%5D%20%EB%B2%84%EA%B7%B8%20%EC%A0%9C%EB%B3%B4">
              버그 제보 (이메일)
            </a>
            <a href="mailto:junbird521@gmail.com?subject=%5BInsightful%5D%20%EB%AC%B8%EC%9D%98">
              일반 문의
            </a>
            <a
              href="https://github.com/junbird206/insightful/issues"
              rel="noreferrer noopener"
              target="_blank"
            >
              GitHub Issues
            </a>
          </div>

          <div className="site-footer-col">
            <p className="site-footer-heading">개발자</p>
            <p className="site-footer-meta">정성준 (Junbird)</p>
            <a href="mailto:junbird521@gmail.com">junbird521@gmail.com</a>
            <a
              href="https://github.com/junbird206/insightful"
              rel="noreferrer noopener"
              target="_blank"
            >
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/%EC%84%B1%EC%A4%80-sung-jun-%EC%A0%95-728633394/"
              rel="noreferrer noopener"
              target="_blank"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>

      <div className="site-footer-bottom">
        <p>© 2026 Insightful · v0.1.0 (MVP)</p>
        <p className="site-footer-note">
          본 서비스는 개인이 운영하는 비상업 MVP 단계 서비스입니다.
        </p>
      </div>
    </footer>
  )
}
