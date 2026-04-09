/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Kream-inspired minimal palette: deep black + warm whites + subtle grays
const tintColorLight = '#111111';
const tintColorDark = '#FAFAFA';

export const Colors = {
  light: {
    text: '#111111',           // Deep black
    background: '#FAFAFA',     // Warm white
    tint: tintColorLight,      // Primary action color
    icon: '#999999',           // Subtle gray
    tabIconDefault: '#CCCCCC', // Very light gray
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#FAFAFA',
    background: '#111111',
    tint: tintColorDark,
    icon: '#666666',
    tabIconDefault: '#666666',
    tabIconSelected: tintColorDark,
  },
};

// Extended palette for cards, badges, etc.
export const ExtendedColors = {
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  mediumGray: '#E8E8E8',
  strongGray: '#CCCCCC',
  darkGray: '#999999',
  darkBlack: '#111111',
  
  // Status colors (subtle)
  success: '#6B8E23',   // Olive green
  warning: '#D4A574',   // Warm brown
  danger: '#A0522D',    // Muted red-brown
  info: '#708090',      // Slate gray
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
