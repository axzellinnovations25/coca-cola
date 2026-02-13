import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  NativeModules,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ThermalPrinterModule from 'react-native-thermal-printer';
import { apiFetch } from '../api/api';
import { ThemeColors, useThemeColors } from '../theme/colors';
import DismissKeyboard from '../components/DismissKeyboard';

interface Bill {
  id: string;
  created_at: string;
  total: number;
  collected: number;
  outstanding: number;
}

interface OrderItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total: number;
}

interface ShopWithBills {
  shop_id: string;
  shop_name: string;
  total_outstanding: number;
  bills: Bill[];
}

interface PaymentReceipt {
  payment_id: string;
  bill_id: string;
  shop_name: string;
  amount: number;
  notes: string;
  total: number;
  collected_before: number;
  outstanding_before: number;
  outstanding_after: number;
  created_at: string;
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

const isLikelyCpclPrinter = (deviceName?: string | null) => {
  const normalized = (deviceName || '').toLowerCase();
  return normalized.includes('dbl') || normalized.includes('4b-');
};

const escapeCpclText = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, "'");
const padRight = (value: string, width: number) =>
  value.length >= width ? value.slice(0, width) : `${value}${' '.repeat(width - value.length)}`;
const padLeft = (value: string, width: number) =>
  value.length >= width ? value.slice(0, width) : `${' '.repeat(width - value.length)}${value}`;
const joinLine = (left: string, right: string, width: number) => {
  const safeWidth = Math.max(20, width);
  const leftPart = left.slice(0, safeWidth);
  const rightPart = right.slice(0, safeWidth);
  const spaces = Math.max(1, safeWidth - leftPart.length - rightPart.length);
  return `${leftPart}${' '.repeat(spaces)}${rightPart}`;
};
const hasNativeBluetoothRawPrint = () =>
  typeof (NativeModules as any)?.ThermalPrinterModule?.printBluetoothRaw === 'function';
