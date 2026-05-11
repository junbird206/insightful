import { Picker } from '@react-native-picker/picker'
import { useEffect, useState } from 'react'
import {
  Alert,
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

import { useAuth } from '@/lib/auth'
import {
  type RemindPresetConfig,
  getRemindPresets,
  saveRemindPresets,
} from '@/lib/remind-presets'

type Props = {
  visible: boolean
  scrapCount: number
  onClose: () => void
}

const MAX_PRESETS = 3
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

export function MyPage({ visible, scrapCount, onClose }: Props) {
  const { user, nickname, updateNickname, updatePassword, deleteAccount } = useAuth()
  const [presets, setPresets] = useState<RemindPresetConfig[]>([])
  const [newPassword, setNewPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null)
  const [nicknameInput, setNicknameInput] = useState('')
  const [nicknameMsg, setNicknameMsg] = useState<{ text: string; error: boolean } | null>(null)
  const [nicknameSaving, setNicknameSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      getRemindPresets().then(setPresets)
      setNewPassword('')
      setPasswordMsg(null)
      setNicknameInput(nickname ?? '')
      setNicknameMsg(null)
    }
  }, [visible, nickname])

  async function persist(updated: RemindPresetConfig[]) {
    setPresets(updated)
    await saveRemindPresets(updated)
  }

  function updatePreset(id: string, changes: Partial<RemindPresetConfig>) {
    persist(presets.map((p) => (p.id === id ? { ...p, ...changes } : p)))
  }

  function deletePreset(id: string) {
    persist(presets.filter((p) => p.id !== id))
  }

  function addPreset() {
    if (presets.length >= MAX_PRESETS) return
    persist([
      ...presets,
      { id: Date.now().toString(), label: '새 프리셋', dayOffset: 0, hour: 12, minute: 0 },
    ])
  }

  const provider = user?.app_metadata?.provider
  const isEmailUser = provider !== 'google'
  const providerLabel = provider === 'google' ? 'Google' : '이메일'

  async function handleSaveNickname() {
    const trimmed = nicknameInput.trim()
    if (!trimmed) {
      setNicknameMsg({ text: '닉네임을 입력해주세요.', error: true })
      return
    }
    if (trimmed === (nickname ?? '')) {
      setNicknameMsg({ text: '변경된 내용이 없습니다.', error: true })
      return
    }
    setNicknameSaving(true)
    const err = await updateNickname(trimmed)
    setNicknameSaving(false)
    if (err) {
      setNicknameMsg({ text: err, error: true })
    } else {
      setNicknameMsg({ text: '닉네임이 변경되었습니다.', error: false })
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      setPasswordMsg({ text: '비밀번호는 6자 이상이어야 합니다.', error: true })
      return
    }
    const err = await updatePassword(newPassword)
    if (err) {
      setPasswordMsg({ text: err, error: true })
    } else {
      setPasswordMsg({ text: '비밀번호가 변경되었습니다.', error: false })
      setNewPassword('')
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      '정말 가실 건가요?',
      `insightful에 저장해둔 ${scrapCount}개의 지식이 사라질 예정이에요.\n이 작업은 되돌릴 수 없어요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴하기',
          style: 'destructive',
          onPress: async () => {
            const err = await deleteAccount()
            if (err) Alert.alert('오류', err)
            else onClose()
          },
        },
      ],
    )
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.6} hitSlop={8}>
            <Text style={styles.back}>← 닫기</Text>
          </TouchableOpacity>
          <Text style={styles.title}>마이페이지</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* ── Account ────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>계정 정보</Text>
            <View style={styles.card}>
              <InfoRow label="이메일" value={user?.email ?? '-'} />
              <View style={styles.sep} />
              <InfoRow label="로그인 방식" value={providerLabel} />
            </View>
          </View>

          {/* ── Nickname ───────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>닉네임</Text>
            <Text style={styles.sectionDesc}>
              알림 메시지에 표시되는 이름이에요 (최대 20자)
            </Text>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>
                {nickname ? `현재 닉네임: ${nickname}` : '닉네임이 설정되지 않았습니다'}
              </Text>
              <TextInput
                style={styles.passwordInput}
                placeholder="닉네임 입력"
                placeholderTextColor="#CCC"
                value={nicknameInput}
                onChangeText={(t) => { setNicknameInput(t); setNicknameMsg(null) }}
                maxLength={20}
                autoCapitalize="none"
              />
              {nicknameMsg && (
                <Text style={[styles.passwordMsg, nicknameMsg.error && styles.passwordMsgError]}>
                  {nicknameMsg.text}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.passwordBtn, (!nicknameInput.trim() || nicknameSaving) && styles.passwordBtnDisabled]}
                onPress={handleSaveNickname}
                disabled={!nicknameInput.trim() || nicknameSaving}
                activeOpacity={0.7}
              >
                <Text style={styles.passwordBtnText}>
                  {nicknameSaving ? '저장 중...' : '저장하기'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Presets ────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>리마인드 프리셋</Text>
            <Text style={styles.sectionDesc}>
              최대 {MAX_PRESETS}개 · 링크 저장 시 빠른 선택에 사용됩니다
            </Text>

            {presets.map((p) => (
              <PresetCard
                key={p.id}
                preset={p}
                onUpdate={(c) => updatePreset(p.id, c)}
                onDelete={() => deletePreset(p.id)}
              />
            ))}

            {presets.length < MAX_PRESETS && (
              <TouchableOpacity style={styles.addBtn} onPress={addPreset} activeOpacity={0.7}>
                <Text style={styles.addBtnText}>+ 프리셋 추가</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Account management ─────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>계정 관리</Text>

            {/* Password change — email users only */}
            {isEmailUser && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>비밀번호 변경</Text>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="새 비밀번호 (6자 이상)"
                  placeholderTextColor="#CCC"
                  value={newPassword}
                  onChangeText={(t) => { setNewPassword(t); setPasswordMsg(null) }}
                  secureTextEntry
                  autoCapitalize="none"
                />
                {passwordMsg && (
                  <Text style={[styles.passwordMsg, passwordMsg.error && styles.passwordMsgError]}>
                    {passwordMsg.text}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.passwordBtn, !newPassword && styles.passwordBtnDisabled]}
                  onPress={handleChangePassword}
                  disabled={!newPassword}
                  activeOpacity={0.7}
                >
                  <Text style={styles.passwordBtnText}>변경하기</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Delete account */}
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={handleDeleteAccount}
              activeOpacity={0.6}
            >
              <Text style={styles.dangerBtnText}>탈퇴하기</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ─── Info Row ────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  )
}

// ─── Preset Card ─────────────────────────────────────────────────────────────

function PresetCard({
  preset,
  onUpdate,
  onDelete,
}: {
  preset: RemindPresetConfig
  onUpdate: (c: Partial<RemindPresetConfig>) => void
  onDelete: () => void
}) {
  const pickerItemStyle = Platform.OS === 'ios' ? styles.pickerItem : undefined

  return (
    <View style={styles.presetCard}>
      {/* Label + delete */}
      <View style={styles.presetTop}>
        <TextInput
          style={styles.presetInput}
          value={preset.label}
          onChangeText={(t) => onUpdate({ label: t })}
          placeholder="프리셋 이름"
          placeholderTextColor="#CCC"
          maxLength={20}
        />
        <TouchableOpacity onPress={onDelete} hitSlop={8} activeOpacity={0.5}>
          <Text style={styles.deleteIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Day toggle */}
      <View style={styles.dayRow}>
        {([{ label: '오늘', v: 0 }, { label: '내일', v: 1 }] as const).map((d) => (
          <TouchableOpacity
            key={d.v}
            style={[styles.dayBtn, preset.dayOffset === d.v && styles.dayBtnActive]}
            onPress={() => onUpdate({ dayOffset: d.v })}
            activeOpacity={0.7}
          >
            <Text style={[styles.dayBtnText, preset.dayOffset === d.v && styles.dayBtnTextActive]}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Time pickers */}
      <View style={styles.timeRow}>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={preset.hour}
            onValueChange={(v) => onUpdate({ hour: v })}
            itemStyle={pickerItemStyle}
          >
            {HOURS.map((h) => (
              <Picker.Item key={h} label={`${h}시`} value={h} />
            ))}
          </Picker>
        </View>
        <Text style={styles.colon}>:</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={preset.minute}
            onValueChange={(v) => onUpdate({ minute: v })}
            itemStyle={pickerItemStyle}
          >
            {MINUTES.map((m) => (
              <Picker.Item key={m} label={`${String(m).padStart(2, '0')}분`} value={m} />
            ))}
          </Picker>
        </View>
      </View>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const PICKER_H = Platform.OS === 'ios' ? 120 : 50

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

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },

  section: { paddingHorizontal: 20, paddingTop: 28 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  sectionDesc: { fontSize: 12, color: '#AAA', marginBottom: 12 },

  // Account card
  card: { backgroundColor: '#FFF', borderRadius: 10, padding: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  infoLabel: { fontSize: 14, color: '#888' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#333', maxWidth: '60%' },
  sep: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 8 },

  // Preset card
  presetCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  presetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  presetInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    paddingVertical: 4,
    marginRight: 12,
  },
  deleteIcon: { fontSize: 16, color: '#CCC', fontWeight: '600' },

  dayRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  dayBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  dayBtnActive: { backgroundColor: '#111' },
  dayBtnText: { fontSize: 13, fontWeight: '600', color: '#888' },
  dayBtnTextActive: { color: '#FFF' },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PICKER_H,
    marginTop: 8,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#F7F7F7',
  },
  pickerWrap: { flex: 1 },
  colon: { fontSize: 18, fontWeight: '700', color: '#888' },
  pickerItem: { fontSize: 15, fontWeight: '500', color: '#111' },

  addBtn: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: '#AAA' },

  // Account management
  cardLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 10 },
  passwordInput: {
    backgroundColor: '#F7F7F7',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111',
  },
  passwordMsg: { fontSize: 12, color: '#22C55E', marginTop: 6 },
  passwordMsgError: { color: '#DC2626' },
  passwordBtn: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  passwordBtnDisabled: { opacity: 0.3 },
  passwordBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  dangerBtn: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerBtnText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
})
