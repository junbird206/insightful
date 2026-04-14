import { emit } from './events'
import { clearPendingScraps, getPendingScraps, type PendingScrap } from './pending-queue'
import { processScrap } from './process'
import { saveScrap } from './storage'
import { generateSuggestedMemo } from './suggested-memo'
import { addTagToPool, getTagPool } from './tag-pool'
import { Bucket, Scrap, SourcePlatform } from '@/types/scrap'

function detectSourcePlatform(url: string): SourcePlatform {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    if (hostname.includes('instagram.com')) return 'instagram'
    if (hostname.includes('threads.')) return 'threads'
    if (hostname.includes('x.com') || hostname.includes('twitter.com')) return 'twitter'
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube'
    return 'web'
  } catch {
    return 'unknown'
  }
}

function normalizeBucket(value: string): Bucket {
  return value === 'do' ? 'do' : 'read'
}

function parseTags(tagsJson: string | undefined): string[] {
  if (!tagsJson) return []
  try {
    const parsed = JSON.parse(tagsJson)
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === 'string')
  } catch {
    // Silent — fall through to empty
  }
  return []
}

function pendingToScrap(item: PendingScrap, index: number): Scrap {
  const bucket = normalizeBucket(item.bucket)
  const createdAt = item.createdAt || new Date().toISOString()
  const tags = parseTags(item.tagsJson)
  return {
    id: `${Date.now()}-${index}`,
    originalUrl: item.url,
    createdAt,
    openedAt: null,
    status: 'processing',
    sourcePlatform: detectSourcePlatform(item.url),
    bucket,
    memo: item.memo ?? '',
    tags,
    starred: false,
    remindAt: item.remindAt && item.remindAt.length > 0 ? item.remindAt : null,
    archivedAt: null,
    suggestedMemo: generateSuggestedMemo({ bucket, tags, linkPreview: null }),
  }
}

let importing = false

/**
 * Drain the iOS Share Extension pending queue into Supabase.
 *
 * - Reads pending items written by the extension into App Groups UserDefaults
 * - Inserts each as a `processing` scrap, then kicks off `processScrap` for
 *   background metadata extraction (not awaited)
 * - Clears the queue only after all inserts succeed so failures stay pending
 *   and get retried on the next foreground
 * - Emits `scraps:updated` so any listening screens can refresh immediately
 */
export async function importPendingScraps(): Promise<number> {
  if (importing) return 0
  importing = true
  try {
    const pending = await getPendingScraps()
    if (pending.length === 0) return 0

    const scraps = pending.map(pendingToScrap)

    for (const scrap of scraps) {
      try {
        await saveScrap(scrap)
      } catch (err) {
        console.error('[import-pending] saveScrap failed — leaving queue intact', err)
        return 0
      }
    }

    await clearPendingScraps()

    // Merge any new tags (added inside the Share Extension) into the app pool
    // so they remain available on subsequent shares and in the Add screen.
    const incomingTags = new Set(scraps.flatMap((s) => s.tags))
    if (incomingTags.size > 0) {
      try {
        const pool = await getTagPool()
        const poolSet = new Set(pool)
        for (const tag of incomingTags) {
          if (!poolSet.has(tag)) {
            await addTagToPool(tag)
            poolSet.add(tag)
          }
        }
      } catch (err) {
        console.warn('[import-pending] tag pool merge failed', err)
      }
    }

    emit('scraps:updated')

    // Fire-and-forget metadata extraction for each imported scrap
    for (const scrap of scraps) {
      processScrap(scrap).catch((err) =>
        console.error('[import-pending] processScrap failed', err),
      )
    }

    return scraps.length
  } finally {
    importing = false
  }
}
