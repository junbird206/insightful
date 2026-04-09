import { Tabs } from 'expo-router'
import React from 'react'

import { HapticTab } from '@/components/haptic-tab'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { emit } from '@/lib/events'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: '#111111',
        tabBarInactiveTintColor: '#AAAAAA',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8E8E8',
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Recent',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="clock.fill" color={color} />,
        }}
        listeners={{
          tabPress: () => emit('reset-filters'),
        }}
      />
      <Tabs.Screen
        name="read"
        options={{
          title: 'To Read',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="book.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="do"
        options={{
          title: 'To Do',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={22} name="checkmark.circle.fill" color={color} />
          ),
        }}
      />
      {/* add: FAB으로 진입, 탭바에서 숨김 */}
      <Tabs.Screen name="add" options={{ href: null }} />
    </Tabs>
  )
}
