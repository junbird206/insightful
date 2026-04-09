import AsyncStorage from '@react-native-async-storage/async-storage'

export type RemindPresetConfig = {
  id: string
  label: string
  dayOffset: number // 0 = today, 1 = tomorrow
  hour: number      // 0–23
  minute: number    // 0–59
}

const STORAGE_KEY = 'remind_presets'

const DEFAULT_PRESETS: RemindPresetConfig[] = [
  { id: '1', label: '오늘 저녁', dayOffset: 0, hour: 18, minute: 0 },
  { id: '2', label: '내일 아침', dayOffset: 1, hour: 8, minute: 0 },
]

export async function getRemindPresets(): Promise<RemindPresetConfig[]> {
  const json = await AsyncStorage.getItem(STORAGE_KEY)
  if (!json) return DEFAULT_PRESETS
  try {
    return JSON.parse(json)
  } catch {
    return DEFAULT_PRESETS
  }
}

export async function saveRemindPresets(presets: RemindPresetConfig[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export function computeRemindDate(preset: RemindPresetConfig): Date {
  const now = new Date()
  const d = new Date(now)
  d.setDate(d.getDate() + preset.dayOffset)
  d.setHours(preset.hour, preset.minute, 0, 0)
  if (d <= now) d.setDate(d.getDate() + 1)
  return d
}
