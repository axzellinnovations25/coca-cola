import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { apiFetch } from '../api/api';
import { ThemeColors, useThemeColors } from '../theme/colors';

interface Collection {
  payment_id: string;
  payment_amount: number;
  payment_notes?: string;
  payment_date: string;
  order_id: string;
  order_total: number;
  order_status: string;
  shop: {
    id: string;
    name: string;
    address: string;
    phone: string;
  };
  outstanding_after_payment: number;
  collection_percentage: string;
}

interface CollectionStats {
  total_collections: number;
  total_amount_collected: number;
  this_month: { amount: number; collections: number };
  today: { amount: number; collections: number };
}

const dateFilters = ['all', 'today', 'this_week', 'this_month'];

const parseDate = (value: string | number | Date | null | undefined): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) {
    const ms = numeric < 1e12 ? numeric * 1000 : numeric;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d;
  }
  let normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw;
  normalized = normalized.replace(/(\.\d{3})\d+/, '$1');
  if (/[+-]\d{2}$/.test(normalized)) {
    normalized = `${normalized}:00`;
  } else if (/[+-]\d{4}$/.test(normalized)) {
    normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  }
  let d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) return d;
  if (!normalized.endsWith('Z') && !/[+-]\d{2}(:?\d{2})?$/.test(normalized)) {
    d = new Date(`${normalized}Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const noFraction = normalized.replace(/\.\d+/, '');
  if (noFraction !== normalized) {
    d = new Date(noFraction);
    if (!Number.isNaN(d.getTime())) return d;
    if (!noFraction.endsWith('Z') && !/[+-]\d{2}(:?\d{2})?$/.test(noFraction)) {
      d = new Date(`${noFraction}Z`);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|([+-])(\d{2})(?::?(\d{2}))?)?$/,
  );
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    const fraction = match[7] ? Number(match[7]) : 0;
    const ms = Math.floor(fraction * 1000);
    const tz = match[8];
    if (!tz) {
      const localDate = new Date(year, month, day, hour, minute, second, ms);
      return Number.isNaN(localDate.getTime()) ? null : localDate;
    }
    if (tz === 'Z') {
      return new Date(Date.UTC(year, month, day, hour, minute, second, ms));
    }
    const sign = match[9] === '-' ? -1 : 1;
    const tzHour = Number(match[10] || 0);
    const tzMin = Number(match[11] || 0);
    const offsetMinutes = sign * (tzHour * 60 + tzMin);
    const utcTime = Date.UTC(year, month, day, hour, minute, second, ms) - offsetMinutes * 60000;
    return new Date(utcTime);
  }
  return null;
};

const formatDate = (value: string | number | null | undefined): string => {
  const d = parseDate(value);
  return d ? d.toLocaleDateString() : '--';
};

export default function MyCollectionScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [collectionsData, statsData] = await Promise.all([
        apiFetch('/api/marudham/collections/representative'),
        apiFetch('/api/marudham/collections/representative/stats'),
      ]);
      setCollections(collectionsData.collections || []);
      setStats(statsData.stats || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCollections();
    }, [fetchCollections]),
  );

  const filteredCollections = useMemo(() => {
    const q = search.toLowerCase();
    return collections.filter((collection) => {
      const matchesSearch =
        collection.shop.name.toLowerCase().includes(q) ||
        collection.shop.address.toLowerCase().includes(q) ||
        collection.order_id.toLowerCase().includes(q) ||
        String(collection.payment_amount).includes(q) ||
        (collection.payment_notes || '').toLowerCase().includes(q);

      const matchesDateFilter = (() => {
        if (dateFilter === 'all') return true;
        const paymentDate = parseDate(collection.payment_date) ?? new Date(0);
        if (dateFilter === 'today') {
          return paymentDate.toDateString() === new Date().toDateString();
        }
        if (dateFilter === 'this_month') {
          const now = new Date();
          return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
        }
        if (dateFilter === 'this_week') {
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return paymentDate >= weekAgo;
        }
        return true;
      })();

      return matchesSearch && matchesDateFilter;
    });
  }, [collections, search, dateFilter]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.centerText}>Loading collections...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Error loading collections</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={fetchCollections}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const listHeader = (
    <View style={styles.listHeader}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerBanner}
      >
        <Text style={styles.title}>My Collections</Text>
        <Text style={styles.subtitle}>Track all your payment collections.</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.total_collections || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.total_amount_collected?.toFixed(0) || 0}</Text>
            <Text style={styles.statLabel}>LKR Collected</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.this_month?.amount?.toFixed(0) || 0}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.today?.amount?.toFixed(0) || 0}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
        </View>
      </LinearGradient>
      <View style={styles.searchCard}>
        <TextInput
          placeholder="Search collections..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.filterRow}>
          {dateFilters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterPill, dateFilter === filter && styles.filterPillActive]}
              onPress={() => setDateFilter(filter)}
            >
              <Text style={[styles.filterText, dateFilter === filter && styles.filterTextActive]}>
                {filter.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredCollections}
        keyExtractor={(item) => item.payment_id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<Text style={styles.emptyText}>No collections found.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{item.shop.name}</Text>
                <Text style={styles.cardSubtitle}>{item.shop.address}</Text>
              </View>
              <Text style={styles.cardAmount}>{item.payment_amount.toFixed(2)} LKR</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardMeta}>Order #{item.order_id.slice(0, 8)}</Text>
              <Text style={styles.cardMeta}>{formatDate(item.payment_date)}</Text>
            </View>
            <View style={styles.progressRow}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, parseFloat(item.collection_percentage))}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{item.collection_percentage}%</Text>
            </View>
            {item.payment_notes ? <Text style={styles.noteText}>{item.payment_notes}</Text> : null}
          </View>
        )}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  centerText: {
    marginTop: 12,
    color: colors.textSubtle,
    fontWeight: '600',
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    color: colors.textSubtle,
    marginTop: 8,
    textAlign: 'center',
  },
  retry: {
    marginTop: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: colors.background,
    fontWeight: '700',
  },
  listHeader: {
    marginHorizontal: -16,
    marginBottom: 4,
  },
  headerBanner: {
    padding: 20,
    paddingBottom: 32,
    gap: 14,
  },
  searchCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: -18,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    zIndex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    flexBasis: '48%',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  statValue: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: -0.3,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
  },
  filterText: {
    color: colors.textSubtle,
    textTransform: 'capitalize',
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  cardSubtitle: {
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 13,
  },
  cardAmount: {
    color: colors.success,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.3,
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
  },
  progressFill: {
    height: 8,
    backgroundColor: colors.accent,
    borderRadius: 999,
  },
  progressText: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  noteText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
