import { Link } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
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

import { useAuth } from '@/lib/auth'

export default function LoginScreen() {
  const { signIn, signInWithGoogle } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

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

  async function handleGoogle() {
    setGoogleLoading(true)
    setError('')
    const err = await signInWithGoogle()
    setGoogleLoading(false)
    if (err) setError(err)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>insightful</Text>
            <Text style={styles.subtitle}>저장한 콘텐츠를 다시 꺼내 쓰는 습관</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="이메일"
              placeholderTextColor="#aaa"
              value={email}
              onChangeText={(t) => { setEmail(t); setError('') }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder="비밀번호"
              placeholderTextColor="#aaa"
              value={password}
              onChangeText={(t) => { setPassword(t); setError('') }}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading || googleLoading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>로그인</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>또는</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google */}
            <TouchableOpacity
              style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
              onPress={handleGoogle}
              disabled={loading || googleLoading}
              activeOpacity={0.8}
            >
              {googleLoading ? (
                <ActivityIndicator color="#111" size="small" />
              ) : (
                <Text style={styles.googleButtonText}>Google로 계속하기</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
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
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },

  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 32, fontWeight: '800', color: '#111111', letterSpacing: -1 },
  subtitle: { fontSize: 14, color: '#999999', marginTop: 8 },

  form: { gap: 12 },
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
  error: { fontSize: 13, color: '#DC2626', textAlign: 'center' },

  button: {
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E8E8E8' },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: '#AAAAAA' },

  googleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  googleButtonText: { fontSize: 15, fontWeight: '600', color: '#333333' },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: { fontSize: 14, color: '#999999' },
  footerLink: { fontSize: 14, fontWeight: '700', color: '#111111' },
})
