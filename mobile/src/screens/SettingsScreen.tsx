import Constants from 'expo-constants';
import React, { useMemo } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors, useThemeColors } from '../theme/colors';

const PRIVACY_POLICY_URL = 'https://sbdistribution.store/privacy-policy/';

export default function SettingsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const version = Constants.expoConfig?.version || '1.0.0';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Application information and support.</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.icon}><Ionicons name="phone-portrait-outline" size={21} color={colors.accent} /></View>
          <View style={styles.rowText}>
            <Text style={styles.label}>Rep Route</Text>
            <Text style={styles.meta}>Version {version}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
          <View style={styles.icon}><Ionicons name="shield-checkmark-outline" size={21} color={colors.accent} /></View>
          <View style={styles.rowText}>
            <Text style={styles.label}>Privacy Policy</Text>
            <Text style={styles.meta}>View online</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={styles.note}>Receipt printers can be selected from the print dialog after placing an order.</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 18, gap: 10 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  subtitle: { color: colors.textMuted, marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  label: { color: colors.text, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 12 },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 17, paddingHorizontal: 3 },
});
