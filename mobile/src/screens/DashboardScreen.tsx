import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { apiFetch } from '../api/api';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { ThemeColors, useThemeColors } from '../theme/colors';

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const parseDate = (value: string | number | Date | null | undefined) => {
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

const formatRelativeDate = (dateValue: string | number | null | undefined) => {
  const date = parseDate(dateValue);
  if (!date) return '--';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en', { weekday: 'short' });
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
};

interface DashboardStats {
  pending_orders: number;
  approved_orders: number;
  rejected_orders: number;
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

// Animated Card Component with scale effect
const AnimatedCard = ({ children, delay = 0, style }: any) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

// Pressable Card with haptic feedback
const PressableCard = ({ children, style, onPress }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (Platform.OS === 'android') {
      Vibration.vibrate(8);
    }
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function DashboardScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentCollections, setRecentCollections] = useState<RecentCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedOnce = useRef(false);
  const lastFetchedAt = useRef(0);

  const fetchDashboardData = useCallback(async (isRefresh = false, silent = false) => {
    try {
      if (!isRefresh && !silent) setLoading(true);
      setError('');

      const [ordersResult, collectionsResult, shopsResult] = await Promise.allSettled([
        apiFetch('/api/marudham/orders'),
        apiFetch('/api/marudham/collections/representative'),
        apiFetch('/api/marudham/shops/assigned'),
      ]);

      const ordersData = ordersResult.status === 'fulfilled' ? ordersResult.value : { orders: [] };
      const collectionsData = collectionsResult.status === 'fulfilled' ? collectionsResult.value : { collections: [] };
      const shopsData = shopsResult.status === 'fulfilled' ? shopsResult.value : { shops: [] };

      const orders = ordersData.orders || [];
      const collections = collectionsData.collections || [];
      const shops = shopsData.shops || [];

      const todayString = new Date().toDateString();
      const todayOrders = orders.filter(
        (o: any) => parseDate(o.created_at)?.toDateString() === todayString,
      );
      const todayCollections = collections.filter(
        (c: any) => parseDate(c.payment_date)?.toDateString() === todayString,
      );

      const dashboardStats: DashboardStats = {
        pending_orders: todayOrders.filter((o: any) => o.status === 'pending').length,
        approved_orders: todayOrders.filter((o: any) => o.status === 'approved').length,
        rejected_orders: todayOrders.filter((o: any) => o.status === 'rejected').length,
        shop_count: shops.length,
        today_orders: todayOrders.length,
        today_collections: todayCollections.length,
      };

      const recentOrdersData = orders
        .sort((a: any, b: any) => (parseDate(b.created_at)?.getTime() || 0) - (parseDate(a.created_at)?.getTime() || 0))
        .slice(0, 5)
        .map((order: any) => ({
          id: order.id,
          shop_name: order.shop_name,
          total: Number(order.total),
          status: order.status,
          created_at: order.created_at,
        }));

      const recentCollectionsData = collections
        .sort(
          (a: any, b: any) => (parseDate(b.payment_date)?.getTime() || 0) - (parseDate(a.payment_date)?.getTime() || 0),
        )
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

      if (isRefresh && Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      setError(err.message);
      if (isRefresh && Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (!hasLoadedOnce.current) {
        hasLoadedOnce.current = true;
        lastFetchedAt.current = now;
        fetchDashboardData();
      } else if (now - lastFetchedAt.current > 30_000) {
        lastFetchedAt.current = now;
        fetchDashboardData(false, true); // silent background refresh, no skeleton
      }
    }, [fetchDashboardData]),
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Error loading dashboard</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={() => fetchDashboardData()}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      {/* Header Card */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <AnimatedCard delay={0} style={styles.headerContent}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.headerGreeting}>{getTimeGreeting()}</Text>
              <Text style={styles.headerTitle}>Dashboard</Text>
            </View>
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>
                {new Date().toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </View>
          <View style={styles.headerStatsRow}>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatValue}>{stats?.today_orders || 0}</Text>
              <Text style={styles.headerStatLabel}>Today's Orders</Text>
            </View>
            <View style={styles.headerStatSep} />
            <View style={styles.headerStat}>
              <Text style={styles.headerStatValue}>{stats?.today_collections || 0}</Text>
              <Text style={styles.headerStatLabel}>Collections</Text>
            </View>
            <View style={styles.headerStatSep} />
            <View style={styles.headerStat}>
              <Text style={styles.headerStatValue}>{stats?.shop_count || 0}</Text>
              <Text style={styles.headerStatLabel}>Shops</Text>
            </View>
          </View>
        </AnimatedCard>
      </LinearGradient>

      {/* Order Status Section */}
      <AnimatedCard delay={300} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionAccentBar, { backgroundColor: colors.warning }]} />
            <Text style={styles.sectionTitle}>Order Status</Text>
          </View>
          <Text style={styles.sectionCaption}>Today</Text>
        </View>
        <View style={styles.statusGrid}>
          <View style={[styles.statusCard, { backgroundColor: colors.warningSurface }]}>
            <Text style={[styles.statusLabel, { color: colors.warning }]}>Pending</Text>
            <Text style={[styles.statusValue, { color: colors.warning }]}>{stats?.pending_orders || 0}</Text>
          </View>
          <View style={[styles.statusCard, { backgroundColor: colors.successSurface }]}>
            <Text style={[styles.statusLabel, { color: colors.success }]}>Approved</Text>
            <Text style={[styles.statusValue, { color: colors.success }]}>{stats?.approved_orders || 0}</Text>
          </View>
          <View style={[styles.statusCard, { backgroundColor: colors.dangerSurface }]}>
            <Text style={[styles.statusLabel, { color: colors.danger }]}>Rejected</Text>
            <Text style={[styles.statusValue, { color: colors.danger }]}>{stats?.rejected_orders || 0}</Text>
          </View>
        </View>
      </AnimatedCard>

      {/* Recent Orders Section */}
      <AnimatedCard delay={325} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionAccentBar, { backgroundColor: colors.accent }]} />
            <Text style={styles.sectionTitle}>Recent Orders</Text>
          </View>
          <Text style={styles.sectionCaption}>Last 5</Text>
        </View>
        {recentOrders.length ? (
          recentOrders.map((order) => {
            const badgeColors = order.status === 'approved'
              ? { bg: colors.success + '22', text: colors.success }
              : order.status === 'rejected'
              ? { bg: colors.danger + '22', text: colors.danger }
              : { bg: colors.warning + '22', text: colors.warning };
            return (
              <PressableCard
                key={order.id}
                style={styles.listRow}
                onPress={() => navigation.navigate('MoreStack', { screen: 'My Orders' })}
              >
                <View style={[styles.shopAvatar, { backgroundColor: badgeColors.bg }]}>
                  <Text style={[styles.shopAvatarText, { color: badgeColors.text }]}>
                    {order.shop_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.listText}>
                  <Text style={styles.listTitle}>{order.shop_name}</Text>
                  <Text style={styles.listCaption}>{formatCurrency(order.total)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={[styles.statusBadge, { backgroundColor: badgeColors.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badgeColors.text }]}>{order.status}</Text>
                  </View>
                  <Text style={styles.dateText}>{formatRelativeDate(order.created_at)}</Text>
                </View>
              </PressableCard>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No recent orders</Text>
        )}
      </AnimatedCard>

      {/* Recent Collections Section */}
      <AnimatedCard delay={375} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionAccentBar, { backgroundColor: colors.success }]} />
            <Text style={styles.sectionTitle}>Recent Collections</Text>
          </View>
          <Text style={styles.sectionCaption}>Last 5</Text>
        </View>
        {recentCollections.length ? (
          recentCollections.map((collection) => (
            <PressableCard
              key={collection.payment_id}
              style={styles.listRow}
              onPress={() => navigation.navigate('MoreStack', { screen: 'My Collection' })}
            >
              <View style={[styles.shopAvatar, { backgroundColor: colors.success + '22' }]}>
                <Text style={[styles.shopAvatarText, { color: colors.success }]}>
                  {collection.shop_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.listText}>
                <Text style={styles.listTitle}>{collection.shop_name}</Text>
                <Text style={styles.listCaption}>{formatCurrency(collection.amount)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={[styles.statusBadge, { backgroundColor: colors.success + '22' }]}>
                  <Text style={[styles.statusBadgeText, { color: colors.success }]}>Collected</Text>
                </View>
                <Text style={styles.dateText}>{formatRelativeDate(collection.payment_date)}</Text>
              </View>
            </PressableCard>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent collections</Text>
        )}
      </AnimatedCard>
    </Animated.ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 95,
    backgroundColor: colors.background,
    gap: 14,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerText: {
    marginTop: 16,
    color: colors.textSubtle,
    fontWeight: '600',
    fontSize: 15,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorText: {
    color: colors.textSubtle,
    marginTop: 8,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  retry: {
    marginTop: 24,
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  // ── Header ──────────────────────────────────────────────
  headerGradient: {
    borderRadius: 26,
    overflow: 'hidden',
    marginBottom: 2,
  },
  headerContent: {
    padding: 22,
    paddingBottom: 20,
    gap: 18,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerGreeting: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  datePill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    marginTop: 6,
  },
  datePillText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  headerStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  headerStat: {
    flex: 1,
    alignItems: 'center',
  },
  headerStatSep: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginVertical: 4,
  },
  headerStatValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  headerStatLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  // ── Section Cards ────────────────────────────────────────
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    paddingTop: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  sectionAccentBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  sectionCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  // ── Order Status ─────────────────────────────────────────
  statusGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statusCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  statusPending: {
    backgroundColor: colors.surfaceMuted,
  },
  statusApproved: {
    backgroundColor: colors.surfaceMuted,
  },
  statusRejected: {
    backgroundColor: colors.surfaceMuted,
  },
  statusLabel: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
    textAlign: 'center',
  },
  statusValue: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 26,
    letterSpacing: -0.5,
  },
  // ── List Rows ────────────────────────────────────────────
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
    minHeight: 64,
  },
  shopAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shopAvatarText: {
    fontSize: 17,
    fontWeight: '800',
  },
  listText: {
    flex: 1,
  },
  listTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 3,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  listCaption: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.accent + '20',
  },
  statusBadgeText: {
    color: colors.accent,
    fontWeight: '700',
    textTransform: 'capitalize',
    fontSize: 12,
  },
  dateText: {
    color: colors.textMuted,
    fontWeight: '500',
    fontSize: 12,
    marginTop: 3,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 20,
  },
});

