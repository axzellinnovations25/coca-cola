import { useColorScheme } from 'react-native';

const darkColors = {
  background: '#0A0E1A',
  surface: '#141824',
  surfaceAlt: '#1C2333',
  surfaceMuted: '#161B2B',
  border: '#252D42',
  borderStrong: '#2F3A54',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textSubtle: '#CBD5E1',
  accent: '#3B82F6',
  accentSoft: '#1E3A8A',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  successSurface: '#064E3B',
  dangerSurface: '#7F1D1D',
  warningSurface: '#78350F',
  // Modern gradient colors
  gradientStart: '#3B82F6',
  gradientEnd: '#8B5CF6',
  // Card accent colors
  cardBlue: '#1E40AF',
  cardPurple: '#7C3AED',
  cardAmber: '#D97706',
  cardGreen: '#059669',
};

const lightColors: ThemeColors = {
  background: '#FFF5F5',
  surface: '#FFFFFF',
  surfaceAlt: '#FEE2E2',
  surfaceMuted: '#FFF1F1',
  border: '#FECACA',
  borderStrong: '#FCA5A5',
  text: '#1F2937',
  textMuted: '#6B7280',
  textSubtle: '#374151',
  accent: '#DC2626',
  accentSoft: '#FEE2E2',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  successSurface: '#D1FAE5',
  dangerSurface: '#FEE2E2',
  warningSurface: '#FEF3C7',
  // Modern gradient colors - Coca-Cola inspired
  gradientStart: '#DC2626',
  gradientEnd: '#EF4444',
  // Card accent colors - vibrant and diverse
  cardBlue: '#3B82F6',
  cardPurple: '#A855F7',
  cardAmber: '#F59E0B',
  cardGreen: '#10B981',
};

export type ThemeColors = typeof darkColors;

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}

