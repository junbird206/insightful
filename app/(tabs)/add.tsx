import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
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
import { type LinkPreview, extractLinkPreview } from '@/lib/extract'
import { processScrap } from '@/lib/process'
import { type RemindPresetConfig, computeRemindDate, getRemindPresets } from '@/lib/remind-presets'
import { saveScrap } from '@/lib/storage'
import { generateSuggestedMemo } from '@/lib/suggested-memo'
import { getTagPool } from '@/lib/tag-pool'
import { Bucket, Scrap, SourcePlatform } from '@/types/scrap'

const URL_DEBOUNCE_MS = 500
const URL_PATTERN = /^https?:\/\/\S+\.\S+/i

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

const BUCKET_LABELS: Record<Bucket, string> = {
  read: '📖 To Read',
  do: '⚡ To Do',
}

// ─── Remind helpers ─────────────────────────────────────────────────────────

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

export default function AddScreen() {
  const [url, setUrl] = useState('')
  const [bucket, setBucket] = useState<Bucket | null>(null)
  const [memo, setMemo] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagPool, setTagPool] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Link preview (auto-extracted from URL)
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Remind
  const [presets, setPresets] = useState<RemindPresetConfig[]>([])
  const [activePresetId, setActivePresetId] = useState<string | null>('none') // 'none' or preset id
  const [remindDate, setRemindDate] = useState<Date | null>(null)
  const [pickerKey, setPickerKey] = useState(0)
  const [remindPast, setRemindPast] = useState(false)

  useFocusEffect(
    useCallback(() => {
      getTagPool().then(setTagPool)
      getRemindPresets().then(setPresets)
      setSelectedTags([])
      setActivePresetId('none')
      setRemindDate(null)
      setRemindPast(false)
    }, []),
  )

  // ─── Debounced link preview fetch ──────────────────────────────────────────
  // 500ms after the user stops typing, fetch metadata + excerpt. AbortController
  // cancels any in-flight request when url changes or the screen unmounts, so
  // suggestedMemo always reflects the latest URL.
  useEffect(() => {
    const trimmed = url.trim()

    if (!URL_PATTERN.test(trimmed)) {
      setLinkPreview(null)
      setPreviewLoading(false)
      return
    }

    setLinkPreview(null)
    setPreviewLoading(true)

    let cancelled = false
    const controller = new AbortController()

    const timer = setTimeout(async () => {
      try {
        const preview = await extractLinkPreview(trimmed, { signal: controller.signal })
        if (cancelled) return
        setLinkPreview(preview)
      } catch {
        // Silent fail — suggestedMemo falls back to tag/bucket-only draft
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }, URL_DEBOUNCE_MS)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [url])

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
    const date = computeRemindDate(cfg)
    setRemindDate(date)
    setPickerKey((k) => k + 1)
  }

  function onPickerChange(date: Date, isPast: boolean) {
    setRemindDate(date)
    setRemindPast(isPast)
    setActivePresetId(null) // wheel 수동 조정 시 프리셋 하이라이트 해제
  }

  function handleClearAll() {
    setUrl('')
    setBucket(null)
    setMemo('')
    setSelectedTags([])
    setActivePresetId('none')
    setRemindDate(null)
    setRemindPast(false)
    setLinkPreview(null)
    setPreviewLoading(false)
    setError('')
  }

  function handleCancel() {
    handleClearAll()
    router.navigate('/')
  }

  async function handleSave() {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setError('URL을 입력해주세요.')
      return
    }
    if (!bucket) {
      setError('저장 목적을 선택해주세요.')
      return
    }

    setSaving(true)
    setError('')

    try {
      // If the debounced fetch already resolved, bake the preview directly
      // into the scrap and mark it 'done' — skips a redundant background fetch.
      const previewReady = linkPreview !== null && !previewLoading

      const suggestedMemo = generateSuggestedMemo({
        bucket,
        tags: selectedTags,
        linkPreview: previewReady ? linkPreview : null,
      })

      const scrap: Scrap = {
        id: Date.now().toString(),
        originalUrl: trimmedUrl,
        createdAt: new Date().toISOString(),
        openedAt: null,
        status: previewReady ? 'done' : 'processing',
        sourcePlatform: detectSourcePlatform(trimmedUrl),
        siteName: previewReady ? linkPreview?.siteName : undefined,
        imageUrl: previewReady ? linkPreview?.imageUrl : undefined,
        rawTitle: previewReady ? linkPreview?.rawTitle : undefined,
        rawDescription: previewReady ? linkPreview?.rawDescription : undefined,
        bucket,
        memo: memo.trim() || '',
        tags: selectedTags,
        starred: false,
        remindAt: remindDate ? remindDate.toISOString() : null,
        archivedAt: null,
        suggestedMemo,
      }
      await saveScrap(scrap)
      setUrl('')
      setBucket(null)
      setMemo('')
      setSelectedTags([])
      setActivePresetId('none')
      setRemindDate(null)
      setRemindPast(false)
      setLinkPreview(null)
      setPreviewLoading(false)
      router.navigate('/')
      if (!previewReady) {
        processScrap(scrap).catch(console.error)
      }
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const suggestedMemoPreview = generateSuggestedMemo({
    bucket,
    tags: selectedTags,
    linkPreview,
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.inner} keyboardShouldPersistTaps="handled">
          <View style={styles.titleBar}>
            <Text style={styles.title}>링크 저장</Text>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.cancelBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.6}
            >
              <Text style={styles.cancelBtnText}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {/* URL */}
            <View>
              <Text style={styles.label}>URL</Text>
              <View style={styles.urlInputRow}>
                <TextInput
                  style={styles.urlInputField}
                  placeholder="https://"
                  placeholderTextColor="#aaa"
                  value={url}
                  onChangeText={(text) => { setUrl(text); setError('') }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="next"
                />
                {url.length > 0 && (
                  <TouchableOpacity
                    onPress={handleClearAll}
                    style={styles.clearBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.clearBtnText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Bucket Selection */}
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

            {/* Tag Pool Selection */}
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
              {!memo && previewLoading ? (
                <Text style={styles.suggestedHint}>링크 분석 중…</Text>
              ) : !memo && (bucket || linkPreview || selectedTags.length > 0) ? (
                <Text style={styles.suggestedHint}>{suggestedMemoPreview}</Text>
              ) : null}
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
                {/* 없음 */}
                <TouchableOpacity
                  style={[styles.remindChip, activePresetId === 'none' && styles.remindChipActive]}
                  onPress={() => selectPreset('none')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.remindChipText, activePresetId === 'none' && styles.remindChipTextActive]}>
                    없음
                  </Text>
                </TouchableOpacity>
                {/* Dynamic presets */}
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
                  <Text style={styles.remindPreview}>
                    🔔 {formatRemindLabel(remindDate)}
                  </Text>
                  <RemindPicker
                    key={pickerKey}
                    value={remindDate}
                    onChange={onPickerChange}
                  />
                </>
              )}
              {remindPast && (
                <Text style={styles.remindPastError}>
                  현재 시각 이후로 설정해주세요
                </Text>
              )}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, (saving || remindPast) && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving || remindPast}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>저장</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingVertical: 20,
    paddingTop: 8,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#111111', letterSpacing: -0.5 },
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '500',
    color: '#555555',
  },
  form: { paddingHorizontal: 20, paddingTop: 8, gap: 20, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: '600', color: '#666666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
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

  // URL input with inline clear button
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingRight: 6,
  },
  urlInputField: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111111',
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  clearBtnText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '600',
    color: '#777777',
  },

  // Bucket buttons
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

  // Tag pool chips
  tagList: { gap: 8 },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  tagChipSelected: {
    backgroundColor: '#111111',
  },
  tagChipText: { fontSize: 13, fontWeight: '500', color: '#888888' },
  tagChipTextSelected: { color: '#FFFFFF' },

  // Suggested memo hint
  suggestedHint: {
    fontSize: 12,
    color: '#AAAAAA',
    marginBottom: 4,
    fontStyle: 'italic',
  },

  // Remind
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
  remindPreview: {
    fontSize: 12,
    color: '#888888',
    marginTop: 8,
  },
  remindPastError: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 6,
  },

  error: { fontSize: 13, color: '#A0522D', marginTop: -8 },
  button: {
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
})
