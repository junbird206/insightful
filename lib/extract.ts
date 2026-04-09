export type LinkPreview = {
  rawTitle?: string
  rawDescription?: string
  imageUrl?: string
  siteName?: string
  excerpt?: string
  limitedExtraction?: boolean // true for platforms that block HTML extraction
}

// Legacy alias (still exported for backward compatibility)
export type ExtractedMetadata = LinkPreview

// ─── Platforms that block server-side HTML extraction ────────────────────────
const RESTRICTED_PLATFORMS: Record<string, string> = {
  'instagram.com': 'Instagram',
  'threads.net': 'Threads',
  'threads.com': 'Threads',
  'x.com': 'X (Twitter)',
  'twitter.com': 'X (Twitter)',
  'facebook.com': 'Facebook',
  'tiktok.com': 'TikTok',
}

function getRestrictedPlatformName(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    for (const [domain, name] of Object.entries(RESTRICTED_PLATFORMS)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) return name
    }
  } catch {}
  return null
}

// ─── HTML helpers ────────────────────────────────────────────────────────────

function getMetaContent(html: string, attr: string, value: string): string | undefined {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match both attribute orders, \b prevents partial attribute name matches
  const patterns = [
    new RegExp(
      `<meta\\b[^>]*\\b${attr}=["']${escaped}["'][^>]*\\bcontent=["']([^"'<>]{1,600})["']`,
      'i',
    ),
    new RegExp(
      `<meta\\b[^>]*\\bcontent=["']([^"'<>]{1,600})["'][^>]*\\b${attr}=["']${escaped}["']`,
      'i',
    ),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]?.trim()) return decodeHTMLEntities(match[1].trim())
  }
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Article excerpt (body text heuristic) ───────────────────────────────────

const NOISE_PATTERNS = [
  /^(cookie|privacy|subscribe|newsletter|sign\s*in|sign\s*up|log\s*in|share\s+this)/i,
  /^(copyright|all rights reserved|©)/i,
  /^(loading|please wait|advertisement)/i,
]

function extractArticleExcerpt(html: string): string | undefined {
  // Find the most likely article container: <article>, <main>, or fall back to full html
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
  const mainMatch = !articleMatch ? html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) : null
  const container = articleMatch?.[1] ?? mainMatch?.[1] ?? html

  // Extract <p> tag contents
  const pMatches = [...container.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
  if (pMatches.length === 0) return undefined

  const paragraphs = pMatches
    .map((m) => decodeHTMLEntities(stripTags(m[1])))
    .filter((s) => s.length >= 40)
    .filter((s) => !NOISE_PATTERNS.some((rx) => rx.test(s)))

  if (paragraphs.length === 0) return undefined

  const first = paragraphs[0]
  return first.length > 300 ? first.slice(0, 300).trimEnd() + '…' : first
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

const DEFAULT_FETCH_TIMEOUT_MS = 8000

export type FetchOptions = {
  timeoutMs?: number
  signal?: AbortSignal
}

/**
 * Fetches a URL and extracts metadata + best-effort article excerpt in a single pass.
 * Returns empty object on network failure. Returns {siteName, limitedExtraction} for
 * platforms that block HTML extraction (Instagram, X, etc.).
 */
export async function extractLinkPreview(
  url: string,
  options: FetchOptions = {},
): Promise<LinkPreview> {
  const platformName = getRestrictedPlatformName(url)
  if (platformName) {
    return { siteName: platformName, limitedExtraction: true }
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  // If caller passed an external signal, also abort on that
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })

    if (!res.ok) return {}

    const html = await res.text()

    const rawTitle =
      getMetaContent(html, 'property', 'og:title') ??
      getMetaContent(html, 'name', 'twitter:title') ??
      html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim()

    const rawDescription =
      getMetaContent(html, 'property', 'og:description') ??
      getMetaContent(html, 'name', 'twitter:description') ??
      getMetaContent(html, 'name', 'description')

    const imageUrl =
      getMetaContent(html, 'property', 'og:image') ??
      getMetaContent(html, 'name', 'twitter:image')

    const siteName =
      getMetaContent(html, 'property', 'og:site_name') ??
      new URL(url).hostname.replace('www.', '')

    const excerpt = extractArticleExcerpt(html)

    return {
      rawTitle: rawTitle ? decodeHTMLEntities(rawTitle) : undefined,
      rawDescription: rawDescription ? decodeHTMLEntities(rawDescription) : undefined,
      imageUrl,
      siteName,
      excerpt,
    }
  } catch {
    return {}
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Legacy alias — background processScrap still imports this name.
 */
export async function extractMetadata(url: string): Promise<ExtractedMetadata> {
  return extractLinkPreview(url)
}
