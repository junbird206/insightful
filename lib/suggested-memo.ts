import { Bucket } from '@/types/scrap'
import type { LinkPreview } from './extract'

// ─── Context ─────────────────────────────────────────────────────────────────

export type MemoContext = {
  bucket: Bucket | null
  tags: string[]
  linkPreview?: LinkPreview | null
}

// ─── Suffix per bucket ───────────────────────────────────────────────────────

const BUCKET_SUFFIX: Record<Bucket, string> = {
  read: '읽어보기',
  do: '실천해보기',
}

// Fallback when bucket is not yet chosen
const NEUTRAL_SUFFIX = '나중에 보기'

// Fallback topic when nothing else is available
const TAGLESS_DEFAULT: Record<Bucket, string> = {
  read: '나중에 다시 읽어볼 글',
  do: '나중에 실행해볼 것',
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generates a short, recall-focused memo draft.
 *
 * Topic extraction priority:
 *   1. linkPreview.rawTitle        (cleaned)
 *   2. linkPreview.excerpt         (first sentence)
 *   3. linkPreview.rawDescription  (first sentence)
 *   4. Selected tags               ("#a, #b 관련")
 *   5. linkPreview.siteName
 *   6. Bucket-default placeholder
 *
 * Format: "{topic} — {읽어보기|실천해보기}"
 */
export function generateSuggestedMemo(ctx: MemoContext): string {
  const { bucket, tags, linkPreview } = ctx
  const topic = pickTopic(linkPreview, tags)
  const suffix = bucket ? BUCKET_SUFFIX[bucket] : NEUTRAL_SUFFIX

  if (topic) return `${topic} — ${suffix}`
  // No link preview, no tags: fall back to pure bucket default.
  return bucket ? TAGLESS_DEFAULT[bucket] : '나중에 볼 링크'
}

// ─── Topic extraction ────────────────────────────────────────────────────────

function pickTopic(preview: LinkPreview | null | undefined, tags: string[]): string | null {
  if (preview) {
    const title = cleanTitle(preview.rawTitle, preview.siteName)
    if (title) return truncate(title, 50)

    const excerptSentence = firstSentence(preview.excerpt)
    if (excerptSentence) return truncate(excerptSentence, 60)

    const descSentence = firstSentence(preview.rawDescription)
    if (descSentence) return truncate(descSentence, 60)
  }

  if (tags.length > 0) {
    const tagStr = tags.map((t) => `#${t.replace(/^#/, '')}`).join(' ')
    return `${tagStr} 관련`
  }

  if (preview?.siteName) return preview.siteName

  return null
}

/**
 * Strips common site-name suffixes from titles:
 *   "How to foo — The Verge"  → "How to foo"
 *   "How to foo | Medium"     → "How to foo"
 */
function cleanTitle(
  rawTitle: string | undefined,
  siteName: string | undefined,
): string | null {
  if (!rawTitle) return null
  let title = rawTitle.trim()
  if (!title) return null

  // Strip " — SiteName" / " | SiteName" / " - SiteName" if present.
  if (siteName) {
    const escaped = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    title = title.replace(new RegExp(`\\s*[—\\-|·:]\\s*${escaped}\\s*$`, 'i'), '').trim()
  }

  // Also trim after the last separator when the tail is short (likely a site brand).
  const lastSep = title.match(/^(.*?)\s+[—|]\s+([^—|]{1,30})$/)
  if (lastSep) title = lastSep[1].trim()

  return title || null
}

/**
 * Extracts the first sentence from a paragraph of text. Returns null if the
 * input is empty or too short to be useful.
 */
function firstSentence(text: string | undefined): string | null {
  if (!text) return null
  const cleaned = text.trim().replace(/\s+/g, ' ')
  if (cleaned.length < 10) return null

  // Prefer ending on Korean/latin sentence terminators.
  const match = cleaned.match(/^(.{10,}?[.!?。！？])(?:\s|$)/)
  if (match) return match[1].trim()

  return cleaned
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}
