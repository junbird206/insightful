import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { RemindPicker } from '@/components/remind-picker'
import { emit } from '@/lib/events'
import { type RemindPresetConfig, computeRemindDate, getRemindPresets } from '@/lib/remind-presets'
import { updateScrapFields } from '@/lib/storage'
import { getTagPool } from '@/lib/tag-pool'
import { Bucket, Scrap } from '@/types/scrap'

type Props = {
  scrap: Scrap | null
  onClose: () => void
  onSaved: () => void
}

const BUCKET_LABELS: Record<Bucket, string> = {
  read: '📖 To Read',
  do: '⚡ To Do',
}

function formatRemindLabel(date: Date): string {
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  const h = date.getHours()
  const m = date.getMinutes()
  const period = h < 12 ? '오전' : '오후'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  const time = m === 0 ? `${period} ${hour12}시` : `${period} ${hour12}:${String(m).padStart(2, '0')}`

  if (isToday) return `오늘 ${time}`
  if (isTomorrow) return `내일 ${time}`

  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
  return `${month}/${day}(${weekday}) ${time}`
}

export function EditScrapSheet({ scrap, onClose, onSaved }: Props) {
  const [bucket, setBucket] = useState<Bucket>('read')
  const [memo, setMemo] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagPool, setTagPool] = useState<string[]>([])
  const [presets, setPresets] = useState<RemindPresetConfig[]>([])
  const [activePresetId, setActivePresetId] = useState<string | null>('none')
  const [remindDate, setRemindDate] = useState<Date | null>(null)
  const [pickerKey, setPickerKey] = useState(0)
  const [remindPast, setRemindPast] = useState(false)
  const [saving, setSaving] = useState(false)

  // Prefill whenever the sheet opens with a new scrap
  useEffect(() => {
    if (!scrap) return
    setBucket(scrap.bucket)
    setMemo(scrap.memo ?? '')
    setSelectedTags(scrap.tags ?? [])
    if (scrap.remindAt) {
      setRemindDate(new Date(scrap.remindAt))
      setActivePresetId(null)
    } else {
      setRemindDate(null)
      setActivePresetId('none')
    }
    setRemindPast(false)
    setPickerKey((k) => k + 1)
    getTagPool().then(setTagPool)
    getRemindPresets().then(setPresets)
  }, [scrap])

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  function selectPreset(presetId: string) {
    setActivePresetId(presetId)
    setRemindPast(false)
    if (presetId === 'none') {
      setRemindDate(null)
      return
    }
    const cfg = presets.find((p) => p.id === presetId)
    if (!cfg) return
    setRemindDate(computeRemindDate(cfg))
    setPickerKey((k) => k + 1)
  }

  function onPickerChange(date: Date, isPast: boolean) {
    setRemindDate(date)
    setRemindPast(isPast)
    setActivePresetId(null)
  }

  async function handleSave() {
    if (!scrap || saving || remindPast) return
    setSaving(true)
    try {
      await updateScrapFields(scrap.id, {
        bucket,
        memo: memo.trim(),
        tags: selectedTags,
        remindAt: remindDate ? remindDate.toISOString() : null,
      })
      emit('scraps:updated')
      onSaved()
      onClose()
    } catch {
      Alert.alert('저장 실패', '다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const dirty =
    scrap != null &&
    (bucket !== scrap.bucket ||
      memo.trim() !== (scrap.memo ?? '') ||
      JSON.stringify(selectedTags) !== JSON.stringify(scrap.tags ?? []) ||
      (remindDate ? remindDate.toISOString() : null) !== (scrap.remindAt ?? null))

  function handleCancel() {
    if (!dirty) {
      onClose()
      return
    }
    Alert.alert('변경 사항 취소', '저장하지 않은 변경 사항이 있습니다.', [
      { text: '계속 편집', style: 'cancel' },
      { text: '버리기', style: 'destructive', onPress: onClose },
    ])
  }

  return (
    <Modal
      visible={scrap != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.inner}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.inner} keyboardShouldPersistTaps="handled">
            <View style={styles.titleBar}>
              <TouchableOpacity
                onPress={handleCancel}
                activeOpacity={0.6}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelText}>취소</Text>
              </TouchableOpacity>
              <Text style={styles.title}>카드 편집</Text>
              <View style={styles.cancelBtn} />
            </View>

            <View style={styles.form}>
              {/* Bucket */}
              <View>
                <Text style={styles.label}>저장 목적</Text>
                <View style={styles.bucketButtons}>
                  {(['read', 'do'] as Bucket[]).map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.bucketButton, bucket === b && styles.bucketButtonActive]}
                      onPress={() => setBucket(b)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.bucketButtonText, bucket === b && styles.bucketButtonTextActive]}>
                        {BUCKET_LABELS[b]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Tags */}
              {tagPool.length > 0 && (
                <View>
                  <Text style={styles.label}>태그 <Text style={styles.labelOptional}>(선택)</Text></Text>
                  <FlatList
                    horizontal
                    data={tagPool}
                    keyExtractor={(item) => item}
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => {
                      const selected = selectedTags.includes(item)
                      return (
                        <TouchableOpacity
                          style={[styles.tagChip, selected && styles.tagChipSelected]}
                          onPress={() => toggleTag(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>
                            #{item}
                          </Text>
                        </TouchableOpacity>
                      )
                    }}
                    contentContainerStyle={styles.tagList}
                  />
                </View>
              )}

              {/* Memo */}
              <View>
                <Text style={styles.label}>메모 <Text style={styles.labelOptional}>(선택)</Text></Text>
                <TextInput
                  style={[styles.input, styles.memoInput]}
                  placeholder="왜 저장했는지 간단히 메모"
                  placeholderTextColor="#aaa"
                  value={memo}
                  onChangeText={setMemo}
                  multiline
                  returnKeyType="done"
                  blurOnSubmit
                />
              </View>

              {/* Remind */}
              <View>
                <Text style={styles.label}>리마인드 <Text style={styles.labelOptional}>(선택)</Text></Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.remindRow}
                >
                  <TouchableOpacity
                    style={[styles.remindChip, activePresetId === 'none' && styles.remindChipActive]}
                    onPress={() => selectPreset('none')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.remindChipText, activePresetId === 'none' && styles.remindChipTextActive]}>
                      없음
                    </Text>
                  </TouchableOpacity>
                  {presets.map((p) => {
                    const active = activePresetId === p.id
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.remindChip, active && styles.remindChipActive]}
                        onPress={() => selectPreset(p.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.remindChipText, active && styles.remindChipTextActive]}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
                {remindDate && (
                  <>
                    <Text style={styles.remindPreview}>🔔 {formatRemindLabel(remindDate)}</Text>
                    <RemindPicker
                      key={pickerKey}
                      value={remindDate}
                      onChange={onPickerChange}
                    />
                  </>
                )}
                {remindPast && (
                  <Text style={styles.remindPastError}>현재 시각 이후로 설정해주세요</Text>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Bottom save button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.saveButton, (saving || remindPast || !dirty) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving || remindPast}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>저장</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  inner: { flex: 1 },

  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111111' },
  cancelBtn: { width: 48 },
  cancelText: { fontSize: 16, fontWeight: '500', color: '#555555' },

  form: { paddingHorizontal: 20, paddingTop: 8, gap: 20, paddingBottom: 24 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  labelOptional: { fontWeight: '400', color: '#999999', textTransform: 'none', letterSpacing: 0 },

  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111111',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  memoInput: { minHeight: 80, textAlignVertical: 'top' },

  bucketButtons: { flexDirection: 'row', gap: 10 },
  bucketButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  bucketButtonActive: { backgroundColor: '#111111', borderColor: '#111111' },
  bucketButtonText: { fontSize: 13, fontWeight: '600', color: '#999999' },
  bucketButtonTextActive: { color: '#FFFFFF' },

  tagList: { gap: 8 },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  tagChipSelected: { backgroundColor: '#111111' },
  tagChipText: { fontSize: 13, fontWeight: '500', color: '#888888' },
  tagChipTextSelected: { color: '#FFFFFF' },

  remindRow: { gap: 8 },
  remindChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  remindChipActive: { backgroundColor: '#111111' },
  remindChipText: { fontSize: 13, fontWeight: '500', color: '#888888' },
  remindChipTextActive: { color: '#FFFFFF' },
  remindPreview: { fontSize: 12, color: '#888888', marginTop: 8 },
  remindPastError: { fontSize: 12, color: '#DC2626', marginTop: 6 },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#FAFAFA',
  },
  saveButton: {
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.35 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
})
