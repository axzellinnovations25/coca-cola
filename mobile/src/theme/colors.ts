import { useColorScheme } from 'react-native';

const darkColors = {
  background: '#0c1328',
  surface: '#101a33',
  surfaceAlt: '#132756',
  surfaceMuted: '#0c1328',
  border: '#18254a',
  borderStrong: '#264587',
  text: '#f4f6ff',
  textMuted: '#9fb1ff',
  textSubtle: '#c6d5ff',
  accent: '#8bc4ff',
  accentSoft: '#162042',
  success: '#8effc1',
  danger: '#ffb4b4',
  warning: '#f7e287',
  successSurface: '#1c3d2b',
  dangerSurface: '#3d1c1c',
  warningSurface: '#2b2a1a',
};

const lightColors: ThemeColors = {
  background: '#f6f7fb',
  surface: '#ffffff',
  surfaceAlt: '#eef3ff',
  surfaceMuted: '#f0f4ff',
  border: '#d7dfef',
  borderStrong: '#c3d0ea',
  text: '#111827',
  textMuted: '#5b6b86',
  textSubtle: '#3f4c6a',
  accent: '#2457d3',
  accentSoft: '#dbe7ff',
  success: '#15803d',
  danger: '#b91c1c',
  warning: '#b45309',
  successSurface: '#dcfce7',
  dangerSurface: '#fee2e2',
  warningSurface: '#fff7ed',
};

export type ThemeColors = typeof darkColors;

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}

