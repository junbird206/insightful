import { Link, router } from 'expo-router'
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

export default function SignupScreen() {
  const { signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup() {
    if (!email.trim()) {
      setError('이메일을 입력해주세요.')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setLoading(true)
    setError('')
    const err = await signUp(email.trim(), password)
    setLoading(false)

    if (err) {
      setError(err)
    } else {
      router.replace('/(auth)/login')
    }
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
            <Text style={styles.subtitle}>새 계정 만들기</Text>
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
              placeholder="비밀번호 (6자 이상)"
              placeholderTextColor="#aaa"
              value={password}
              onChangeText={(t) => { setPassword(t); setError('') }}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSignup}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>회원가입</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
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

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: { fontSize: 14, color: '#999999' },
  footerLink: { fontSize: 14, fontWeight: '700', color: '#111111' },
})
