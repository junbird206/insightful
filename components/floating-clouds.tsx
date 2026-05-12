import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native'

type Cloud = {
  size: number
  color: string
  opacity: number
  // 시작 위치 (퍼센트 좌표, 0~1)
  startX: number
  startY: number
  // drift 거리 (px)
  driftX: number
  driftY: number
  // 한 사이클 길이 (ms) — 클수록 더 느리게
  durationY: number
  durationX: number
  // 위상차 (ms)
  delay: number
}

// 다섯 개의 부드러운 생각구름. 색상은 워드마크 인디고/골드 계열을 옅게 풀어
// 배경에 살짝 떠 있는 느낌만 줄 수 있도록 채도를 낮춰서 사용.
const CLOUDS: Cloud[] = [
  {
    size: 220, color: '#C8D2FF', opacity: 0.55,
    startX: 0.05, startY: 0.12, driftX: 18, driftY: 22,
    durationY: 9000, durationX: 11000, delay: 0,
  },
  {
    size: 170, color: '#FFE8C2', opacity: 0.55,
    startX: 0.62, startY: 0.04, driftX: 24, driftY: 28,
    durationY: 11000, durationX: 13000, delay: 600,
  },
  {
    size: 260, color: '#E2E8FF', opacity: 0.6,
    startX: 0.55, startY: 0.55, driftX: 20, driftY: 24,
    durationY: 13000, durationX: 15000, delay: 1200,
  },
  {
    size: 150, color: '#FFD9D0', opacity: 0.5,
    startX: -0.05, startY: 0.65, driftX: 16, driftY: 30,
    durationY: 10000, durationX: 12500, delay: 300,
  },
  {
    size: 130, color: '#D6F0E2', opacity: 0.55,
    startX: 0.75, startY: 0.78, driftX: 22, driftY: 20,
    durationY: 12000, durationX: 14000, delay: 900,
  },
]

export function FloatingClouds() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {CLOUDS.map((cloud, idx) => (
        <Cloud key={idx} {...cloud} />
      ))}
    </View>
  )
}

function Cloud({
  size,
  color,
  opacity,
  startX,
  startY,
  driftX,
  driftY,
  durationY,
  durationX,
  delay,
}: Cloud) {
  const yAnim = useRef(new Animated.Value(0)).current
  const xAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    function loopAnim(value: Animated.Value, duration: number, startDelay: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration,
            delay: startDelay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      )
    }

    const yLoop = loopAnim(yAnim, durationY, delay)
    const xLoop = loopAnim(xAnim, durationX, delay)

    yLoop.start()
    xLoop.start()

    return () => {
      yLoop.stop()
      xLoop.stop()
    }
  }, [yAnim, xAnim, durationY, durationX, delay])

  const translateY = yAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-driftY / 2, driftY / 2],
  })
  const translateX = xAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-driftX / 2, driftX / 2],
  })

  const style: Animated.WithAnimatedObject<ViewStyle> = {
    position: 'absolute',
    left: `${startX * 100}%`,
    top: `${startY * 100}%`,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    opacity,
    transform: [{ translateX }, { translateY }],
  }

  return <Animated.View style={style} />
}
