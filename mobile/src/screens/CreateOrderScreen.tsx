import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  NativeModules,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ThermalPrinterModule from 'react-native-thermal-printer';
import { apiFetch } from '../api/api';
import { ThemeColors, useThemeColors } from '../theme/colors';
import DismissKeyboard from '../components/DismissKeyboard';

interface Shop {
  id: string;
  name: string;
  address: string;
  phone: string;
  max_bill_amount: number;
  max_active_bills: number;
  current_outstanding: number;
  active_bills: number;
}

interface Product {
  id: string;
  name: string;
  unit_price: number;
}

interface OrderItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  free_quantity: number;
}

interface BluetoothPrinterDevice {
  deviceName: string;
  macAddress: string;
}

const formatCurrency = (value: number | string | null | undefined) =>
  Number(value || 0).toFixed(2);
const PRINTER_MAC_KEY = 'bluetooth_receipt_printer_mac';
const RECEIPT_LINE_WIDTH = 32;
const BLUETOOTH_SCAN_TIMEOUT_MS = 12000;
const DEFAULT_BLUETOOTH_PRINTER_PROFILE = {
  printerDpi: 203,
  printerWidthMM: 72,
  printerNbrCharactersPerLine: 42,
  autoCut: false,
  openCashbox: false,
  mmFeedPaper: 20,
} as const;
const DBL_BLUETOOTH_PRINTER_PROFILE = {
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
  if (normalized.includes('dbl')) {
    return DBL_BLUETOOTH_PRINTER_PROFILE;
  }
  return DEFAULT_BLUETOOTH_PRINTER_PROFILE;
};

const isLikelyCpclPrinter = (deviceName?: string | null) => {
  const normalized = (deviceName || '').toLowerCase();
  return normalized.includes('dbl') || normalized.includes('4b-');
};

const escapeCpclText = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, "'");

const joinLine = (left: string, right: string, width: number) => {
  const safeWidth = Math.max(20, width);
  const leftPart = left.slice(0, safeWidth);
  const rightPart = right.slice(0, safeWidth);
  const spaces = Math.max(1, safeWidth - leftPart.length - rightPart.length);
  return `${leftPart}${' '.repeat(spaces)}${rightPart}`;
};
const padRight = (value: string, width: number) =>
  value.length >= width ? value.slice(0, width) : `${value}${' '.repeat(width - value.length)}`;
const padLeft = (value: string, width: number) =>
  value.length >= width ? value.slice(0, width) : `${' '.repeat(width - value.length)}${value}`;

const hasNativeBluetoothRawPrint = () =>
  typeof (NativeModules as any)?.ThermalPrinterModule?.printBluetoothRaw === 'function';
const RECEIPT_COMPANY_NAME = 'S.B Distribution';
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