const pickDefaultPrinter = (devices: BluetoothPrinterDevice[]) => {
  if (!devices.length) return null;
  const preferred = devices.find((printer) => isLikelyCpclPrinter(printer.deviceName));
  return preferred || devices[0];
};
const CPCL_RENDER_LINE_WIDTH = 16;
const CPCL_LEFT_MARGIN = 0;
const CPCL_FONT = 0;
const CPCL_MAG_X = 2;
const CPCL_MAG_Y = 2;
const CPCL_BASE_LINE_HEIGHT = 30;
const sanitizeCpclLine = (value: string) =>
  value
    .replace(/["']/g, '')
    .replace(/~/g, '')
    .replace(/^\.+/, '')
    .replace(/[^\x20-\x7E]/g, ' ');

const parseDate = (value: string | number | null | undefined) => {
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

const formatDate = (value: string | number | null | undefined) => {
  const d = parseDate(value);
  return d ? d.toLocaleDateString() : '--';
};

export default function BillsCollectionsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [shops, setShops] = useState<ShopWithBills[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [selectedShopName, setSelectedShopName] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);
  const [smsStatus, setSmsStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });
  const [sendingSMS, setSendingSMS] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(null);
  const [showPaymentReceipt, setShowPaymentReceipt] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [showPrinterPicker, setShowPrinterPicker] = useState(false);
  const [pairedPrinters, setPairedPrinters] = useState<BluetoothPrinterDevice[]>([]);
  const [selectedPrinterMac, setSelectedPrinterMac] = useState('');
  const [printStatus, setPrintStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [returnItems, setReturnItems] = useState<OrderItem[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState('');

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch('/api/marudham/bills/representative');
      setShops(data.bills || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBills();
      AsyncStorage.getItem(PRINTER_MAC_KEY)
        .then((savedMac) => {
          if (savedMac) setSelectedPrinterMac(savedMac);
        })
        .catch(() => {});
    }, [fetchBills]),
  );

  const filteredShops = useMemo(() => {
    const q = search.toLowerCase();
    return shops
      .map((shop) => ({
        ...shop,
        bills: (shop.bills || []).filter((bill) => (bill.outstanding || 0) > 0),
      }))
      .filter((shop) => shop.shop_name.toLowerCase().includes(q))
      .filter((shop) => (shop.bills || []).length > 0);
  }, [shops, search]);

  const totalOutstanding = shops.reduce((sum, s) => sum + (s.total_outstanding || 0), 0);
  const totalCollected = shops.reduce(
    (sum, s) => (s.bills ?? []).reduce((acc, b) => acc + (b.collected || 0), sum),
    0,
  );

  const openPaymentModal = (bill: Bill, shopName: string) => {
    setSelectedBill(bill);
    setSelectedShopName(shopName);
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentError('');
    setPaymentSuccess('');
    setSmsStatus({ type: null, message: '' });
    setLastPaymentId(null);
  };

  const openReturnModal = async (bill: Bill) => {
    setReturnLoading(true);
    setReturnError('');
    setReturnOrderId(bill.id);
    try {
      const response = await apiFetch(`/api/marudham/orders/${bill.id}/details`);
      const items = response.order?.items || [];
      setReturnItems(items);
      const initialQuantities: Record<string, number> = {};
      items.forEach((item: OrderItem) => {
        initialQuantities[item.product_id] = 0;
      });
      setReturnQuantities(initialQuantities);
      setShowReturnModal(true);
    } catch (err: any) {
      setReturnError(err.message || 'Failed to load order items');
    } finally {
      setReturnLoading(false);
    }
  };

  const submitPayment = async () => {
    if (!selectedBill) return;
    setPaymentLoading(true);
    setPaymentError('');
    setPaymentSuccess('');
    setSmsStatus({ type: null, message: '' });
    try {
      const response = await apiFetch(`/api/marudham/bills/${selectedBill.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(paymentAmount), notes: paymentNotes }),
      });
      setPaymentSuccess('Payment recorded successfully.');
      setLastPaymentId(response.payment_id);
      const paymentValue = Number(paymentAmount);
      const receiptSnapshot: PaymentReceipt = {
        payment_id: response.payment_id,
        bill_id: selectedBill.id,
        shop_name: selectedShopName || 'N/A',
        amount: paymentValue,
        notes: paymentNotes,
        total: selectedBill.total,
        collected_before: selectedBill.collected,
        outstanding_before: selectedBill.outstanding,
        outstanding_after: Math.max(0, selectedBill.outstanding - paymentValue),
        created_at: new Date().toISOString(),
      };
      setPaymentReceipt(receiptSnapshot);
      setShowPaymentReceipt(true);

      if (response.sms_sent) {
        setSmsStatus({ type: 'success', message: 'SMS sent successfully.' });
      } else if (response.sms_error) {
        setSmsStatus({ type: 'error', message: `SMS failed: ${response.sms_error}` });
      } else {
        setSmsStatus({ type: 'error', message: 'SMS failed to send.' });
      }
      setSelectedBill(null);
      setPaymentAmount('');
      setPaymentNotes('');
      fetchBills();
    } catch (err: any) {
      setPaymentError(err.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const submitReturn = async () => {
    if (!returnOrderId) return;
    const itemsToReturn = Object.entries(returnQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([product_id, quantity]) => ({ product_id, quantity }));

    if (itemsToReturn.length === 0) {
      setReturnError('Select at least one item to return.');
      return;
    }

    setReturnLoading(true);
    setReturnError('');
    try {
      await apiFetch(`/api/marudham/bills/${returnOrderId}/return`, {
        method: 'POST',
        body: JSON.stringify({ items: itemsToReturn }),
      });
      setShowReturnModal(false);
      setReturnOrderId(null);
      setReturnItems([]);
      setReturnQuantities({});
      fetchBills();
    } catch (err: any) {
      setReturnError(err.message || 'Failed to record return');
    } finally {
      setReturnLoading(false);
    }
  };

  const sendPaymentSMS = async () => {
    if (!lastPaymentId) return;
    setSendingSMS(true);
    setSmsStatus({ type: null, message: '' });
    try {
      const response = await apiFetch(`/api/marudham/payments/${lastPaymentId}/send-sms`, {
        method: 'POST',
      });
      if (response.success) {
        setSmsStatus({ type: 'success', message: 'Payment SMS sent successfully.' });
      } else {
        setSmsStatus({ type: 'error', message: response.error || 'Failed to send SMS' });
      }
    } catch (err: any) {
      setSmsStatus({ type: 'error', message: err.message || 'Failed to send SMS' });
    } finally {
      setSendingSMS(false);
    }
  };

  const paymentReceiptDateInfo = useMemo(() => {
    const date = parseDate(paymentReceipt?.created_at);
    return {
      dateText: date ? date.toLocaleDateString() : '--',
      timeText: date ? date.toLocaleTimeString() : '--',
    };
  }, [paymentReceipt?.created_at]);

  const closePaymentReceipt = () => {
    setShowPaymentReceipt(false);
    setPaymentReceipt(null);
    setLastPaymentId(null);
    setSmsStatus({ type: null, message: '' });
    setPaymentSuccess('');
    setPrintStatus({ type: null, message: '' });
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
      const connectGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
      const scanGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
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
    if (!granted) throw new Error('Bluetooth permission denied.');
    const devices =
      (await withTimeout(
        ThermalPrinterModule.getBluetoothDeviceList(),
        BLUETOOTH_SCAN_TIMEOUT_MS,
        'Bluetooth scan timed out. Turn on Bluetooth, pair printer in phone settings, then try again.',
      )) || [];
    setPairedPrinters(devices);
    return devices;
  };

  const refreshPairedPrinters = async () => {
    try {
      setLoadingPrinters(true);
      const devices = await loadPairedPrinters();
      if (!devices.length) {
        setPrintStatus({
          type: 'error',
          message: 'No paired Bluetooth printer found. Pair the printer in phone Bluetooth settings first.',
        });
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load Bluetooth printers.';
      setPrintStatus({ type: 'error', message: errorMessage });
      Alert.alert('Printer', errorMessage);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const openPrinterPicker = async () => {
    setShowPrinterPicker(true);
    await refreshPairedPrinters();
  };

  const choosePrinter = async (printer: BluetoothPrinterDevice) => {
    await AsyncStorage.setItem(PRINTER_MAC_KEY, printer.macAddress);
    setSelectedPrinterMac(printer.macAddress);
    setShowPrinterPicker(false);
    setPrintStatus({
      type: 'success',
      message: `Printer selected: ${printer.deviceName || printer.macAddress}`,
    });
  };

  const resolveBluetoothMacAddress = async (devices: BluetoothPrinterDevice[]) => {
    if (!devices.length) return null;
    const selectedPrinter = selectedPrinterMac
      ? devices.find((printer) => printer.macAddress === selectedPrinterMac)
      : null;
    if (selectedPrinter?.macAddress) return selectedPrinter.macAddress;
    const savedMac = await AsyncStorage.getItem(PRINTER_MAC_KEY);
    const savedPrinter = savedMac ? devices.find((printer) => printer.macAddress === savedMac) : null;
    if (savedPrinter?.macAddress) {
      setSelectedPrinterMac(savedPrinter.macAddress);
      return savedPrinter.macAddress;
    }
    const fallbackPrinter = pickDefaultPrinter(devices);
    if (fallbackPrinter?.macAddress) {
      await AsyncStorage.setItem(PRINTER_MAC_KEY, fallbackPrinter.macAddress);
      setSelectedPrinterMac(fallbackPrinter.macAddress);
      return fallbackPrinter.macAddress;
    }
    return null;
  };

  const buildPaymentPrintableLines = (lineWidth: number) => {
    const paymentId = paymentReceipt?.payment_id ? paymentReceipt.payment_id.slice(0, 8).toUpperCase() : '--';
    const billId = paymentReceipt?.bill_id ? paymentReceipt.bill_id.slice(0, 8).toUpperCase() : '--';
    const shop = paymentReceipt?.shop_name || 'N/A';
    const totalWidth = Math.max(24, lineWidth);
    const descWidth = totalWidth >= 42 ? 28 : 20;
    const amountWidth = totalWidth - descWidth;
    const separator = '-'.repeat(totalWidth);
    const strongSeparator = '='.repeat(totalWidth);
    const lines: string[] = [
      'S.B Distribution',
      'Payment Receipt',
      strongSeparator,
      joinLine('Payment #', paymentId, totalWidth),
      joinLine('Bill #', billId, totalWidth),
      joinLine('Shop', shop, totalWidth),
      joinLine('Date', paymentReceiptDateInfo.dateText, totalWidth),
      joinLine('Time', paymentReceiptDateInfo.timeText, totalWidth),
      strongSeparator,
      'PAYMENT SUMMARY',
      separator,
      `${padRight('Description', descWidth)}${padLeft('Amount (LKR)', amountWidth)}`,
      separator,
      `${padRight('Payment Received', descWidth)}${padLeft((paymentReceipt?.amount || 0).toFixed(2), amountWidth)}`,
      `${padRight('Outstanding Before', descWidth)}${padLeft((paymentReceipt?.outstanding_before || 0).toFixed(2), amountWidth)}`,
      `${padRight('Outstanding After', descWidth)}${padLeft((paymentReceipt?.outstanding_after || 0).toFixed(2), amountWidth)}`,
      `${padRight('Bill Total', descWidth)}${padLeft((paymentReceipt?.total || 0).toFixed(2), amountWidth)}`,
      strongSeparator,
      joinLine('BALANCE DUE', (paymentReceipt?.outstanding_after || 0).toFixed(2), totalWidth),
      strongSeparator,
    ];
    if (paymentReceipt?.notes) {
      lines.push(separator);
      lines.push(`Notes: ${paymentReceipt.notes}`);
    }
    return lines;
  };

  const buildPaymentEscPosPayload = (lineWidth: number) => {
    const lines = buildPaymentPrintableLines(lineWidth);
    const escposLines = [
      '[C]<b>S.B Distribution</b>',
      '[C]Payment Receipt',
      ...lines.slice(2).map((line) => `[L]${line}`),
    ];
    return `${escposLines.join('\n')}\n`;
  };

  const buildPaymentCpclPayload = (lineWidth: number) => {
    const lines = buildPaymentPrintableLines(lineWidth);
    const startY = 24;
    const lineHeight = CPCL_BASE_LINE_HEIGHT * CPCL_MAG_Y + 8;
    const x = CPCL_LEFT_MARGIN;
    const height = Math.max(260, startY + lines.length * lineHeight + 80);
    const cpclLines = lines
      .map((line, index) => ({
        y: startY + index * lineHeight,
        text: sanitizeCpclLine(escapeCpclText(line)),
      }))
      .filter((row) => row.text.trim().length > 0)
      .map((row) => `TEXT ${CPCL_FONT} 0 ${x} ${row.y} ${row.text}`);
    return `! 0 200 200 ${height} 1\r\nSETMAG ${CPCL_MAG_X} ${CPCL_MAG_Y}\r\n${cpclLines.join('\r\n')}\r\nFORM\r\nPRINT\r\n`;
  };

  const handlePrintPaymentReceipt = async () => {
    if (printing) return;
    if (!paymentReceipt) {
      setPrintStatus({ type: 'error', message: 'No payment receipt available to print.' });
      return;
    }
    try {
      setPrinting(true);
      setPrintStatus({ type: null, message: '' });
      const devices = await loadPairedPrinters();
      if (!devices.length) {
        throw new Error('No paired Bluetooth printer found. Pair the printer in phone Bluetooth settings first.');
      }
      const macAddress = await resolveBluetoothMacAddress(devices);
      if (!macAddress) {
        setShowPrinterPicker(true);
        refreshPairedPrinters();
        setPrintStatus({
          type: 'error',
          message: 'Choose a Bluetooth printer first, then tap Print Receipt again.',
        });
        return;
      }
      const selectedDevice = devices.find((printer) => printer.macAddress === macAddress) || null;
      const printerProfile = getBluetoothPrinterProfile(selectedDevice?.deviceName);
      const useCpcl = isLikelyCpclPrinter(selectedDevice?.deviceName) && hasNativeBluetoothRawPrint();
      if (useCpcl) {
        const payload = buildPaymentCpclPayload(Math.min(CPCL_RENDER_LINE_WIDTH, printerProfile.printerNbrCharactersPerLine));
        await (ThermalPrinterModule as any).printBluetoothRaw({ macAddress, payload });
      } else {
        const payload = buildPaymentEscPosPayload(printerProfile.printerNbrCharactersPerLine);
        await ThermalPrinterModule.printBluetooth({ macAddress, payload, ...printerProfile });
      }
      setPrintStatus({
        type: 'success',
        message: `Print command sent to Bluetooth printer${selectedDevice?.deviceName ? ` (${selectedDevice.deviceName})` : ''}${useCpcl ? ' (CPCL)' : ' (ESC/POS)'}.`,
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to print payment receipt.';
      setPrintStatus({ type: 'error', message: errorMessage });
      Alert.alert('Print Failed', errorMessage);
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.centerText}>Loading bills...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Error loading bills</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={fetchBills}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <DismissKeyboard>
      <View style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Bills & Collections</Text>
        <Text style={styles.subtitle}>Track outstanding payments and collections.</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Outstanding</Text>
            <Text style={styles.summaryValue}>{totalOutstanding.toFixed(2)} LKR</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Collected</Text>
            <Text style={styles.summaryValue}>{totalCollected.toFixed(2)} LKR</Text>
          </View>
        </View>
        <TextInput
          placeholder="Search shops..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredShops}
        keyExtractor={(item, index) => `${item.shop_id}-${index}`}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.emptyText}>No bills found.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardRow}
              onPress={() => setExpandedShopId(expandedShopId === item.shop_id ? null : item.shop_id)}
            >
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{item.shop_name}</Text>
                <Text style={styles.cardSubtitle}>Outstanding: {item.total_outstanding.toFixed(2)} LKR</Text>
              </View>
              <Text style={styles.cardToggle}>{expandedShopId === item.shop_id ? 'Hide' : 'View'}</Text>
            </TouchableOpacity>

            {expandedShopId === item.shop_id && (
              <View style={styles.billList}>
                {item.bills.map((bill, billIndex) => (
                  <View key={`${bill.id}-${billIndex}`} style={styles.billRow}>
                    <View style={styles.billText}>
                      <Text style={styles.billMeta}>
                        {formatDate(bill.created_at)} · {bill.total.toFixed(2)} LKR
                      </Text>
                      <Text style={styles.billMeta}>
                        Outstanding: {bill.outstanding.toFixed(2)} LKR
                      </Text>
                    </View>
                    <View style={styles.billActions}>
                      {bill.outstanding > 0 && (
                        <TouchableOpacity style={styles.billButton} onPress={() => openPaymentModal(bill, item.shop_name)}>
                          <Text style={styles.billButtonText}>Record</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.returnButton} onPress={() => openReturnModal(bill)}>
                        <Text style={styles.returnButtonText}>Return</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      />

      <Modal visible={!!selectedBill} transparent animationType="slide" onRequestClose={() => setSelectedBill(null)}>
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Record Payment</Text>
            <Text style={styles.modalLabel}>Bill ID</Text>
            <Text style={styles.modalValue}>{selectedBill?.id.slice(0, 8)}...</Text>
            <Text style={styles.modalLabel}>Outstanding</Text>
            <Text style={styles.modalValue}>
              {selectedBill ? selectedBill.outstanding.toFixed(2) : '0.00'} LKR
            </Text>
            <TextInput
              placeholder="Amount"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
            />
            <TextInput
              placeholder="Notes (optional)"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.notesInput]}
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              multiline
            />
            {paymentError ? <Text style={styles.errorText}>{paymentError}</Text> : null}
            {paymentSuccess ? <Text style={styles.successText}>{paymentSuccess}</Text> : null}
            {smsStatus.type ? (
              <Text style={smsStatus.type === 'success' ? styles.successText : styles.errorText}>
                {smsStatus.message}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.actionSecondary} onPress={() => setSelectedBill(null)}>
                <Text style={styles.actionText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionPrimary}
                onPress={submitPayment}
                disabled={paymentLoading}
              >
                <Text style={styles.actionTextOnAccent}>
                  {paymentLoading ? 'Recording...' : 'Record Payment'}
                </Text>
              </TouchableOpacity>
              {lastPaymentId && smsStatus.type === 'error' && (
                <TouchableOpacity
                  style={styles.actionSecondary}
                  onPress={sendPaymentSMS}
                  disabled={sendingSMS}
                >
                  <Text style={styles.actionText}>{sendingSMS ? 'Sending...' : 'Send SMS'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPaymentReceipt}
        transparent
        animationType="slide"
        onRequestClose={closePaymentReceipt}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.receiptCard}>
            <ScrollView style={styles.receiptScroll} contentContainerStyle={styles.receiptScrollContent}>
              <View style={styles.receiptHeader}>
                <Text style={styles.receiptCompany}>S.B Distribution</Text>
                <Text style={styles.receiptDocTitle}>Payment Receipt</Text>
                <View style={styles.receiptBadge}>
                  <Text style={styles.receiptBadgeText}>Recorded</Text>
                </View>
              </View>

              <View style={styles.receiptSection}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Payment #</Text>
                  <Text style={styles.receiptValue}>
                    {paymentReceipt?.payment_id ? paymentReceipt.payment_id.slice(0, 8).toUpperCase() : '--'}
                  </Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Bill #</Text>
                  <Text style={styles.receiptValue}>
                    {paymentReceipt?.bill_id ? paymentReceipt.bill_id.slice(0, 8).toUpperCase() : '--'}
                  </Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Shop</Text>
                  <Text style={styles.receiptValue}>{paymentReceipt?.shop_name || 'N/A'}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Date</Text>
                  <Text style={styles.receiptValue}>{paymentReceiptDateInfo.dateText}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Time</Text>
                  <Text style={styles.receiptValue}>{paymentReceiptDateInfo.timeText}</Text>
                </View>
              </View>

              <View style={styles.receiptTable}>
                <View style={styles.receiptTableHeader}>
                  <Text style={[styles.receiptCell, styles.receiptCellItem, styles.receiptTableHeaderText]}>
                    Description
                  </Text>
                  <Text style={[styles.receiptCell, styles.receiptCellTotal, styles.receiptTableHeaderText]}>
                    Amount (LKR)
                  </Text>
                </View>
                <View style={styles.receiptTableRow}>
                  <Text style={[styles.receiptCell, styles.receiptCellItem]}>Payment Received</Text>
                  <Text style={[styles.receiptCell, styles.receiptCellTotal]}>
                    {paymentReceipt ? paymentReceipt.amount.toFixed(2) : '0.00'}
                  </Text>
                </View>
                <View style={styles.receiptTableRow}>
                  <Text style={[styles.receiptCell, styles.receiptCellItem]}>Outstanding Before</Text>
                  <Text style={[styles.receiptCell, styles.receiptCellTotal]}>
                    {paymentReceipt ? paymentReceipt.outstanding_before.toFixed(2) : '0.00'}
                  </Text>
                </View>
                <View style={styles.receiptTableRow}>
                  <Text style={[styles.receiptCell, styles.receiptCellItem]}>Outstanding After</Text>
                  <Text style={[styles.receiptCell, styles.receiptCellTotal]}>
                    {paymentReceipt ? paymentReceipt.outstanding_after.toFixed(2) : '0.00'}
                  </Text>
                </View>
                <View style={styles.receiptTableRow}>
                  <Text style={[styles.receiptCell, styles.receiptCellItem]}>Bill Total</Text>
                  <Text style={[styles.receiptCell, styles.receiptCellTotal]}>
                    {paymentReceipt ? paymentReceipt.total.toFixed(2) : '0.00'}
                  </Text>
                </View>
              </View>

              {paymentReceipt?.notes ? (
                <View style={styles.receiptNotes}>
                  <Text style={styles.receiptNotesLabel}>Notes</Text>
                  <Text style={styles.receiptNotesValue}>{paymentReceipt.notes}</Text>
                </View>
              ) : null}

              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptTotalLabel}>Balance Due</Text>
                <Text style={styles.receiptTotalValue}>
                  {paymentReceipt ? paymentReceipt.outstanding_after.toFixed(2) : '0.00'}
                </Text>
              </View>

              <View style={styles.receiptSignature}>
                <View style={styles.receiptSignatureBlock}>
                  <View style={styles.receiptSignatureLine} />
                  <Text style={styles.receiptSignatureLabel}>Prepared By</Text>
                </View>
                <View style={styles.receiptSignatureBlock}>
                  <View style={styles.receiptSignatureLine} />
                  <Text style={styles.receiptSignatureLabel}>Customer Signature</Text>
                </View>
              </View>

              <View style={styles.receiptFooter}>
                <Text style={styles.receiptFooterText}>Thank you for your business.</Text>
                <Text style={styles.receiptFooterText}>Printed on: {new Date().toLocaleString()}</Text>
              </View>

              {smsStatus.type ? (
                <Text style={smsStatus.type === 'success' ? styles.successText : styles.errorText}>
                  {smsStatus.message}
                </Text>
              ) : null}
              {printStatus.type ? (
                <Text style={printStatus.type === 'success' ? styles.successText : styles.errorText}>
                  {printStatus.message}
                </Text>
              ) : null}
              <Text style={styles.modalLabel}>Printer: {selectedPrinterMac || 'Not selected'}</Text>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.actionSecondary} onPress={closePaymentReceipt}>
                  <Text style={styles.actionText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionSecondary, printing && styles.actionDisabled]}
                  onPress={openPrinterPicker}
                  disabled={printing}
                >
                  <Text style={styles.actionText}>Choose Printer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionPrimary, (printing || loadingPrinters) && styles.actionDisabled]}
                  onPress={handlePrintPaymentReceipt}
                  disabled={printing || loadingPrinters}
                >
                  <Text style={styles.actionTextOnAccent}>{printing ? 'Printing...' : 'Print Receipt'}</Text>
                </TouchableOpacity>
                {lastPaymentId && smsStatus.type === 'error' && (
                  <TouchableOpacity
                    style={styles.actionPrimary}
                    onPress={sendPaymentSMS}
                    disabled={sendingSMS}
                  >
                    <Text style={styles.actionTextOnAccent}>
                      {sendingSMS ? 'Sending...' : 'Send SMS'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPrinterPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPrinterPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Bluetooth Printer</Text>
            {loadingPrinters ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.centerText}>Loading paired printers...</Text>
              </View>
            ) : pairedPrinters.length > 0 ? (
              <FlatList
                data={pairedPrinters}
                keyExtractor={(item) => item.macAddress}
                style={styles.returnList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.returnRow,
                      item.macAddress === selectedPrinterMac && styles.selectedPrinterItem,
                    ]}
                    onPress={() => choosePrinter(item)}
                  >
                    <View style={styles.returnText}>
                      <Text style={styles.returnTitle}>{item.deviceName || 'Bluetooth Printer'}</Text>
                      <Text style={styles.returnMeta}>{item.macAddress}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <Text style={styles.emptyText}>No paired Bluetooth printers found.</Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionSecondary, loadingPrinters && styles.actionDisabled]}
                onPress={refreshPairedPrinters}
                disabled={loadingPrinters}
              >
                <Text style={styles.actionText}>{loadingPrinters ? 'Refreshing...' : 'Refresh Printers'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionSecondary} onPress={() => setShowPrinterPicker(false)}>
                <Text style={styles.actionText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showReturnModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReturnModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Return Products</Text>
            {returnError ? <Text style={styles.errorText}>{returnError}</Text> : null}
            <View style={styles.returnList}>
              {returnItems.map((item) => (
                <View key={item.product_id} style={styles.returnRow}>
                  <View style={styles.returnText}>
                    <Text style={styles.returnTitle}>{item.name}</Text>
                    <Text style={styles.returnMeta}>Ordered: {item.quantity}</Text>
                  </View>
                  <TextInput
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={styles.returnInput}
                    keyboardType="numeric"
                    value={String(returnQuantities[item.product_id] ?? 0)}
                    onChangeText={(value) => {
                      const qty = Number(value || 0);
                      setReturnQuantities((prev) => ({ ...prev, [item.product_id]: qty }));
                    }}
                  />
                </View>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.actionSecondary} onPress={() => setShowReturnModal(false)}>
                <Text style={styles.actionText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionPrimary} onPress={submitReturn} disabled={returnLoading}>
                <Text style={styles.actionTextOnAccent}>{returnLoading ? 'Saving...' : 'Record Return'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    color: colors.danger,
    marginTop: 6,
  },
  successText: {
    color: colors.success,
    marginTop: 6,
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
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  summaryLabel: {
    color: colors.textSubtle,
    fontSize: 12,
  },
  summaryValue: {
    color: colors.text,
    fontWeight: '700',
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
    alignItems: 'center',
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
    marginTop: 4,
  },
  cardToggle: {
    color: colors.accent,
    fontWeight: '700',
  },
  billList: {
    gap: 10,
  },
  billRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  billText: {
    flex: 1,
  },
  billActions: {
    gap: 8,
  },
  billTitle: {
    color: colors.text,
    fontWeight: '600',
  },
  billMeta: {
    color: colors.textMuted,
    marginTop: 2,
  },
  billButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  billButtonText: {
    color: colors.accent,
    fontWeight: '700',
  },
  returnButton: {
    backgroundColor: colors.warningSurface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  returnButtonText: {
    color: colors.warning,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 19, 40, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  receiptCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '92%',
  },
  receiptScroll: {
    flexGrow: 0,
  },
  receiptScrollContent: {
    gap: 12,
    paddingBottom: 6,
  },
  receiptHeader: {
    alignItems: 'center',
    gap: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  receiptCompany: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  receiptDocTitle: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  receiptBadge: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.text,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  receiptBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  receiptSection: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  receiptLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  receiptValue: {
    color: colors.text,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  receiptTable: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    overflow: 'hidden',
  },
  receiptTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  receiptTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  receiptCell: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11,
    color: colors.text,
  },
  receiptCellItem: {
    flex: 7,
  },
  receiptCellTotal: {
    flex: 3,
    textAlign: 'right',
  },
  receiptTableHeaderText: {
    fontWeight: '700',
    color: colors.text,
  },
  receiptNotes: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  receiptNotesLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  receiptNotesValue: {
    color: colors.text,
    fontWeight: '600',
  },
  receiptTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptTotalLabel: {
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 12,
  },
  receiptTotalValue: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  receiptSignature: {
    marginTop: 8,
    gap: 10,
  },
  receiptSignatureBlock: {
    gap: 4,
  },
  receiptSignatureLine: {
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
  },
  receiptSignatureLabel: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 11,
  },
  receiptFooter: {
    marginTop: 8,
    alignItems: 'center',
    gap: 4,
  },
  receiptFooterText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  modalValue: {
    color: colors.text,
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalActions: {
    gap: 8,
    marginTop: 6,
  },
  returnList: {
    gap: 10,
    marginTop: 4,
  },
  returnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  returnText: {
    flex: 1,
  },
  returnTitle: {
    color: colors.text,
    fontWeight: '600',
  },
  returnMeta: {
    color: colors.textMuted,
    marginTop: 2,
  },
  returnInput: {
    width: 70,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
  },
  actionPrimary: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionSecondary: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  actionText: {
    color: colors.text,
    fontWeight: '700',
  },
  actionTextOnAccent: {
    color: colors.background,
    fontWeight: '700',
  },
  actionDisabled: {
    opacity: 0.5,
  },
  selectedPrinterItem: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceAlt,
  },
});
