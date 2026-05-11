import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { processScrap } from '@/lib/process'
import { saveScrap } from '@/lib/storage'
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

const BUCKET_LABELS: Record<Bucket, string> = {
  learn: '📚 Learn',
  do: '⚡ Do',
  go: '✈️ Go',
}

export default function AddScreen() {
  const [url, setUrl] = useState('')
  const [bucket, setBucket] = useState<Bucket | null>(null)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      const scrap: Scrap = {
        id: Date.now().toString(),
        url: trimmedUrl,
        createdAt: new Date().toISOString(),
        status: 'processing',
        sourcePlatform: detectSourcePlatform(trimmedUrl),
        bucket,
        memo: memo.trim() || '',
        tags: [],
        starred: false,
        rawCaption: memo.trim() || '',  // To Go 지역 추출용
      }
      await saveScrap(scrap)
      setUrl('')
      setBucket(null)
      setMemo('')
      router.navigate('/')
      // Background: extract → AI → update (no await)
      processScrap(scrap).catch(console.error)
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.titleBar}>
          <Text style={styles.title}>링크 저장</Text>
        </View>

        <View style={styles.form}>
          {/* URL */}
          <View>
            <Text style={styles.label}>URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://"
              placeholderTextColor="#aaa"
              value={url}
              onChangeText={(text) => { setUrl(text); setError('') }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
            />
          </View>

          {/* Bucket Selection */}
          <View>
            <Text style={styles.label}>저장 목적</Text>
            <View style={styles.bucketButtons}>
              {(['learn', 'do', 'go'] as Bucket[]).map((b) => (
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

          {/* Memo */}
          <View>
            <Text style={styles.label}>메모 <Text style={styles.labelOptional}>(선택)</Text></Text>
            <TextInput
              style={[styles.input, styles.memoInput]}
              placeholder="콘텐츠의 내용을 간단히 요약해주세요"
              placeholderTextColor="#aaa"
              value={memo}
              onChangeText={setMemo}
              multiline
              returnKeyType="done"
              blurOnSubmit
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>저장</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  inner: { flex: 1 },
  titleBar: { paddingHorizontal: 20, paddingVertical: 20, paddingTop: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#111111', letterSpacing: -0.5 },
  form: { paddingHorizontal: 20, paddingTop: 8, gap: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#666666', textTransform: 'uppercase', letterSpacing: 0.5 },
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
  bucketButtonActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  bucketButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999999',
  },
  bucketButtonTextActive: {
    color: '#FFFFFF',
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