export default function CreateOrderScreen() {
  const navigation = useNavigation();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [shopSearch, setShopSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showShopPicker, setShowShopPicker] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPrinterPicker, setShowPrinterPicker] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [pairedPrinters, setPairedPrinters] = useState<BluetoothPrinterDevice[]>([]);
  const [selectedPrinterMac, setSelectedPrinterMac] = useState('');
  const [messageStatus, setMessageStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  const receiptTotal = useMemo(() => {
    if (!receipt?.items) return 0;
    return receipt.items.reduce(
      (sum: number, item: any) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
      0,
    );
  }, [receipt]);
  const receiptDateInfo = useMemo(() => {
    const date = parseDate(receipt?.created_at);
    return {
      dateText: date ? date.toLocaleDateString() : '--',
      timeText: date ? date.toLocaleTimeString() : '--',
    };
  }, [receipt?.created_at]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [shopData, productData] = await Promise.all([
        apiFetch('/api/marudham/shops/assigned'),
        apiFetch('/api/marudham/order-products'),
      ]);
      setShops(shopData.shops || []);
      setProducts(productData.products || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
      AsyncStorage.getItem(PRINTER_MAC_KEY)
        .then((savedMac) => {
          if (savedMac) {
            setSelectedPrinterMac(savedMac);
          }
        })
        .catch(() => {});
    }, [fetchData]),
  );

  const filteredShops = useMemo(() => {
    const q = shopSearch.toLowerCase();
    return shops.filter(
      (shop) =>
        shop.name.toLowerCase().includes(q) ||
        shop.address.toLowerCase().includes(q) ||
        shop.phone.toLowerCase().includes(q),
    );
  }, [shops, shopSearch]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return products.filter((product) => product.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  const addItem = () => {
    if (!selectedProduct) return;
    const qty = Math.max(1, Number(quantity));
    setOrderItems((items) => {
      const existing = items.find((i) => i.product_id === selectedProduct.id);
      if (existing) {
        return items.map((i) =>
          i.product_id === selectedProduct.id ? { ...i, quantity: i.quantity + qty } : i,
        );
      }
      return [
        ...items,
        {
          product_id: selectedProduct.id,
          name: selectedProduct.name,
          unit_price: Number(selectedProduct.unit_price) || 0,
          quantity: qty,
          free_quantity: 0,
        },
      ];
    });
    setSelectedProduct(null);
    setProductSearch('');
    setQuantity('1');
  };

  const updateQuantity = (productId: string, delta: number) => {
    setOrderItems((items) =>
      items.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item,
      ),
    );
  };

  const updateFreeQuantity = (productId: string, delta: number) => {
    setOrderItems((items) =>
      items.map((item) =>
        item.product_id === productId
          ? { ...item, free_quantity: Math.max(0, item.free_quantity + delta) }
          : item,
      ),
    );
  };

  const removeItem = (productId: string) => {
    setOrderItems((items) => items.filter((item) => item.product_id !== productId));
  };

  const orderTotal = orderItems.reduce(
    (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
    0,
  );

  const handleSubmitOrder = async () => {
    if (!selectedShop || orderItems.length === 0) return;
    setSubmitting(true);
    setError('');
    setMessageStatus({ type: null, message: '' });
    try {
      const response = await apiFetch('/api/marudham/orders', {
        method: 'POST',
        body: JSON.stringify({
          shop_id: selectedShop.id,
          items: orderItems.flatMap((item) => [
            {
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: Number(item.unit_price || 0),
            },
            ...(item.free_quantity > 0
              ? [
                  {
                    product_id: item.product_id,
                    quantity: item.free_quantity,
                    unit_price: 0,
                  },
                ]
              : []),
          ]),
        }),
      });
      const createdOrder = {
        ...response.order,
        shop: selectedShop,
        items: orderItems,
        created_at: response.order?.created_at || new Date().toISOString(),
      };
      setReceipt(createdOrder);
      setShowReceipt(true);
      setOrderItems([]);
      setSelectedShop(null);
      setShopSearch('');
      if (selectedShop.phone) {
        sendSMS(response.order.id);
      } else {
        setMessageStatus({ type: 'error', message: 'SMS not sent (no phone on record).' });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  const sendSMS = async (orderId: string) => {
    setSendingSMS(true);
    setMessageStatus({ type: null, message: '' });
    try {
      const response = await apiFetch(`/api/marudham/orders/${orderId}/send-sms`, {
        method: 'POST',
      });
      if (response.success) {
        setMessageStatus({ type: 'success', message: 'SMS sent successfully.' });
      } else {
        setMessageStatus({ type: 'error', message: response.error || 'Failed to send SMS' });
      }
    } catch (err: any) {
      setMessageStatus({ type: 'error', message: err.message || 'Failed to send SMS' });
    } finally {
      setSendingSMS(false);
    }
  };

  const trimCell = (value: string, maxLen: number) => {
    if (value.length <= maxLen) return value;
    return value.slice(0, Math.max(0, maxLen));
  };

  const buildPrintableReceiptLines = (lineWidth: number = RECEIPT_LINE_WIDTH) => {
    const shopName = receipt?.shop?.name || 'N/A';
    const shopPhone = receipt?.shop?.phone || '';
    const itemCount = (receipt?.items || []).length;

    const totalWidth = Math.max(24, lineWidth);
    const itemWidth = totalWidth >= 42 ? 20 : 14;
    const qtyWidth = 4;
    const unitWidth = 6;
    const totalWidthCol = totalWidth - itemWidth - qtyWidth - unitWidth;
    const separator = '-'.repeat(totalWidth);
    const strongSeparator = '='.repeat(totalWidth);

    const lines: string[] = [
      RECEIPT_COMPANY_NAME,
      'Sales Order Receipt',
      strongSeparator,
      joinLine('Shop', shopName, totalWidth),
    ];
    if (shopPhone) lines.push(joinLine('Phone', shopPhone, totalWidth));
    lines.push(joinLine('Date', receiptDateInfo.dateText, totalWidth));
    lines.push(joinLine('Time', receiptDateInfo.timeText, totalWidth));
    lines.push(joinLine('Items', String(itemCount), totalWidth));
    lines.push(strongSeparator);
    lines.push('ITEM DETAILS');
    lines.push(separator);
    if (totalWidth >= 32) {
      lines.push(
        `${padRight('Item', itemWidth)}${padLeft('Qty', qtyWidth)}${padLeft('Unit', unitWidth)}${padLeft('Total', totalWidthCol)}`,
      );
      lines.push(separator);
    } else {
      lines.push(joinLine('Item', 'Total', totalWidth));
      lines.push(separator);
    }
    (receipt?.items || []).forEach((item: any, index: number) => {
      const qty = Number(item.quantity || 0);
      const freeQty = Number(item.free_quantity || 0);
      const unit = Number(item.unit_price || 0);
      const total = (unit * qty).toFixed(2);
      const itemName = `${index + 1}. ${item.name || 'Item'}${freeQty > 0 ? ` (+${freeQty}F)` : ''}`;
      if (totalWidth >= 32) {
        lines.push(
          `${padRight(trimCell(itemName, itemWidth), itemWidth)}${padLeft(String(qty), qtyWidth)}${padLeft(unit.toFixed(2), unitWidth)}${padLeft(total, totalWidthCol)}`,
        );
        if (freeQty > 0) {
          lines.push(joinLine('  Free Qty', String(freeQty), totalWidth));
        }
      } else {
        lines.push(trimCell(itemName, totalWidth));
        lines.push(joinLine(`${qty} x ${unit.toFixed(2)}`, total, totalWidth));
        if (freeQty > 0) {
          lines.push(joinLine('Free Qty', String(freeQty), totalWidth));
        }
      }
    });
    lines.push(strongSeparator);
    lines.push(joinLine('TOTAL AMOUNT (LKR)', receiptTotal.toFixed(2), totalWidth));
    lines.push(strongSeparator);
    lines.push('');
    return lines;
  };

  const buildReceiptPayload = (lineWidth: number = RECEIPT_LINE_WIDTH) => {
    const lines = buildPrintableReceiptLines(lineWidth);
    const escposLines = [
      `[C]<b>${RECEIPT_COMPANY_NAME}</b>`,
      '[C]Sales Order Receipt',
      ...lines.slice(2).map((line) => `[L]${line}`),
    ];
    return `${escposLines.join('\n')}\n`;
  };

  const buildCpclReceiptPayload = (lineWidth: number = RECEIPT_LINE_WIDTH) => {
    const lines = buildPrintableReceiptLines(lineWidth);

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
    if (!granted) {
      throw new Error('Bluetooth permission denied.');
    }
    const devices =
      (await withTimeout(
        ThermalPrinterModule.getBluetoothDeviceList(),
        BLUETOOTH_SCAN_TIMEOUT_MS,
        'Bluetooth scan timed out. Turn on Bluetooth, pair printer in phone settings, then try again.',
      )) || [];
    setPairedPrinters(devices);
    return devices;
  };

  const openPrinterPicker = async () => {
    setShowPrinterPicker(true);
    await refreshPairedPrinters();
  };

  const refreshPairedPrinters = async () => {
    try {
      setLoadingPrinters(true);
      const devices = await loadPairedPrinters();
      if (!devices.length) {
        setMessageStatus({
          type: 'error',
          message: 'No paired Bluetooth printer found. Pair the printer in phone Bluetooth settings first.',
        });
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load Bluetooth printers.';
      setMessageStatus({ type: 'error', message: errorMessage });
      Alert.alert('Printer', errorMessage);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const choosePrinter = async (printer: BluetoothPrinterDevice) => {
    await AsyncStorage.setItem(PRINTER_MAC_KEY, printer.macAddress);
    setSelectedPrinterMac(printer.macAddress);
    setShowPrinterPicker(false);
    setMessageStatus({
      type: 'success',
      message: `Printer selected: ${printer.deviceName || printer.macAddress}`,
    });
  };

  const resolveBluetoothMacAddress = async (devices: BluetoothPrinterDevice[]) => {
    if (!devices.length) return null;
    const selectedPrinter = selectedPrinterMac
      ? devices.find((printer) => printer.macAddress === selectedPrinterMac)
      : null;
    if (selectedPrinter?.macAddress) {
      return selectedPrinter.macAddress;
    }
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

  const handlePrintReceipt = async () => {
    if (printing) return;
    if (!receipt) {
      setMessageStatus({ type: 'error', message: 'No receipt available to print.' });
      return;
    }
    try {
      setPrinting(true);
      setMessageStatus({ type: null, message: '' });
      const devices = await loadPairedPrinters();
      if (!devices.length) {
        throw new Error('No paired Bluetooth printer found. Pair the printer in phone Bluetooth settings first.');
      }
      const macAddress = await resolveBluetoothMacAddress(devices);
      if (!macAddress) {
        setShowPrinterPicker(true);
        refreshPairedPrinters();
        setMessageStatus({
          type: 'error',
          message: 'Choose a Bluetooth printer first, then tap Print Receipt again.',
        });
        return;
      }
      const selectedDevice = devices.find((printer) => printer.macAddress === macAddress) || null;
      const printerProfile = getBluetoothPrinterProfile(selectedDevice?.deviceName);
      const useCpcl = isLikelyCpclPrinter(selectedDevice?.deviceName) && hasNativeBluetoothRawPrint();
      if (useCpcl) {
        const cpclPayload = buildCpclReceiptPayload(Math.min(CPCL_RENDER_LINE_WIDTH, printerProfile.printerNbrCharactersPerLine));
        await (ThermalPrinterModule as any).printBluetoothRaw({
          macAddress,
          payload: cpclPayload,
        });
      } else {
        const payload = buildReceiptPayload(printerProfile.printerNbrCharactersPerLine);
        await ThermalPrinterModule.printBluetooth({
          macAddress,
          payload,
          ...printerProfile,
        });
      }
      setMessageStatus({
        type: 'success',
        message: `Print command sent to Bluetooth printer${selectedDevice?.deviceName ? ` (${selectedDevice.deviceName})` : ''}${useCpcl ? ' (CPCL)' : ' (ESC/POS)'}.`,
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to print receipt.';
      setMessageStatus({ type: 'error', message: errorMessage });
      Alert.alert('Print Failed', errorMessage);
    } finally {
      setPrinting(false);
    }
  };


  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.centerText}>Loading order setup...</Text>
      </View>
    );
  }

  return (
    <DismissKeyboard>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: bottomTabBarHeight + 16 }]}
        scrollIndicatorInsets={{ bottom: bottomTabBarHeight }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>Create Order</Text>
        <Text style={styles.subtitle}>Build a new order for your assigned shops.</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Select Shop</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowShopPicker(true)}>
            <Text style={selectedShop ? styles.selectedText : styles.placeholderText}>
              {selectedShop ? selectedShop.name : 'Select shop'}
            </Text>
          </TouchableOpacity>
          {selectedShop && (
            <View style={styles.shopSummary}>
              <Text style={styles.shopName}>{selectedShop.name}</Text>
              <Text style={styles.shopMeta}>{selectedShop.address}</Text>
              <Text style={styles.shopMeta}>{selectedShop.phone}</Text>
              <Text style={styles.shopMeta}>
                Outstanding: {Number(selectedShop.current_outstanding).toFixed(2)} LKR
              </Text>
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Add Products</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowProductPicker(true)}>
            <Text style={selectedProduct ? styles.selectedText : styles.placeholderText}>
              {selectedProduct ? selectedProduct.name : 'Select product'}
            </Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <TextInput
              placeholder="Qty"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.qtyInput]}
              keyboardType="numeric"
              value={quantity}
              onChangeText={setQuantity}
            />
            <TouchableOpacity
              style={[styles.button, !selectedProduct && styles.buttonDisabled]}
              onPress={addItem}
              disabled={!selectedProduct}
            >
              <Text style={styles.buttonText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {orderItems.length > 0 ? (
            <FlatList
              data={orderItems}
              keyExtractor={(item) => item.product_id}
              scrollEnabled={false}
              contentContainerStyle={styles.itemsList}
              renderItem={({ item }) => (
                <View style={styles.itemCard}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>{formatCurrency(item.unit_price)} LKR</Text>
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity style={styles.qtyButton} onPress={() => updateQuantity(item.product_id, -1)}>
                      <Text style={styles.qtyButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.qtyButton} onPress={() => updateQuantity(item.product_id, 1)}>
                      <Text style={styles.qtyButtonText}>+</Text>
                    </TouchableOpacity>
                    <View style={styles.freeBadge}>
                      <Text style={styles.freeLabel}>Free</Text>
                      <TouchableOpacity
                        style={styles.freeButton}
                        onPress={() => updateFreeQuantity(item.product_id, -1)}
                      >
                        <Text style={styles.freeButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.freeValue}>{item.free_quantity}</Text>
                      <TouchableOpacity
                        style={styles.freeButton}
                        onPress={() => updateFreeQuantity(item.product_id, 1)}
                      >
                        <Text style={styles.freeButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.removeButton} onPress={() => removeItem(item.product_id)}>
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          ) : (
            <Text style={styles.emptyText}>No items added yet.</Text>
          )}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Order Total</Text>
          <Text style={styles.summaryValue}>{formatCurrency(orderTotal)} LKR</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (!selectedShop || orderItems.length === 0) && styles.buttonDisabled]}
          onPress={() => setShowConfirm(true)}
          disabled={!selectedShop || orderItems.length === 0}
        >
          <Text style={styles.submitButtonText}>Review & Submit</Text>
        </TouchableOpacity>

        <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.confirmCard}>
              <View style={styles.confirmHeader}>
                <Text style={styles.confirmTitle}>Confirm Order</Text>
                <Text style={styles.confirmSubtitle}>Review before submitting</Text>
              </View>
              <View style={styles.confirmSection}>
                <Text style={styles.modalLabel}>Shop</Text>
                <Text style={styles.confirmValue}>{selectedShop?.name}</Text>
                {selectedShop?.phone ? (
                  <Text style={styles.confirmMeta}>{selectedShop.phone}</Text>
                ) : null}
              </View>
              <View style={styles.confirmSection}>
                <Text style={styles.modalLabel}>Items</Text>
                <View style={styles.confirmItems}>
                  {orderItems.map((item) => (
                    <View key={item.product_id} style={styles.confirmItemRow}>
                      <Text style={styles.confirmItemName}>{item.name}</Text>
                      <Text style={styles.confirmItemQty}>
                        x{item.quantity}
                        {item.free_quantity > 0 ? ` + ${item.free_quantity} free` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.confirmTotal}>
                <Text style={styles.confirmTotalLabel}>Total</Text>
                <Text style={styles.confirmTotalValue}>{formatCurrency(orderTotal)} LKR</Text>
              </View>
              <View style={styles.confirmActions}>
                <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowConfirm(false)}>
                  <Text style={styles.confirmCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmSubmit} onPress={handleSubmitOrder} disabled={submitting}>
                  <Text style={styles.confirmSubmitText}>
                    {submitting ? 'Creating...' : 'Confirm & Create'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showReceipt} transparent animationType="slide" onRequestClose={() => setShowReceipt(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.receiptCard}>
              <ScrollView
                style={styles.receiptScroll}
                contentContainerStyle={styles.receiptScrollContent}
                showsVerticalScrollIndicator
              >
                <View style={styles.receiptHeader}>
                  <Text style={styles.receiptCompany}>S.B Distribution</Text>
                  <Text style={styles.receiptDocTitle}>Sales Order Receipt</Text>
                  <View style={styles.receiptBadge}>
                    <Text style={styles.receiptBadgeText}>Pending Approval</Text>
                  </View>
                </View>

                <View style={styles.receiptSection}>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Order #</Text>
                    <Text style={styles.receiptValue}>
                      {receipt?.id ? receipt.id.slice(0, 8).toUpperCase() : '--'}
                    </Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Shop</Text>
                    <Text style={styles.receiptValue}>{receipt?.shop?.name || 'N/A'}</Text>
                  </View>
                  {receipt?.shop?.address ? (
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Address</Text>
                      <Text style={styles.receiptValue}>{receipt.shop.address}</Text>
                    </View>
                  ) : null}
                  {receipt?.shop?.phone ? (
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Phone</Text>
                      <Text style={styles.receiptValue}>{receipt.shop.phone}</Text>
                    </View>
                  ) : null}
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Date</Text>
                    <Text style={styles.receiptValue}>{receiptDateInfo.dateText}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Time</Text>
                    <Text style={styles.receiptValue}>{receiptDateInfo.timeText}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Items</Text>
                    <Text style={styles.receiptValue}>{(receipt?.items || []).length}</Text>
                  </View>
                </View>

                <View style={styles.receiptTable}>
                  <View style={styles.receiptTableHeader}>
                    <Text style={[styles.receiptCell, styles.receiptCellItem, styles.receiptTableHeaderText]}>
                      Item
                    </Text>
                    <Text style={[styles.receiptCell, styles.receiptCellQty, styles.receiptTableHeaderText]}>
                      Qty
                    </Text>
                    <Text style={[styles.receiptCell, styles.receiptCellUnit, styles.receiptTableHeaderText]}>
                      Unit
                    </Text>
                    <Text style={[styles.receiptCell, styles.receiptCellTotal, styles.receiptTableHeaderText]}>
                      Total
                    </Text>
                  </View>
                  {(receipt?.items || []).map((item: any, index: number) => (
                    <View key={item.product_id || index} style={styles.receiptTableRow}>
                      <Text style={[styles.receiptCell, styles.receiptCellItem]}>
                        {index + 1}. {item.name}
                        {item.free_quantity > 0 ? ` (+${item.free_quantity} free)` : ''}
                      </Text>
                      <Text style={[styles.receiptCell, styles.receiptCellQty]}>{item.quantity}</Text>
                      <Text style={[styles.receiptCell, styles.receiptCellUnit]}>
                        {formatCurrency(item.unit_price)}
                      </Text>
                      <Text style={[styles.receiptCell, styles.receiptCellTotal]}>
                        {formatCurrency(Number(item.unit_price || 0) * Number(item.quantity || 0))}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>Total Amount (LKR)</Text>
                  <Text style={styles.receiptTotalValue}>{receiptTotal.toFixed(2)}</Text>
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
                  <Text style={styles.receiptFooterText}>
                    Printed on: {new Date().toLocaleString()}
                  </Text>
                </View>

                {messageStatus.type ? (
                  <Text
                    style={[
                      styles.message,
                      messageStatus.type === 'success' ? styles.messageSuccess : styles.messageError,
                    ]}
                  >
                    {messageStatus.message}
                  </Text>
                ) : null}
                <Text style={styles.printerMetaText}>
                  Printer: {selectedPrinterMac || 'Not selected'}
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.actionSecondary}
                    onPress={() => {
                      setShowReceipt(false);
                    }}
                  >
                    <Text style={styles.actionText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionSecondary, printing && styles.buttonDisabled]}
                    onPress={openPrinterPicker}
                    disabled={printing}
                  >
                    <Text style={styles.actionText}>Choose Printer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionPrimary, (printing || loadingPrinters) && styles.buttonDisabled]}
                    onPress={handlePrintReceipt}
                    disabled={printing || loadingPrinters}
                  >
                    <Text style={styles.actionTextOnAccent}>{printing ? 'Printing...' : 'Print Receipt'}</Text>
                  </TouchableOpacity>
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
                <View style={styles.centerInline}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.centerText}>Loading paired printers...</Text>
                </View>
              ) : pairedPrinters.length > 0 ? (
                <FlatList
                  data={pairedPrinters}
                  keyExtractor={(item) => item.macAddress}
                  style={styles.productList}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        item.macAddress === selectedPrinterMac && styles.selectedPrinterItem,
                      ]}
                      onPress={() => choosePrinter(item)}
                    >
                      <Text style={styles.dropdownTitle}>{item.deviceName || 'Bluetooth Printer'}</Text>
                      <Text style={styles.dropdownSubtitle}>{item.macAddress}</Text>
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <Text style={styles.emptyText}>No paired Bluetooth printers found.</Text>
              )}
              <TouchableOpacity
                style={[styles.actionSecondary, loadingPrinters && styles.buttonDisabled]}
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
        </Modal>

        <Modal visible={showProductPicker} transparent animationType="slide" onRequestClose={() => setShowProductPicker(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Product</Text>
              <TextInput
                placeholder="Search products..."
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={productSearch}
                onChangeText={setProductSearch}
              />
              <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id}
                style={styles.productList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedProduct(item);
                      setProductSearch('');
                      setShowProductPicker(false);
                    }}
                  >
                    <Text style={styles.dropdownTitle}>{item.name}</Text>
                    <Text style={styles.dropdownSubtitle}>{formatCurrency(item.unit_price)} LKR</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={styles.actionSecondary} onPress={() => setShowProductPicker(false)}>
                <Text style={styles.actionText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showShopPicker} transparent animationType="slide" onRequestClose={() => setShowShopPicker(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Shop</Text>
              <TextInput
                placeholder="Search shops..."
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={shopSearch}
                onChangeText={setShopSearch}
              />
              <FlatList
                data={filteredShops}
                keyExtractor={(item) => item.id}
                style={styles.productList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedShop(item);
                      setShopSearch('');
                      setShowShopPicker(false);
                    }}
                  >
                    <Text style={styles.dropdownTitle}>{item.name}</Text>
                    <Text style={styles.dropdownSubtitle}>{item.address}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={styles.actionSecondary} onPress={() => setShowShopPicker(false)}>
                <Text style={styles.actionText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </DismissKeyboard>
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
  centerInline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  centerText: {
    marginTop: 12,
    color: colors.textSubtle,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
  },
  errorText: {
    color: colors.danger,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
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
  placeholderText: {
    color: colors.textMuted,
  },
  selectedText: {
    color: colors.text,
    fontWeight: '600',
  },
  dropdown: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownTitle: {
    color: colors.text,
    fontWeight: '600',
  },
  dropdownSubtitle: {
    color: colors.textMuted,
    marginTop: 4,
  },
  shopSummary: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: 4,
  },
  shopName: {
    color: colors.text,
    fontWeight: '700',
  },
  shopMeta: {
    color: colors.textSubtle,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  qtyInput: {
    flex: 1,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.background,
    fontWeight: '700',
  },
  itemsList: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  itemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemName: {
    color: colors.text,
    fontWeight: '600',
  },
  itemMeta: {
    color: colors.textMuted,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  qtyButtonText: {
    color: colors.accent,
    fontWeight: '700',
  },
  qtyValue: {
    color: colors.text,
    fontWeight: '700',
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  freeLabel: {
    color: colors.textSubtle,
    fontWeight: '700',
  },
  freeButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  freeButtonText: {
    color: colors.accent,
    fontWeight: '700',
  },
  freeValue: {
    color: colors.text,
    fontWeight: '700',
  },
  removeButton: {
    marginLeft: 'auto',
  },
  removeButtonText: {
    color: colors.danger,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textMuted,
  },
  summaryCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  summaryLabel: {
    color: colors.textSubtle,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    color: colors.background,
    fontWeight: '800',
    fontSize: 16,
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
    gap: 8,
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
    flex: 6,
  },
  receiptCellQty: {
    flex: 2,
    textAlign: 'right',
  },
  receiptCellUnit: {
    flex: 2,
    textAlign: 'right',
  },
  receiptCellTotal: {
    flex: 2,
    textAlign: 'right',
  },
  receiptTableHeaderText: {
    fontWeight: '700',
    color: colors.text,
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
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  confirmHeader: {
    gap: 4,
  },
  confirmTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  confirmSubtitle: {
    color: colors.textMuted,
  },
  confirmSection: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  confirmValue: {
    color: colors.text,
    fontWeight: '700',
  },
  confirmMeta: {
    color: colors.textMuted,
  },
  confirmItems: {
    gap: 8,
  },
  confirmItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmItemName: {
    color: colors.text,
    fontWeight: '600',
  },
  confirmItemQty: {
    color: colors.textSubtle,
    fontWeight: '700',
  },
  confirmTotal: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmTotalLabel: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  confirmTotalValue: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmCancel: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  confirmCancelText: {
    color: colors.text,
    fontWeight: '700',
  },
  confirmSubmit: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmSubmitText: {
    color: colors.background,
    fontWeight: '800',
  },
  productList: {
    maxHeight: 260,
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
  modalActions: {
    marginTop: 12,
    gap: 8,
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
  message: {
    padding: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  messageSuccess: {
    backgroundColor: colors.successSurface,
    color: colors.success,
  },
  messageError: {
    backgroundColor: colors.dangerSurface,
    color: colors.danger,
  },
  printerMetaText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  selectedPrinterItem: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
  },
});
