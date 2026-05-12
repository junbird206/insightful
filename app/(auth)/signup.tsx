import { Link, router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
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

import { FloatingClouds } from '@/components/floating-clouds'
import { useAuth } from '@/lib/auth'

const MAX_NICKNAME_LENGTH = 20
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FocusKey = 'email' | 'nickname' | 'password' | 'passwordConfirm' | null

export default function SignupScreen() {
  const { signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<FocusKey>(null)

  async function handleSignup() {
    const trimmedEmail = email.trim()
    const trimmedNickname = nickname.trim()

    if (!trimmedEmail) {
      setError('이메일을 입력해주세요.')
      return
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('올바른 이메일 형식이 아닙니다.')
      return
    }
    if (!trimmedNickname) {
      setError('닉네임을 입력해주세요.')
      return
    }
    if (trimmedNickname.length > MAX_NICKNAME_LENGTH) {
      setError(`닉네임은 ${MAX_NICKNAME_LENGTH}자 이내로 입력해주세요.`)
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    setError('')
    const err = await signUp(trimmedEmail, password, trimmedNickname)
    setLoading(false)

    if (err) {
      setError(err)
      return
    }

    Alert.alert(
      '가입 완료',
      '계정이 생성되었습니다. 이메일 확인이 필요한 경우 받은 메일의 링크를 눌러 인증해주세요.',
      [{ text: '확인', onPress: () => router.replace('/(auth)/login') }],
    )
  }

  function inputStyle(key: Exclude<FocusKey, null>) {
    return [styles.input, focused === key && styles.inputFocused]
  }

  return (
    <View style={styles.root}>
      <FloatingClouds />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <Image
                source={require('@/assets/images/logo-wordmark.png')}
                style={styles.wordmark}
                resizeMode="contain"
              />
              <Text style={styles.headline}>나만의 라이브러리를{'\n'}지금 시작해요.</Text>
              <Text style={styles.tagline}>이메일과 닉네임만 있으면 됩니다.</Text>
            </View>

            <View style={styles.form}>
              <TextInput
                style={inputStyle('email')}
                placeholder="이메일"
                placeholderTextColor="#A6ADBD"
                value={email}
                onChangeText={(t) => { setEmail(t); setError('') }}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
              />
              <TextInput
                style={inputStyle('nickname')}
                placeholder={`닉네임 (1~${MAX_NICKNAME_LENGTH}자)`}
                placeholderTextColor="#A6ADBD"
                value={nickname}
                onChangeText={(t) => { setNickname(t); setError('') }}
                onFocus={() => setFocused('nickname')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={MAX_NICKNAME_LENGTH}
                returnKeyType="next"
              />
              <TextInput
                style={inputStyle('password')}
                placeholder="비밀번호 (6자 이상)"
                placeholderTextColor="#A6ADBD"
                value={password}
                onChangeText={(t) => { setPassword(t); setError('') }}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry
                returnKeyType="next"
              />
              <TextInput
                style={inputStyle('passwordConfirm')}
                placeholder="비밀번호 확인"
                placeholderTextColor="#A6ADBD"
                value={passwordConfirm}
                onChangeText={(t) => { setPasswordConfirm(t); setError('') }}
                onFocus={() => setFocused('passwordConfirm')}
                onBlur={() => setFocused(null)}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSignup}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>회원가입</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>이미 계정이 있으신가요? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={styles.footerLink}>로그인</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const BRAND = '#4F5BD5'
const BG = '#F7F8FC'
const TEXT = '#1A1F36'
const MUTED = '#8A92A6'
const LINE = '#E6E9F2'

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  hero: { alignItems: 'center', marginBottom: 32 },
  wordmark: { width: 180, height: 48, marginBottom: 24 },
  headline: {
    fontSize: 24,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  tagline: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: -0.2,
  },

  form: { gap: 12 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    fontSize: 15,
    color: TEXT,
    borderWidth: 1.5,
    borderColor: LINE,
  },
  inputFocused: { borderColor: BRAND },
  error: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 4,
  },

  button: {
    backgroundColor: BRAND,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 3,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: { fontSize: 14, color: MUTED },
  footerLink: { fontSize: 14, fontWeight: '700', color: BRAND },
})
