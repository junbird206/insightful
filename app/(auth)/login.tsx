import { Link } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
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

export default function LoginScreen() {
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<'email' | 'password' | null>(null)

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }
    setLoading(true)
    setError('')
    const err = await signIn(email.trim(), password)
    setLoading(false)
    if (err) setError(err)
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
              <Text style={styles.headline}>
                다시 꺼내 쓰는{'\n'}지식을 시작해볼까요?
              </Text>
              <Text style={styles.tagline}>모바일과 웹이 하나의 계정으로 이어집니다.</Text>
            </View>

            <View style={styles.form}>
              <TextInput
                style={[styles.input, focused === 'email' && styles.inputFocused]}
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
                style={[styles.input, focused === 'password' && styles.inputFocused]}
                placeholder="비밀번호"
                placeholderTextColor="#A6ADBD"
                value={password}
                onChangeText={(t) => { setPassword(t); setError('') }}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>로그인</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>계정이 없으신가요? </Text>
              <Link href="/(auth)/signup" asChild>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={styles.footerLink}>회원가입</Text>
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

  hero: { alignItems: 'center', marginBottom: 36 },
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
  inputFocused: {
    borderColor: BRAND,
    backgroundColor: '#FFFFFF',
  },
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
