import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../api/api';
import { ThemeColors, useThemeColors } from '../theme/colors';
import DismissKeyboard from '../components/DismissKeyboard';

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
        const paymentDate = new Date(collection.payment_date);
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

  return (
    <DismissKeyboard>
      <View style={styles.container}>
      <View style={styles.headerCard}>
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

      <FlatList
        data={filteredCollections}
        keyExtractor={(item) => item.payment_id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
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
              <Text style={styles.cardMeta}>{new Date(item.payment_date).toLocaleDateString()}</Text>
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
    </DismissKeyboard>
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
  headerCard: {
    padding: 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    flexBasis: '48%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  statValue: {
    color: colors.text,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterText: {
    color: colors.textSubtle,
    textTransform: 'capitalize',
    fontSize: 12,
  },
  filterTextActive: {
    color: colors.background,
    fontWeight: '700',
  },
  list: {
    padding: 20,
    gap: 12,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
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
  },
  cardSubtitle: {
    color: colors.textMuted,
    marginTop: 2,
  },
  cardAmount: {
    color: colors.success,
    fontWeight: '700',
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 999,
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 999,
  },
  progressText: {
    color: colors.textSubtle,
    fontSize: 12,
  },
  noteText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
