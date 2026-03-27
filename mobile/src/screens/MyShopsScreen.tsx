import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { apiFetch } from '../api/api';
import { ListSkeleton } from '../components/SkeletonLoader';
import { ThemeColors, useThemeColors } from '../theme/colors';

interface Shop {
  id: string;
  name: string;
  address: string;
  phone: string;
  max_bill_amount: number;
  current_outstanding: number;
  active_bills: number;
}

export default function MyShopsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchShops = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch('/api/marudham/shops/assigned');
      setShops(data.shops || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchShops();
    }, [fetchShops]),
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return shops.filter((shop) => {
      const matchesSearch =
        shop.name.toLowerCase().includes(q) ||
        shop.address.toLowerCase().includes(q) ||
        shop.phone.toLowerCase().includes(q);
      const matchesOutstanding = !outstandingOnly || shop.current_outstanding > 0;
      return matchesSearch && matchesOutstanding;
    });
  }, [shops, search, outstandingOnly]);

  if (loading) {
    return <ListSkeleton rows={5} />;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Error loading shops</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={fetchShops}>
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
        <Text style={styles.title}>My Shops ({shops.length})</Text>
        <Text style={styles.subtitle}>Manage assigned shops and outstanding balances.</Text>
      </LinearGradient>
      <View style={styles.searchCard}>
        <TextInput
          placeholder="Search by name, address, or phone"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Outstanding only</Text>
          <Switch
            value={outstandingOnly}
            onValueChange={setOutstandingOnly}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.text}
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<Text style={styles.emptyText}>No shops found.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>{item.address}</Text>
                <Text style={styles.cardSubtitle}>{item.phone}</Text>
              </View>
              <View style={styles.cardMeta}>
                <Text
                  style={[
                    styles.amount,
                    item.current_outstanding > 0 ? styles.amountOutstanding : styles.amountClear,
                  ]}
                >
                  {Number(item.current_outstanding).toFixed(2)} LKR
                </Text>
                <Text style={styles.metaLabel}>Outstanding</Text>
              </View>
            </View>

            {item.max_bill_amount > 0 && (
              <View style={styles.progressContainer}>
                {(() => {
                  const ratio = Math.min(1, item.current_outstanding / item.max_bill_amount);
                  const pct = Math.round(ratio * 100);
                  const barColor = ratio > 0.8 ? colors.danger : ratio > 0.5 ? colors.warning : colors.success;
                  return (
                    <>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${pct}%` as any, backgroundColor: barColor },
                          ]}
                        />
                      </View>
                      <Text style={[styles.progressLabel, { color: barColor }]}>
                        {pct}% of credit limit used
                      </Text>
                    </>
                  );
                })()}
              </View>
            )}

            <View style={styles.statRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Active Bills</Text>
                <Text style={styles.statValue}>{item.active_bills}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Max Bill</Text>
                <Text style={styles.statValue}>{Number(item.max_bill_amount).toFixed(2)} LKR</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <Text style={styles.detailsButtonText}>
                {expandedId === item.id ? 'Hide details' : 'View details'}
              </Text>
            </TouchableOpacity>

            {expandedId === item.id && (
              <View style={styles.detailsBox}>
                <Text style={styles.detailsText}>Shop Name: {item.name}</Text>
                <Text style={styles.detailsText}>Address: {item.address}</Text>
                <Text style={styles.detailsText}>Phone: {item.phone}</Text>
                <Text style={styles.detailsText}>
                  Current Outstanding: {Number(item.current_outstanding).toFixed(2)} LKR
                </Text>
                <Text style={styles.detailsText}>Active Bills: {item.active_bills}</Text>
                <Text style={styles.detailsText}>
                  Max Bill Amount: {Number(item.max_bill_amount).toFixed(2)} LKR
                </Text>
              </View>
            )}
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
    gap: 6,
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterLabel: {
    color: colors.textSubtle,
    fontWeight: '600',
    fontSize: 14,
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
    gap: 14,
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
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: colors.textMuted,
    marginTop: 2,
  },
  cardMeta: {
    alignItems: 'flex-end',
  },
  amount: {
    fontWeight: '700',
  },
  amountOutstanding: {
    color: colors.danger,
  },
  amountClear: {
    color: colors.success,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  progressContainer: {
    gap: 4,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 18,
    marginTop: 5,
    letterSpacing: -0.3,
  },
  detailsButton: {
    backgroundColor: colors.accent + '12',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailsButtonText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  detailsBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  detailsText: {
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 20,
  },
});
