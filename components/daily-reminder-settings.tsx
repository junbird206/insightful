import { Picker } from '@react-native-picker/picker'
import { useEffect, useState } from 'react'
import {
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '@/lib/auth'
import {
  type DailyReminderConfig,
  DEFAULT_DAILY_REMINDER,
  getDailyReminderConfig,
  saveDailyReminderConfig,
} from '@/lib/daily-reminder'
import { refreshAllSchedules, requestNotificationPermission } from '@/lib/notifications'

type Props = {
  visible: boolean
  onClose: () => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function formatTime(hour: number, minute: number): string {
  const period = hour < 12 ? '오전' : '오후'
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const mm = String(minute).padStart(2, '0')
  return `${period} ${h12}:${mm}`
}

export function DailyReminderSettings({ visible, onClose }: Props) {
  const { nickname } = useAuth()
  const [config, setConfig] = useState<DailyReminderConfig>(DEFAULT_DAILY_REMINDER)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setLoaded(false)
    getDailyReminderConfig().then((c) => {
      if (cancelled) return
      setConfig(c)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [visible])

  async function persist(next: DailyReminderConfig) {
    setConfig(next)
    await saveDailyReminderConfig(next)
    await refreshAllSchedules(nickname)
  }

  async function handleToggle(value: boolean) {
    if (value) {
      // Make sure OS-level permission is granted before enabling
      const granted = await requestNotificationPermission()
      if (!granted) {
        // Keep UI in sync with reality: stay off
        await persist({ ...config, enabled: false })
        return
      }
    }
    await persist({ ...config, enabled: value })
  }

  function handleHourChange(value: number) {
    persist({ ...config, hour: value })
  }

  function handleMinuteChange(value: number) {
    persist({ ...config, minute: value })
  }

  const pickerItemStyle = Platform.OS === 'ios' ? styles.pickerItem : undefined

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.6} hitSlop={8}>
            <Text style={styles.back}>← 닫기</Text>
          </TouchableOpacity>
          <Text style={styles.title}>데일리 알람</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.body}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>알람</Text>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>매일 알람 받기</Text>
                <Text style={styles.rowDesc}>
                  매일 같은 시간에 미열람 카드 개수를 알려드려요
                </Text>
              </View>
              <Switch
                value={config.enabled}
                onValueChange={handleToggle}
                disabled={!loaded}
                trackColor={{ false: '#E5E5E5', true: '#111111' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E5E5E5"
              />
            </View>
          </View>

          <View style={[styles.section, !config.enabled && styles.sectionDisabled]}>
            <Text style={styles.sectionTitle}>알람 시간</Text>
            <Text style={styles.sectionDesc}>{formatTime(config.hour, config.minute)}</Text>
            <View style={styles.timeRow} pointerEvents={config.enabled ? 'auto' : 'none'}>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={config.hour}
                  onValueChange={(v) => handleHourChange(Number(v))}
                  itemStyle={pickerItemStyle}
                  enabled={config.enabled}
                >
                  {HOURS.map((h) => (
                    <Picker.Item key={h} label={`${h}시`} value={h} />
                  ))}
                </Picker>
              </View>
              <Text style={styles.colon}>:</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={config.minute}
                  onValueChange={(v) => handleMinuteChange(Number(v))}
                  itemStyle={pickerItemStyle}
                  enabled={config.enabled}
                >
                  {MINUTES.map((m) => (
                    <Picker.Item key={m} label={`${String(m).padStart(2, '0')}분`} value={m} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>알림 미리보기</Text>
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>오늘의 인사이트</Text>
              <Text style={styles.previewBody}>
                {`${nickname ? `${nickname}님! ` : ''}아직 회수하지 않은 N개의 지식이 있어요`}
              </Text>
            </View>
            <Text style={styles.previewHint}>
              · `OO님` 은 마이페이지의 닉네임이 자동으로 들어가요{'\n'}
              · 미열람 카드가 0개면 그날 알람은 발송되지 않아요
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const PICKER_H = Platform.OS === 'ios' ? 160 : 50

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E8E8',
  },
  back: { fontSize: 15, color: '#555', fontWeight: '500' },
  title: { fontSize: 17, fontWeight: '700', color: '#111' },
  headerSpacer: { width: 60 },

  body: { flex: 1, paddingBottom: 24 },

  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionDisabled: { opacity: 0.5 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  sectionDesc: { fontSize: 14, color: '#444', fontWeight: '600', marginBottom: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 16,
  },
  rowText: { flex: 1, marginRight: 16 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#111' },
  rowDesc: { fontSize: 12, color: '#888', marginTop: 4, lineHeight: 18 },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PICKER_H,
    marginTop: 4,
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  pickerWrap: { flex: 1 },
  colon: { fontSize: 18, fontWeight: '700', color: '#888' },
  pickerItem: { fontSize: 16, fontWeight: '500', color: '#111' },

  previewSection: { paddingHorizontal: 20, paddingTop: 32 },
  previewLabel: {
    fontSize: 13, fontWeight: '700', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  previewTitle: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 4 },
  previewBody: { fontSize: 14, color: '#111', lineHeight: 20 },
  previewHint: { fontSize: 12, color: '#999', marginTop: 8, lineHeight: 18 },
})
