import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeColors, useThemeColors } from '../theme/colors';

const menuItems = [
  { label: 'My Shops', description: 'Assigned shops and balances' },
  { label: 'My Orders', description: 'Order history and receipts' },
  { label: 'My Collection', description: 'Collection history and stats' },
];

export default function MoreMenuScreen() {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>More</Text>
      <Text style={styles.subtitle}>Extra tools for your daily workflow.</Text>

      <View style={styles.list}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.card}
            onPress={() => navigation.navigate(item.label as never)}
          >
            <View>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.cardSubtitle}>{item.description}</Text>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
  },
  list: {
    marginTop: 8,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: colors.textMuted,
    marginTop: 4,
  },
  cardArrow: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '700',
  },
});
