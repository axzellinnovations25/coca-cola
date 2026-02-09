import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../api/api';
import { ThemeColors, useThemeColors } from '../theme/colors';

interface DashboardStats {
  total_orders: number;
  pending_orders: number;
  approved_orders: number;
  rejected_orders: number;
  total_revenue: number;
  total_collected: number;
  outstanding_amount: number;
  shop_count: number;
  today_orders: number;
  today_collections: number;
}

interface RecentOrder {
  id: string;
  shop_name: string;
  total: number;
  status: string;
  created_at: string;
}

interface RecentCollection {
  payment_id: string;
  shop_name: string;
  amount: number;
  payment_date: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(amount);

export default function DashboardScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentCollections, setRecentCollections] = useState<RecentCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [ordersData, collectionsData, shopsData] = await Promise.all([
        apiFetch('/api/marudham/orders'),
        apiFetch('/api/marudham/collections/representative'),
        apiFetch('/api/marudham/shops/assigned'),
      ]);

      const orders = ordersData.orders || [];
      const collections = collectionsData.collections || [];
      const shops = shopsData.shops || [];

      const dashboardStats: DashboardStats = {
        total_orders: orders.length,
        pending_orders: orders.filter((o: any) => o.status === 'pending').length,
        approved_orders: orders.filter((o: any) => o.status === 'approved').length,
        rejected_orders: orders.filter((o: any) => o.status === 'rejected').length,
        total_revenue: orders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0),
        total_collected: collections.reduce((sum: number, c: any) => sum + Number(c.payment_amount || 0), 0),
        outstanding_amount: shops.reduce((sum: number, s: any) => sum + Number(s.current_outstanding || 0), 0),
        shop_count: shops.length,
        today_orders: orders.filter((o: any) => {
          const orderDate = new Date(o.created_at).toDateString();
          return orderDate === new Date().toDateString();
        }).length,
        today_collections: collections.filter((c: any) => {
          const collectionDate = new Date(c.payment_date).toDateString();
          return collectionDate === new Date().toDateString();
        }).length,
      };

      const recentOrdersData = orders
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((order: any) => ({
          id: order.id,
          shop_name: order.shop_name,
          total: Number(order.total),
          status: order.status,
          created_at: order.created_at,
        }));

      const recentCollectionsData = collections
        .sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
        .slice(0, 5)
        .map((collection: any) => ({
          payment_id: collection.payment_id,
          shop_name: collection.shop?.name || collection.shop_name,
          amount: Number(collection.payment_amount),
          payment_date: collection.payment_date,
        }));

      setStats(dashboardStats);
      setRecentOrders(recentOrdersData);
      setRecentCollections(recentCollectionsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.centerText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Error loading dashboard</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={fetchDashboardData}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{new Date().toLocaleDateString()}</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>Welcome back! Here is your live summary.</Text>
        <View style={styles.headerStatsRow}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatTag}>Today</Text>
            <Text style={styles.headerStatValue}>{stats?.today_orders || 0}</Text>
            <Text style={styles.headerStatLabel}>Orders Today</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatTag}>Today</Text>
            <Text style={styles.headerStatValue}>{stats?.today_collections || 0}</Text>
            <Text style={styles.headerStatLabel}>Collections</Text>
          </View>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={[styles.statCard, styles.statCardBlue]}>
          <Text style={styles.statLabel}>Total Orders</Text>
          <Text style={styles.statValue}>{stats?.total_orders || 0}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardIndigo]}>
          <Text style={styles.statLabel}>Total Revenue</Text>
          <Text style={styles.statValue}>{formatCurrency(stats?.total_revenue || 0)}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardAmber]}>
          <Text style={styles.statLabel}>Outstanding</Text>
          <Text style={styles.statValue}>{formatCurrency(stats?.outstanding_amount || 0)}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardGreen]}>
          <Text style={styles.statLabel}>Shops Assigned</Text>
          <Text style={styles.statValue}>{stats?.shop_count || 0}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Order Status</Text>
          <Text style={styles.sectionCaption}>All time</Text>
        </View>
        <View style={styles.statusGrid}>
          <View style={[styles.statusCard, styles.statusPending]}>
            <Text style={styles.statusLabel}>Pending</Text>
            <Text style={styles.statusValue}>{stats?.pending_orders || 0}</Text>
          </View>
          <View style={[styles.statusCard, styles.statusApproved]}>
            <Text style={styles.statusLabel}>Approved</Text>
            <Text style={styles.statusValue}>{stats?.approved_orders || 0}</Text>
          </View>
          <View style={[styles.statusCard, styles.statusRejected]}>
            <Text style={styles.statusLabel}>Rejected</Text>
            <Text style={styles.statusValue}>{stats?.rejected_orders || 0}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <Text style={styles.sectionCaption}>Last 5</Text>
        </View>
        {recentOrders.length ? (
          recentOrders.map((order) => (
            <View key={order.id} style={styles.listRow}>
              <View style={styles.listText}>
                <Text style={styles.listTitle}>{order.shop_name}</Text>
                <Text style={styles.listCaption}>{formatCurrency(order.total)}</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{order.status}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent orders</Text>
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Collections</Text>
          <Text style={styles.sectionCaption}>Last 5</Text>
        </View>
        {recentCollections.length ? (
          recentCollections.map((collection) => (
            <View key={collection.payment_id} style={styles.listRow}>
              <View style={styles.listText}>
                <Text style={styles.listTitle}>{collection.shop_name}</Text>
                <Text style={styles.listCaption}>{formatCurrency(collection.amount)}</Text>
              </View>
              <Text style={styles.dateText}>
                {new Date(collection.payment_date).toLocaleDateString()}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent collections</Text>
        )}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.background,
    gap: 16,
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
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: 10,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.textSubtle,
    lineHeight: 18,
  },
  datePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  datePillText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 12,
  },
  headerStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  headerStat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerStatTag: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerStatValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  headerStatLabel: {
    color: colors.textMuted,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flexBasis: '48%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statCardBlue: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
  },
  statCardIndigo: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderStrong,
  },
  statCardAmber: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
  },
  statCardGreen: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statusCard: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  statusPending: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  statusApproved: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  statusRejected: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  statusLabel: {
    color: colors.textSubtle,
    fontSize: 12,
  },
  statusValue: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
    marginTop: 4,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listText: {
    flex: 1,
    marginRight: 12,
  },
  listTitle: {
    color: colors.text,
    fontWeight: '700',
  },
  listCaption: {
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  statusBadgeText: {
    color: colors.accent,
    fontWeight: '700',
    textTransform: 'capitalize',
    fontSize: 12,
  },
  dateText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 12,
  },
  emptyText: {
    color: colors.textMuted,
  },
});

