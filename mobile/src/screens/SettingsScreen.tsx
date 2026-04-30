import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import ThermalPrinterModule from 'react-native-thermal-printer';
import { useAuth } from '../context/AuthContext';
import { ThemeColors, useThemeColors } from '../theme/colors';

const PRINTER_MAC_KEY = 'bluetooth_receipt_printer_mac';
const BLUETOOTH_SCAN_TIMEOUT_MS = 12000;
const PRIVACY_POLICY_URL = 'https://sbdistribution.store/privacy-policy/';

interface BluetoothPrinterDevice {
  deviceName: string;
  macAddress: string;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  danger,
  loading,
}: {
  icon: IoniconName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tintColor = danger ? colors.danger : colors.accent;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress || loading}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: tintColor + '18' }]}>
        {loading ? (
          <ActivityIndicator size="small" color={tintColor} />
        ) : (
          <Ionicons name={icon} size={20} color={tintColor} />
        )}
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {onPress && !loading && (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, logout } = useAuth();

  const [printers, setPrinters] = useState<BluetoothPrinterDevice[]>([]);
  const [selectedMac, setSelectedMac] = useState('');
  const [scanning, setScanning] = useState(false);
  const [showPrinterList, setShowPrinterList] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const repName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.email || 'Unknown';

  const requestBluetoothPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      ]);
      return (
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    if (Platform.Version >= 23) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const handleScanPrinters = async () => {
    if (
      !ThermalPrinterModule ||
      typeof ThermalPrinterModule.getBluetoothDeviceList !== 'function'
    ) {
      Alert.alert('Unavailable', 'Bluetooth printer module requires an Android EAS build.');
      return;
    }
    try {
      setScanning(true);
      setShowPrinterList(false);
      const granted = await requestBluetoothPermissions();
      if (!granted) {
        Alert.alert('Permission denied', 'Bluetooth permission is required to scan for printers.');
        return;
      }
      const saved = await AsyncStorage.getItem(PRINTER_MAC_KEY);
      if (saved) setSelectedMac(saved);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Bluetooth scan timed out.')), BLUETOOTH_SCAN_TIMEOUT_MS),
      );
      const devices = (await Promise.race([ThermalPrinterModule.getBluetoothDeviceList(), timeout])) as BluetoothPrinterDevice[];
      setPrinters(devices || []);
      setShowPrinterList(true);
      if (!devices?.length) {
        Alert.alert('No printers found', 'Pair the printer in your phone Bluetooth settings first.');
      }
    } catch (err: any) {
      Alert.alert('Scan failed', err?.message || 'Could not scan for Bluetooth printers.');
    } finally {
      setScanning(false);
    }
  };

  const handleSelectPrinter = async (printer: BluetoothPrinterDevice) => {
    await AsyncStorage.setItem(PRINTER_MAC_KEY, printer.macAddress);
    setSelectedMac(printer.macAddress);
    Alert.alert('Printer selected', `${printer.deviceName || printer.macAddress} is now your active printer.`);
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setLogoutLoading(true);
          try {
            await logout();
          } finally {
            setLogoutLoading(false);
          }
        },
      },
    ]);
  };

  const openPrivacyPolicy = async () => {
    const supported = await Linking.canOpenURL(PRIVACY_POLICY_URL);
    if (!supported) {
      Alert.alert('Unable to open link', 'Please visit the privacy policy from your browser.');
      return;
    }
    await Linking.openURL(PRIVACY_POLICY_URL);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Account Section */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.card}>
        <View style={styles.accountHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.accent + '22' }]}>
            <Ionicons name="person" size={28} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountName}>{repName}</Text>
            <Text style={styles.accountEmail}>{user?.email || ''}</Text>
            {user?.role ? (
              <View style={[styles.roleBadge, { backgroundColor: colors.accent + '18' }]}>
                <Text style={[styles.roleText, { color: colors.accent }]}>{user.role}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Printer Section */}
      <Text style={styles.sectionTitle}>Printer</Text>
      <View style={styles.card}>
        <SettingsRow
          icon="bluetooth"
          label="Scan for Bluetooth Printers"
          value={scanning ? 'Scanning...' : undefined}
          onPress={handleScanPrinters}
          loading={scanning}
        />
        {showPrinterList && printers.length > 0 && (
          <View style={styles.printerList}>
            <Text style={styles.printerListTitle}>Available printers</Text>
            {printers.map((printer) => (
              <TouchableOpacity
                key={printer.macAddress}
                style={[
                  styles.printerRow,
                  printer.macAddress === selectedMac && { borderColor: colors.success, borderWidth: 1.5 },
                ]}
                onPress={() => handleSelectPrinter(printer)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.printerName}>{printer.deviceName || 'Bluetooth Printer'}</Text>
                  <Text style={styles.printerMac}>{printer.macAddress}</Text>
                </View>
                {printer.macAddress === selectedMac ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                ) : (
                  <Ionicons name="radio-button-off" size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
        {selectedMac ? (
          <View style={styles.activePrinterRow}>
            <Ionicons name="print" size={14} color={colors.success} />
            <Text style={styles.activePrinterText}>Active: {selectedMac}</Text>
          </View>
        ) : null}
      </View>

      {/* App Info Section */}
      <Text style={styles.sectionTitle}>App</Text>
      <View style={styles.card}>
        <SettingsRow icon="information-circle" label="App Name" value="MotionRep" />
        <View style={styles.divider} />
        <SettingsRow icon="code-slash" label="Version" value="1.0.0" />
        <View style={styles.divider} />
        <SettingsRow icon="server" label="Platform" value={Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Web'} />
        <View style={styles.divider} />
        <SettingsRow icon="shield-checkmark" label="Privacy Policy" onPress={openPrivacyPolicy} />
      </View>

      {/* Logout */}
      <Text style={styles.sectionTitle}>Session</Text>
      <View style={styles.card}>
        <SettingsRow
          icon="log-out"
          label="Log Out"
          onPress={handleLogout}
          danger
          loading={logoutLoading}
        />
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      padding: 16,
      gap: 6,
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 16,
      marginBottom: 6,
      marginLeft: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    accountHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 14,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountName: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
    },
    accountEmail: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    roleBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      marginTop: 6,
    },
    roleText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowContent: {
      flex: 1,
    },
    rowLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    rowValue: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 1,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 64,
    },
    printerList: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 8,
    },
    printerListTitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 4,
    },
    printerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    printerName: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 14,
    },
    printerMac: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    activePrinterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    activePrinterText: {
      color: colors.success,
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
  });
