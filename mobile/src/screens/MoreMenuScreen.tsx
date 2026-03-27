import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors, useThemeColors } from '../theme/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const menuItems: { label: string; description: string; icon: IoniconName; accentColor: string }[] = [
  { label: 'My Shops',      description: 'Assigned shops and balances',         icon: 'storefront-outline', accentColor: '#3B82F6' },
  { label: 'My Orders',     description: 'Order history and receipts',           icon: 'receipt-outline',    accentColor: '#8B5CF6' },
  { label: 'My Collection', description: 'Collection history and stats',         icon: 'wallet-outline',     accentColor: '#10B981' },
  { label: 'Settings',      description: 'Printer, account and app preferences', icon: 'settings-outline',   accentColor: '#F59E0B' },
];

export default function MoreMenuScreen() {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>Extra tools for your daily workflow.</Text>
      </View>

      <View style={styles.list}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => navigation.navigate(item.label as never)}
          >
            <View style={[styles.iconBadge, { backgroundColor: item.accentColor + '18' }]}>
              <Ionicons name={item.icon} size={22} color={item.accentColor} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.cardSubtitle}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    gap: 4,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  cardSubtitle: {
    color: colors.textMuted,
    marginTop: 3,
    fontSize: 13,
  },
});
