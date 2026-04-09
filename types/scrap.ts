export type ScrapStatus = 'processing' | 'done' | 'failed'
export type Bucket = 'read' | 'do'
export type SourcePlatform = 'instagram' | 'threads' | 'twitter' | 'youtube' | 'web' | 'unknown'

export type Scrap = {
  // 기본
  id: string
  originalUrl: string
  createdAt: string
  openedAt: string | null
  status: ScrapStatus

  // 소스
  sourcePlatform: SourcePlatform
  siteName?: string
  imageUrl?: string

  // 원문 (메타데이터 추출)
  rawTitle?: string
  rawDescription?: string

  // 핵심 (사용자 입력)
  bucket: Bucket
  memo: string             // 사용자가 직접 입력한 메모
  tags: string[]           // 사용자가 선택/생성한 태그
  starred: boolean
  remindAt: string | null
  archivedAt: string | null

  // AI 보조값 (선택)
  suggestedMemo?: string   // AI가 제안한 메모 초안
}
