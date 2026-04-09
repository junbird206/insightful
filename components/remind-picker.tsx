import { Picker } from '@react-native-picker/picker'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

type Props = {
  value: Date
  onChange: (date: Date, isPast: boolean) => void
}

// ─── Data generation ────────────────────────────────────────────────────────

type DateOption = { label: string; year: number; month: number; day: number }

function generateDateOptions(count: number): DateOption[] {
  const today = new Date()
  const options: DateOption[] = []

  for (let i = 0; i < count; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)

    let label: string
    if (i === 0) label = '오늘'
    else if (i === 1) label = '내일'
    else label = `${d.getMonth() + 1}/${d.getDate()}`

    options.push({
      label,
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
    })
  }
  return options
}

const AMPM_OPTIONS = ['오전', '오후'] as const
const HOUR_OPTIONS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

// ─── Helpers ────────────────────────────────────────────────────────────────

function dateToSelections(date: Date) {
  const h = date.getHours()
  return {
    ampm: h < 12 ? 0 : 1,
    hour: h === 0 ? 12 : h > 12 ? h - 12 : h,
    minute: Math.floor(date.getMinutes() / 5) * 5,
  }
}

function selectionsToDate(
  dateOpt: DateOption,
  ampmIdx: number,
  hour12: number,
  minute: number,
): Date {
  let hour24 = hour12
  if (ampmIdx === 0) {
    if (hour12 === 12) hour24 = 0
  } else {
    if (hour12 !== 12) hour24 = hour12 + 12
  }
  return new Date(dateOpt.year, dateOpt.month, dateOpt.day, hour24, minute, 0, 0)
}

// ─── Component ──────────────────────────────────────────────────────────────

export function RemindPicker({ value, onChange }: Props) {
  const dateOptions = useMemo(() => generateDateOptions(30), [])

  function findDateIndex(d: Date): number {
    const idx = dateOptions.findIndex(
      (opt) => opt.year === d.getFullYear() && opt.month === d.getMonth() && opt.day === d.getDate(),
    )
    return idx >= 0 ? idx : 0
  }

  const initial = dateToSelections(value)
  const [dateIdx, setDateIdx] = useState(() => findDateIndex(value))
  const [ampmIdx, setAmpmIdx] = useState(initial.ampm)
  const [hour, setHour] = useState(initial.hour)
  const [minute, setMinute] = useState(initial.minute)

  const isMount = useRef(true)

  useEffect(() => {
    if (isMount.current) {
      isMount.current = false
      return
    }

    const dateOpt = dateOptions[dateIdx]
    const result = selectionsToDate(dateOpt, ampmIdx, hour, minute)
    const isPast = result <= new Date()

    onChange(result, isPast)
  }, [dateIdx, ampmIdx, hour, minute])

  const itemStyle = Platform.OS === 'ios' ? styles.iosItemStyle : undefined

  return (
    <View style={styles.container}>
      <View style={styles.column}>
        <Picker
          selectedValue={dateIdx}
          onValueChange={(v) => setDateIdx(v)}
          itemStyle={itemStyle}
        >
          {dateOptions.map((opt, i) => (
            <Picker.Item key={i} label={opt.label} value={i} />
          ))}
        </Picker>
      </View>

      <View style={styles.column}>
        <Picker
          selectedValue={ampmIdx}
          onValueChange={(v) => setAmpmIdx(v)}
          itemStyle={itemStyle}
        >
          {AMPM_OPTIONS.map((label, i) => (
            <Picker.Item key={i} label={label} value={i} />
          ))}
        </Picker>
      </View>

      <View style={styles.column}>
        <Picker
          selectedValue={hour}
          onValueChange={(v) => setHour(v)}
          itemStyle={itemStyle}
        >
          {HOUR_OPTIONS.map((h) => (
            <Picker.Item key={h} label={`${h}`} value={h} />
          ))}
        </Picker>
      </View>

      <View style={styles.column}>
        <Picker
          selectedValue={minute}
          onValueChange={(v) => setMinute(v)}
          itemStyle={itemStyle}
        >
          {MINUTE_OPTIONS.map((m) => (
            <Picker.Item key={m} label={String(m).padStart(2, '0')} value={m} />
          ))}
        </Picker>
      </View>
    </View>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const PICKER_HEIGHT = Platform.OS === 'ios' ? 180 : 200

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: PICKER_HEIGHT,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
  },
  column: { flex: 1 },
  iosItemStyle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111111',
  },
})
