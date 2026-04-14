import { DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { ActivityIndicator, AppState, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import 'react-native-reanimated'

import { AuthProvider, useAuth } from '@/lib/auth'
import { importPendingScraps } from '@/lib/import-pending'
import { requestNotificationPermission } from '@/lib/notifications'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider value={DefaultTheme}>
          <AuthGate />
          <StatusBar style="dark" />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}

function AuthGate() {
  const { session, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [session, loading])

  // Request notification permission once after login
  useEffect(() => {
    if (loading || !session) return
    requestNotificationPermission().catch(() => {})
  }, [loading, session])

  // Drain the iOS Share Extension pending queue on cold start and whenever
  // the app returns to foreground. Runs only after auth is known and the
  // user is logged in — saveScrap hits RLS-protected Supabase tables.
  useEffect(() => {
    if (loading || !session) return

    importPendingScraps().catch((err) =>
      console.error('[app] importPendingScraps failed', err),
    )

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        importPendingScraps().catch((err) =>
          console.error('[app] importPendingScraps failed', err),
        )
      }
    })
    return () => sub.remove()
  }, [loading, session])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' }}>
        <ActivityIndicator size="large" color="#111111" />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  )
}
