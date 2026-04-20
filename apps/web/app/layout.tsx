import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { AppProviders } from '@/components/app-providers'

import './globals.css'

export const metadata: Metadata = {
  title: 'Insightful',
  description: '흩어진 링크를 다시 꺼내 쓰는 지식으로. 저장하고, 찾고, 정리하세요.',
  icons: {
    icon: '/insightful-logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
