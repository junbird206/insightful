import { useAuth } from '@/lib/auth'
import { useEffect, useRef } from 'react'
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'

const MENU_WIDTH = 280
const MAX_CARDS = 50

type Props = {
  visible: boolean
  scrapCount: number
  onClose: () => void
  onMyPage: () => void
  onArchive: () => void
  onDailyReminder: () => void
}

export function SideMenu({ visible, scrapCount, onClose, onMyPage, onArchive, onDailyReminder }: Props) {
  const { user, signOut } = useAuth()
  const translateX = useRef(new Animated.Value(-MENU_WIDTH)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -MENU_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible])

  function handleSignOut() {
    Alert.alert('로그아웃', '정말 로그아웃하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          onClose()
          await signOut()
        },
      },
    ])
  }

  const ratio = Math.min(scrapCount / MAX_CARDS, 1)
  const barColor = scrapCount > 40 ? '#DC2626' : scrapCount > 30 ? '#EA880C' : '#111111'

  return (
    <View style={[styles.overlay, !visible && styles.overlayHidden]} pointerEvents={visible ? 'auto' : 'none'}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
        {/* Profile */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email ?? ''}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Menu items */}
        <View style={styles.menuItems}>
          <MenuItem label="마이페이지" onPress={onMyPage} />
          <MenuItem label="보관함" onPress={onArchive} />
          <MenuItem label="데일리 알람 설정" onPress={onDailyReminder} />
        </View>

        {/* Bottom: usage + logout */}
        <View style={styles.bottom}>
          {/* Card usage */}
          <View style={styles.usageSection}>
            <Text style={styles.usageLabel}>
              저장 카드 {scrapCount} / {MAX_CARDS}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: barColor }]} />
            </View>
          </View>

          <View style={styles.divider} />
          <MenuItem label="로그아웃" onPress={handleSignOut} color="#DC2626" />
        </View>
      </Animated.View>
    </View>
  )
}

function MenuItem({
  label,
  onPress,
  color = '#333333',
}: {
  label: string
  onPress: () => void
  color?: string
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6}>
      <Text style={[styles.menuItemText, { color }]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  overlayHidden: {
    zIndex: -1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: MENU_WIDTH,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    paddingTop: 60,
  },
  profileSection: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#888888',
  },
  email: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  menuItems: {
    flex: 1,
    paddingTop: 8,
  },
  menuItem: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
  },
  bottom: {
    paddingBottom: 48,
  },

  // Usage bar
  usageSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  usageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#111111',
  },
})
