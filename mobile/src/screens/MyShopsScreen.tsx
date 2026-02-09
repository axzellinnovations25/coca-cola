import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../api/api';
import { ThemeColors, useThemeColors } from '../theme/colors';
import DismissKeyboard from '../components/DismissKeyboard';

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
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.centerText}>Loading shops...</Text>
      </View>
    );
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

  return (
    <DismissKeyboard>
      <View style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>My Shops ({shops.length})</Text>
        <Text style={styles.subtitle}>Manage assigned shops and outstanding balances.</Text>
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

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterLabel: {
    color: colors.textSubtle,
    fontWeight: '600',
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
    gap: 12,
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
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  statValue: {
    color: colors.text,
    fontWeight: '700',
    marginTop: 4,
  },
  detailsButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  detailsButtonText: {
    color: colors.accent,
    fontWeight: '700',
  },
  detailsBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  detailsText: {
    color: colors.textSubtle,
  },
});
