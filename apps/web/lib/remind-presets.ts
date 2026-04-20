import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export type RemindPresetConfig = {
  id: string
  label: string
  dayOffset: number
  hour: number
  minute: number
}

const DEFAULT_PRESETS: RemindPresetConfig[] = [
  { id: '1', label: '오늘 저녁', dayOffset: 0, hour: 18, minute: 0 },
  { id: '2', label: '내일 아침', dayOffset: 1, hour: 8, minute: 0 },
]

export async function listRemindPresets(): Promise<RemindPresetConfig[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('remind_presets')
    .select('presets')
    .maybeSingle()

  if (error) {
    return DEFAULT_PRESETS
  }

  if (!data) {
    await supabase.from('remind_presets').upsert({ presets: DEFAULT_PRESETS })
    return DEFAULT_PRESETS
  }

  return (data.presets as RemindPresetConfig[]) ?? DEFAULT_PRESETS
}

export function computeRemindDate(preset: RemindPresetConfig): Date {
  const now = new Date()
  const d = new Date(now)
  d.setDate(d.getDate() + preset.dayOffset)
  d.setHours(preset.hour, preset.minute, 0, 0)
  if (d <= now) d.setDate(d.getDate() + 1)
  return d
}
