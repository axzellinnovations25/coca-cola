import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ThemeColors, useThemeColors } from '../theme/colors';

export default function LoadingScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 12,
    color: colors.textSubtle,
    fontSize: 16,
    fontWeight: '600',
  },
});
