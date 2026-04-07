import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  NativeModules,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ThermalPrinterModule from 'react-native-thermal-printer';
import { apiFetch } from '../api/api';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { ThemeColors, useThemeColors } from '../theme/colors';

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const formatRelativeDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en', { weekday: 'short' });
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
};

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

interface BluetoothPrinterDevice {
  deviceName: string;
  macAddress: string;
}

const PRINTER_MAC_KEY = 'bluetooth_receipt_printer_mac';
const BLUETOOTH_SCAN_TIMEOUT_MS = 12000;
const DEFAULT_BLUETOOTH_PRINTER_PROFILE = {
  printerDpi: 203,
  printerWidthMM: 72,
  printerNbrCharactersPerLine: 42,
  autoCut: false,
  openCashbox: false,
  mmFeedPaper: 20,
} as const;
const NARROW_58MM_PRINTER_PROFILE = {
  printerDpi: 203,
  printerWidthMM: 58,
  printerNbrCharactersPerLine: 32,
  autoCut: false,
  openCashbox: false,
  mmFeedPaper: 20,
} as const;
const isLikelyCpclPrinter = (deviceName?: string | null) => {
  const normalized = (deviceName || '').toLowerCase();
  return normalized.includes('dbl') || normalized.includes('4b-');
};
const escapeCpclText = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, "'");
const hasNativeBluetoothRawPrint = () =>
  typeof (NativeModules as any)?.ThermalPrinterModule?.printBluetoothRaw === 'function';

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
  const [printingTest, setPrintingTest] = useState(false);
  const [printTestStatus, setPrintTestStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  const getBluetoothPrinterProfile = (deviceName?: string | null) => {
    const normalized = (deviceName || '').toLowerCase();
    if (
      normalized.includes('58') ||
      normalized.includes('2 inch') ||
      normalized.includes('2-inch') ||
      normalized.includes('mini')
    ) {
      return NARROW_58MM_PRINTER_PROFILE;
    }
    return DEFAULT_BLUETOOTH_PRINTER_PROFILE;
  };

  const requestBluetoothPermissions = async () => {
    if (Platform.OS !== 'android') {
      throw new Error('Bluetooth printing is supported on Android only in this app.');
    }
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      ]);
      const connectGranted =
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
      const scanGranted =
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
      return connectGranted && scanGranted;
    }
    if (Platform.Version >= 23) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) => {
    let timeoutRef: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutRef = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutRef) clearTimeout(timeoutRef);
    }
  };

  const loadPairedPrinters = async () => {
    if (
      !ThermalPrinterModule ||
      typeof ThermalPrinterModule.getBluetoothDeviceList !== 'function' ||
      typeof ThermalPrinterModule.printBluetooth !== 'function'
    ) {
      throw new Error('Bluetooth printer module is unavailable. Use an Android dev/EAS build (not Expo Go).');
    }
    const granted = await requestBluetoothPermissions();
    if (!granted) {
      throw new Error('Bluetooth permission denied.');
    }
    return (
      (await withTimeout(
        ThermalPrinterModule.getBluetoothDeviceList(),
        BLUETOOTH_SCAN_TIMEOUT_MS,
        'Bluetooth scan timed out. Turn on Bluetooth, pair printer in phone settings, then try again.',
      )) || []
    );
  };

  const buildDashboardTestPayload = (lineWidth: number) => {
    const safeWidth = Math.max(16, Math.min(48, lineWidth));
    const divider = '-'.repeat(safeWidth);
    return [
      '[C]DASHBOARD TEST',
      `[C]${new Date().toLocaleString()}`,
      `[L]${divider}`,
      '[L]TEST OK',
      '[L]',
      '[L]',
    ].join('\n') + '\n';
  };

  const buildDashboardCpclTestPayload = () => {
    const lines = ['DASHBOARD TEST', new Date().toLocaleString(), 'TEST OK', '', ''];
    const startY = 24;
    const lineHeight = 30;
    const x = 12;
    const height = 280;
    const cpclLines = lines.map(
      (line, index) => `TEXT 0 0 ${x} ${startY + index * lineHeight} "${escapeCpclText(line)}"`,
    );
    return `! 0 200 200 ${height} 1\r\n${cpclLines.join('\r\n')}\r\nFORM\r\nPRINT\r\n`;
  };

  const handleDashboardTestPrint = async () => {
    if (printingTest) return;
    try {
      setPrintingTest(true);
      setPrintTestStatus({ type: null, message: '' });
      const devices = await loadPairedPrinters();
      if (!devices.length) {
        throw new Error('No paired Bluetooth printer found. Pair the printer in phone Bluetooth settings first.');
      }
      const savedMac = await AsyncStorage.getItem(PRINTER_MAC_KEY);
      const selectedPrinter =
        (savedMac ? devices.find((printer: BluetoothPrinterDevice) => printer.macAddress === savedMac) : null) ||
        devices[0];
      if (!selectedPrinter?.macAddress) {
        throw new Error('No usable Bluetooth printer found.');
      }
      const profile = getBluetoothPrinterProfile(selectedPrinter.deviceName);
      const useCpcl = isLikelyCpclPrinter(selectedPrinter.deviceName) && hasNativeBluetoothRawPrint();
      if (useCpcl) {
        const cpclPayload = buildDashboardCpclTestPayload();
        await (ThermalPrinterModule as any).printBluetoothRaw({
          macAddress: selectedPrinter.macAddress,
          payload: cpclPayload,
        });
      } else {
        const payload = buildDashboardTestPayload(profile.printerNbrCharactersPerLine);
        await ThermalPrinterModule.printBluetooth({
          macAddress: selectedPrinter.macAddress,
          payload,
          ...profile,
        });
      }
      setPrintTestStatus({
        type: 'success',
        message: `Test command sent to ${selectedPrinter.deviceName || selectedPrinter.macAddress}${useCpcl ? ' (CPCL)' : ' (ESC/POS)'}.`,
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to print test.';
      setPrintTestStatus({ type: 'error', message: errorMessage });
      Alert.alert('Print Test Failed', errorMessage);
    } finally {
      setPrintingTest(false);
    }
  };

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

      {/* Stats Grid */}
      <View style={styles.grid}>
        <AnimatedCard delay={100} style={[styles.statCard, styles.statCardBlue]}>
          <Text style={styles.statLabel}>TOTAL ORDERS</Text>
          <Text style={styles.statValue}>{stats?.total_orders || 0}</Text>
        </AnimatedCard>
        <AnimatedCard delay={150} style={[styles.statCard, styles.statCardIndigo]}>
          <Text style={styles.statLabel}>TOTAL REVENUE</Text>
          <Text style={styles.statValue}>{formatCurrency(stats?.total_revenue || 0)}</Text>
        </AnimatedCard>
        <AnimatedCard delay={200} style={[styles.statCard, styles.statCardAmber]}>
          <Text style={styles.statLabel}>OUTSTANDING</Text>
          <Text style={styles.statValue}>{formatCurrency(stats?.outstanding_amount || 0)}</Text>
        </AnimatedCard>
        <AnimatedCard delay={250} style={[styles.statCard, styles.statCardGreen]}>
          <Text style={styles.statLabel}>SHOPS</Text>
          <Text style={styles.statValue}>{stats?.shop_count || 0}</Text>
        </AnimatedCard>
      </View>

      {/* Order Status Section */}
      <AnimatedCard delay={300} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionAccentBar, { backgroundColor: colors.warning }]} />
            <Text style={styles.sectionTitle}>Order Status</Text>
          </View>
          <Text style={styles.sectionCaption}>All time</Text>
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

      {/* Printer Test Section */}
      <AnimatedCard delay={325} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionAccentBar, { backgroundColor: colors.textMuted }]} />
            <Text style={styles.sectionTitle}>Printer</Text>
          </View>
          <Text style={styles.sectionCaption}>Quick check</Text>
        </View>
        <TouchableOpacity
          style={[styles.printTestButton, printingTest && styles.printTestButtonDisabled]}
          onPress={handleDashboardTestPrint}
          disabled={printingTest}
        >
          <Text style={styles.printTestButtonText}>{printingTest ? 'Sending...' : 'Print Test'}</Text>
        </TouchableOpacity>
        {printTestStatus.type ? (
          <Text
            style={[
              styles.printTestStatusText,
              printTestStatus.type === 'success' ? styles.printTestStatusSuccess : styles.printTestStatusError,
            ]}
          >
            {printTestStatus.message}
          </Text>
        ) : null}
      </AnimatedCard>

      {/* Recent Orders Section */}
      <AnimatedCard delay={350} style={styles.sectionCard}>
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
      <AnimatedCard delay={400} style={styles.sectionCard}>
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
  // ── Stats Grid ───────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flexBasis: '48%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    minHeight: 110,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  statCardBlue: {
    borderTopWidth: 3,
    borderTopColor: colors.cardBlue,
  },
  statCardIndigo: {
    borderTopWidth: 3,
    borderTopColor: colors.cardPurple,
  },
  statCardAmber: {
    borderTopWidth: 3,
    borderTopColor: colors.cardAmber,
  },
  statCardGreen: {
    borderTopWidth: 3,
    borderTopColor: colors.cardGreen,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  statValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
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
  // ── Printer ──────────────────────────────────────────────
  printTestButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  printTestButtonDisabled: {
    opacity: 0.5,
  },
  printTestButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  printTestStatusText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  printTestStatusSuccess: {
    color: colors.success,
  },
  printTestStatusError: {
    color: colors.danger,
  },
});

