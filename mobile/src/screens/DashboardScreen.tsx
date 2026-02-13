import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  NativeModules,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ThermalPrinterModule from 'react-native-thermal-printer';
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentCollections, setRecentCollections] = useState<RecentCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
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

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
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
        <AnimatedCard delay={0} style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>{new Date().toLocaleDateString()}</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>Welcome back! Here's your live summary.</Text>
          <View style={styles.headerStatsRow}>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatTag}>TODAY</Text>
              <Text style={styles.headerStatValue}>{stats?.today_orders || 0}</Text>
              <Text style={styles.headerStatLabel}>Orders</Text>
            </View>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatTag}>TODAY</Text>
              <Text style={styles.headerStatValue}>{stats?.today_collections || 0}</Text>
              <Text style={styles.headerStatLabel}>Collections</Text>
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
      </AnimatedCard>

      {/* Printer Test Section */}
      <AnimatedCard delay={325} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Printer</Text>
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
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <Text style={styles.sectionCaption}>Last 5</Text>
        </View>
        {recentOrders.length ? (
          recentOrders.map((order, index) => (
            <PressableCard key={order.id} style={styles.listRow}>
              <View style={styles.listText}>
                <Text style={styles.listTitle}>{order.shop_name}</Text>
                <Text style={styles.listCaption}>{formatCurrency(order.total)}</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{order.status}</Text>
              </View>
            </PressableCard>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent orders</Text>
        )}
      </AnimatedCard>

      {/* Recent Collections Section */}
      <AnimatedCard delay={400} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Collections</Text>
          <Text style={styles.sectionCaption}>Last 5</Text>
        </View>
        {recentCollections.length ? (
          recentCollections.map((collection, index) => (
            <PressableCard key={collection.payment_id} style={styles.listRow}>
              <View style={styles.listText}>
                <Text style={styles.listTitle}>{collection.shop_name}</Text>
                <Text style={styles.listCaption}>{formatCurrency(collection.amount)}</Text>
              </View>
              <Text style={styles.dateText}>
                {new Date(collection.payment_date).toLocaleDateString()}
              </Text>
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
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
  headerGradient: {
    borderRadius: 24,
    padding: 2,
    marginBottom: 14,
  },
  headerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 22,
    padding: 20,
    borderWidth: 0,
    gap: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    color: '#1F2937',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  headerSubtitle: {
    color: '#4B5563',
    lineHeight: 20,
    fontSize: 15,
  },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 0,
  },
  datePillText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 13,
  },
  headerStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  headerStat: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 0,
  },
  headerStatTag: {
    color: '#9CA3AF',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  headerStatValue: {
    color: colors.gradientStart,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  headerStatLabel: {
    color: '#6B7280',
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
  },
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
    borderWidth: 0,
    minHeight: 100,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  statCardBlue: {
    backgroundColor: colors.cardBlue + '15',
    borderLeftWidth: 4,
    borderLeftColor: colors.cardBlue,
  },
  statCardIndigo: {
    backgroundColor: colors.cardPurple + '15',
    borderLeftWidth: 4,
    borderLeftColor: colors.cardPurple,
  },
  statCardAmber: {
    backgroundColor: colors.cardAmber + '15',
    borderLeftWidth: 4,
    borderLeftColor: colors.cardAmber,
  },
  statCardGreen: {
    backgroundColor: colors.cardGreen + '15',
    borderLeftWidth: 4,
    borderLeftColor: colors.cardGreen,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 0,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  sectionCaption: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statusCard: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 0,
    alignItems: 'center',
    minHeight: 70,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
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
    fontSize: 13,
    fontWeight: '600',
  },
  statusValue: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 24,
    marginTop: 6,
    letterSpacing: -0.5,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 16,
    borderWidth: 0,
    minHeight: 68,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  listText: {
    flex: 1,
    marginRight: 12,
  },
  listTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  listCaption: {
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.accent + '20',
    borderWidth: 0,
    minHeight: 30,
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  statusBadgeText: {
    color: colors.accent,
    fontWeight: '700',
    textTransform: 'capitalize',
    fontSize: 13,
  },
  dateText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 16,
  },
  printTestButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  printTestButtonDisabled: {
    opacity: 0.5,
  },
  printTestButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 15,
  },
  printTestStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  printTestStatusSuccess: {
    color: colors.success,
  },
  printTestStatusError: {
    color: colors.danger,
  },
});

