import { supabase } from './supabase'

const DEFAULT_TAGS = ['AI활용', '학교생활', '주식', '운동', '콘텐츠아이디어', '자기계발']

export async function getTagPool(): Promise<string[]> {
  const { data, error } = await supabase
    .from('tag_pools')
    .select('tags')
    .single()

  // 행이 없으면 기본 태그로 초기화
  if (error || !data) {
    await supabase.from('tag_pools').upsert({ tags: DEFAULT_TAGS })
    return DEFAULT_TAGS
  }

  return (data.tags as string[]) ?? DEFAULT_TAGS
}

export async function addTagToPool(tag: string): Promise<string[]> {
  const pool = await getTagPool()
  if (pool.includes(tag)) return pool
  const updated = [...pool, tag]
  await supabase.from('tag_pools').upsert({ tags: updated })
  return updated
}

export async function renameTagInPool(oldTag: string, newTag: string): Promise<string[]> {
  const pool = await getTagPool()
  const updated = pool.map((t) => (t === oldTag ? newTag : t))
  await supabase.from('tag_pools').upsert({ tags: updated })
  return updated
}

export async function removeTagFromPool(tag: string): Promise<string[]> {
  const pool = await getTagPool()
  const updated = pool.filter((t) => t !== tag)
  await supabase.from('tag_pools').upsert({ tags: updated })
  return updated
}
