import { cancelReminder, cancelReminders, scheduleReminder } from './notifications'
import { supabase } from './supabase'
import { Scrap } from '@/types/scrap'

// ─── camelCase ↔ snake_case 매핑 ────────────────────────────────────────────

const CAMEL_TO_SNAKE: Record<string, string> = {
  originalUrl: 'original_url',
  createdAt: 'created_at',
  openedAt: 'opened_at',
  sourcePlatform: 'source_platform',
  siteName: 'site_name',
  imageUrl: 'image_url',
  rawTitle: 'raw_title',
  rawDescription: 'raw_description',
  remindAt: 'remind_at',
  suggestedMemo: 'suggested_memo',
  archivedAt: 'archived_at',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToScrap(row: any): Scrap {
  return {
    id: row.id,
    originalUrl: row.original_url,
    createdAt: row.created_at,
    openedAt: row.opened_at ?? null,
    status: row.status,
    sourcePlatform: row.source_platform,
    siteName: row.site_name ?? undefined,
    imageUrl: row.image_url ?? undefined,
    rawTitle: row.raw_title ?? undefined,
    rawDescription: row.raw_description ?? undefined,
    bucket: row.bucket,
    memo: row.memo,
    tags: row.tags ?? [],
    starred: row.starred,
    remindAt: row.remind_at ?? null,
    archivedAt: row.archived_at ?? null,
    suggestedMemo: row.suggested_memo ?? undefined,
  }
}

function scrapToRow(scrap: Scrap) {
  return {
    id: scrap.id,
    original_url: scrap.originalUrl,
    created_at: scrap.createdAt,
    opened_at: scrap.openedAt,
    status: scrap.status,
    source_platform: scrap.sourcePlatform,
    site_name: scrap.siteName ?? null,
    image_url: scrap.imageUrl ?? null,
    raw_title: scrap.rawTitle ?? null,
    raw_description: scrap.rawDescription ?? null,
    bucket: scrap.bucket,
    memo: scrap.memo,
    tags: scrap.tags,
    starred: scrap.starred,
    remind_at: scrap.remindAt,
    archived_at: scrap.archivedAt,
    suggested_memo: scrap.suggestedMemo ?? null,
  }
}

function toDbFields(fields: Partial<Scrap>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    const dbKey = CAMEL_TO_SNAKE[key] ?? key
    result[dbKey] = value === undefined ? null : value
  }
  return result
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function getAllScraps(): Promise<Scrap[]> {
  const { data, error } = await supabase
    .from('scraps')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(rowToScrap)
}

export async function getArchivedScraps(): Promise<Scrap[]> {
  const { data, error } = await supabase
    .from('scraps')
    .select('*')
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(rowToScrap)
}

export async function archiveScrap(id: string): Promise<void> {
  const { error } = await supabase
    .from('scraps')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  cancelReminder(id).catch(() => {})
}

export async function restoreScrap(id: string): Promise<void> {
  const { error } = await supabase
    .from('scraps')
    .update({ archived_at: null })
    .eq('id', id)
  if (error) throw error
}

export async function saveScrap(scrap: Scrap): Promise<void> {
  const { error } = await supabase.from('scraps').insert(scrapToRow(scrap))
  if (error) throw error
  if (scrap.remindAt) {
    scheduleReminder(scrap.id, scrap.remindAt).catch(() => {})
  }
}

export async function deleteScrap(id: string): Promise<void> {
  const { error } = await supabase.from('scraps').delete().eq('id', id)
  if (error) throw error
  cancelReminder(id).catch(() => {})
}

export async function updateScrap(updated: Scrap): Promise<void> {
  const { error } = await supabase
    .from('scraps')
    .update(scrapToRow(updated))
    .eq('id', updated.id)
  if (error) throw error
}

export async function updateScrapFields(id: string, fields: Partial<Scrap>): Promise<void> {
  const { error } = await supabase
    .from('scraps')
    .update(toDbFields(fields))
    .eq('id', id)
  if (error) throw error
  if ('remindAt' in fields) {
    if (fields.remindAt) {
      scheduleReminder(id, fields.remindAt).catch(() => {})
    } else {
      cancelReminder(id).catch(() => {})
    }
  }
}

export async function renameTagInAllScraps(oldTag: string, newTag: string): Promise<void> {
  const { data, error } = await supabase
    .from('scraps')
    .select('id, tags')
    .contains('tags', [oldTag])

  if (error) throw error

  await Promise.all(
    (data ?? []).map((row) =>
      supabase
        .from('scraps')
        .update({ tags: (row.tags as string[]).map((t) => (t === oldTag ? newTag : t)) })
        .eq('id', row.id),
    ),
  )
}

export async function removeTagFromAllScraps(tag: string): Promise<void> {
  const { data, error } = await supabase
    .from('scraps')
    .select('id, tags')
    .contains('tags', [tag])

  if (error) throw error

  await Promise.all(
    (data ?? []).map((row) =>
      supabase
        .from('scraps')
        .update({ tags: (row.tags as string[]).filter((t) => t !== tag) })
        .eq('id', row.id),
    ),
  )
}

// ─── Bulk operations ────────────────────────────────────────────────────────

export async function bulkDeleteScraps(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('scraps').delete().in('id', ids)
  if (error) throw error
  cancelReminders(ids).catch(() => {})
}

export async function bulkArchiveScraps(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('scraps')
    .update({ archived_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
  cancelReminders(ids).catch(() => {})
}

export async function bulkRestoreScraps(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('scraps')
    .update({ archived_at: null })
    .in('id', ids)
  if (error) throw error
}

