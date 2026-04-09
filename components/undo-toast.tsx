import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Text } from 'react-native'
import { useEffect, useRef } from 'react'

type Props = {
  visible: boolean
  onUndo: () => void
  count?: number
}

export function UndoToast({ visible, onUndo, count = 1 }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [visible, fadeAnim])

  if (!visible) return null

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.toast}>
        <Text style={styles.text}>{count > 1 ? `${count}개 삭제됨` : '삭제됨'}</Text>
        <TouchableOpacity onPress={onUndo} activeOpacity={0.7}>
          <Text style={styles.action}>실행취소</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  action: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
})
