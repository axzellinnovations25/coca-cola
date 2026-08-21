import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  NativeModules,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ThermalPrinterModule from 'react-native-thermal-printer';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  apiFetch,
  apiFetchCached,
  getCachedApiData,
  invalidateApiCache,
} from '../api/api';
import { ThemeColors, useThemeColors } from '../theme/colors';
import {
  getSavedIosBlePrinter,
  printReceiptLinesWithIosBlePrinter,
  saveIosBlePrinter,
  scanIosBlePrinters,
} from '../services/iosBlePrinter';

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
  description?: string;
  category?: string;
  size?: string;
  brand?: string;
  unit_price: number;
  available_stock: number;
  units_per_case?: number;
}

const SHOPS_PATH = '/api/marudham/shops/assigned';
const PRODUCTS_PATH = '/api/marudham/order-products';
const REFERENCE_CACHE_MS = 2 * 60 * 1000;

type ShopsResponse = { shops?: Shop[] };
type ProductsResponse = { products?: Product[] };

interface OrderItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  free_quantity: number;
  units_per_case?: number;
}

interface Bill {
  id: string;
  created_at: string;
  total: number;
  collected: number;
  outstanding: number;
}

interface ShopBills {
  shop_id: string;
  shop_name: string;
  total_outstanding: number;
  bills: Bill[];
}

interface ReturnLineItem {
  order_item_id: string;
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

type FlowStep = 'shops' | 'shop' | 'catalog' | 'cart' | 'free' | 'summary' | 'bills' | 'payment' | 'return';
type BillMode = 'collection' | 'return';
type QuantityEntryMode = 'case' | 'each';

interface BluetoothPrinterDevice {
  deviceName: string;
  macAddress: string;
}

const formatCurrency = (value: number | string | null | undefined) =>
  Number(value || 0).toFixed(2);
const DEFAULT_CASE_SIZE = 12;
// Server is the source of truth (products.units_per_case); the name heuristic
// below only covers servers that don't send the field yet.
const getCaseSize = (product: { name?: string; units_per_case?: number } | null | undefined) => {
  const fromServer = Number(product?.units_per_case);
  if (Number.isInteger(fromServer) && fromServer >= 1) return fromServer;
  const name = (product?.name || '').toLowerCase();
  const compact = name.replace(/\s+/g, '');
  if (name.includes('monster')) return 24;
  if (name.includes('water')) {
    if (compact.includes('1500ml') || compact.includes('1.5l')) return 12;
    if (compact.includes('1000ml') || compact.includes('1l')) return 15;
    if (compact.includes('500ml')) return 24;
    return 24;
  }
  if (compact.includes('250ml') && name.includes('tin')) return 24;
  if (compact.includes('250ml')) return 16;
  if (compact.includes('175ml')) return 24;
  if (compact.includes('300ml')) return 24;
  if (compact.includes('1050ml')) return 12;
  if (compact.includes('1.30l') || compact.includes('1.3l')) return 12;
  if (compact.includes('750ml')) return 9;
  if (compact.includes('1.25l') || compact.includes('1250ml')) return 12;
  if (compact.includes('2.25l') || compact.includes('2250ml')) return 9;
  if (compact.includes('2l') || compact.includes('2000ml')) return 9;
  return DEFAULT_CASE_SIZE;
};

const getProductType = (product: Product) => {
  const category = product.category?.trim();
  if (category && !/^others?$/i.test(category)) return category;
  const value = `${product.name} ${product.description || ''}`.toLowerCase();
  if (/monster|energy/.test(value)) return 'Energy Drinks';
  if (/water|aqua/.test(value)) return 'Water';
  if (/juice|nectar/.test(value)) return 'Juice';
  if (/coke|coca|fanta|sprite|soda|sparkling/.test(value)) return 'Core Sparkling';
  return 'Energy Drinks';
};

const getProductSize = (product: Product) => {
  if (product.size?.trim()) return product.size.trim();
  const match = `${product.name} ${product.description || ''}`.match(/(\d+(?:\.\d+)?)\s*(ml|l)/i);
  if (!match) return 'Other';
  return `${match[1]} ${match[2].toUpperCase()}`;
};

const getProductBrand = (product: Product) => {
  if (product.brand?.trim()) return product.brand.trim();
  const value = product.name.toLowerCase();
  const brands: Array<[RegExp, string]> = [
    [/coke zero/, 'Coke Zero'],
    [/coca|coke/, 'Coca-Cola'],
    [/fanta/, 'Fanta'],
    [/sprite/, 'Sprite'],
    [/monster/, 'Monster'],
    [/water|aqua/, 'Water'],
  ];
  return brands.find(([pattern]) => pattern.test(value))?.[1] || product.name.split(/\s+/).slice(0, 2).join(' ');
};
const PRINTER_MAC_KEY = 'bluetooth_receipt_printer_mac';
const RECEIPT_LINE_WIDTH = 42;
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
const joinColumns = (columns: Array<{ value: string; width: number; align?: 'left' | 'right' }>) =>
  columns
    .map(({ value, width, align = 'left' }) => (align === 'right' ? padLeft(value, width) : padRight(value, width)))
    .join(' ');

const hasNativeBluetoothRawPrint = () =>
  typeof (NativeModules as any)?.ThermalPrinterModule?.printBluetoothRaw === 'function';
const RECEIPT_COMPANY_NAME = 'S.B Distribution';
const pickDefaultPrinter = (devices: BluetoothPrinterDevice[]) => {
  if (!devices.length) return null;
  const preferred = devices.find((printer) => isLikelyCpclPrinter(printer.deviceName));
  return preferred || devices[0];
};
const CPCL_RENDER_LINE_WIDTH = 32;
const CPCL_LEFT_MARGIN = 8;
const CPCL_RIGHT_MARGIN = 20;
const CPCL_DOTS_PER_MM = 8;
const CPCL_CHAR_WIDTH = 12;
const CPCL_FONT = 0;
const CPCL_MAG_X = 1;
const CPCL_MAG_Y = 1;
const CPCL_BASE_LINE_HEIGHT = 30;
const CPCL_PRINT_TONE = 60;
const CPCL_PRINT_SPEED = 2;
const CPCL_BOLD = 0;
const getCpclLineWidth = (printerProfile: { printerWidthMM: number; printerNbrCharactersPerLine: number }) => {
  const targetWidth = printerProfile.printerWidthMM <= 58 ? 32 : CPCL_RENDER_LINE_WIDTH;
  return Math.min(targetWidth, printerProfile.printerNbrCharactersPerLine);
};
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

const formatBillDate = (value: string | number | Date | null | undefined) => {
  const date = parseDate(value);
  return date ? date.toLocaleDateString() : 'Date unavailable';
};

export default function CreateOrderScreen() {
  const bottomTabBarHeight = 0;
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const cachedShops = getCachedApiData<ShopsResponse>(SHOPS_PATH);
  const cachedProducts = getCachedApiData<ProductsResponse>(PRODUCTS_PATH);
  const hasCompleteCache = Boolean(cachedShops && cachedProducts);
  const [shops, setShops] = useState<Shop[]>(() => cachedShops?.shops || []);
  const [products, setProducts] = useState<Product[]>(() => cachedProducts?.products || []);
  const [flowStep, setFlowStep] = useState<FlowStep>('shops');
  const flowHistory = useRef<FlowStep[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(() => !hasCompleteCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [shopSearch, setShopSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sizeFilter, setSizeFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');
  const [addAsFree, setAddAsFree] = useState(false);
  const [orderByCase, setOrderByCase] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showShopPicker, setShowShopPicker] = useState(false);
  const [quantityEntry, setQuantityEntry] = useState<{
    product: Product;
    mode: QuantityEntryMode;
  } | null>(null);
  const [quantityEntryValue, setQuantityEntryValue] = useState('');

  const [billMode, setBillMode] = useState<BillMode>('collection');
  const [shopBills, setShopBills] = useState<Bill[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [collectionAmount, setCollectionAmount] = useState('');
  const [collectionNotes, setCollectionNotes] = useState('');
  const [billActionLoading, setBillActionLoading] = useState(false);
  const [returnItems, setReturnItems] = useState<ReturnLineItem[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});

  const [showConfirm, setShowConfirm] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPrinterPicker, setShowPrinterPicker] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [pairedPrinters, setPairedPrinters] = useState<BluetoothPrinterDevice[]>([]);
  const [selectedPrinterMac, setSelectedPrinterMac] = useState('');
  const [selectedIosPrinterName, setSelectedIosPrinterName] = useState('');
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

  const hasLoadedData = useRef(hasCompleteCache);

  const fetchData = useCallback(async (silent = false, force = false) => {
    const cachedShopData = getCachedApiData<ShopsResponse>(SHOPS_PATH);
    const cachedProductData = getCachedApiData<ProductsResponse>(PRODUCTS_PATH);
    try {
      if (cachedShopData && cachedProductData) {
        setShops(cachedShopData.shops || []);
        setProducts(cachedProductData.products || []);
        hasLoadedData.current = true;
        setLoading(false);
      } else if (!silent) {
        setLoading(true);
      }
      setError('');
      const [shopData, productData] = await Promise.all([
        apiFetchCached<ShopsResponse>(SHOPS_PATH, { maxAgeMs: REFERENCE_CACHE_MS, force }),
        apiFetchCached<ProductsResponse>(PRODUCTS_PATH, { maxAgeMs: REFERENCE_CACHE_MS, force }),
      ]);
      setShops(shopData.shops || []);
      setProducts(productData.products || []);
      setSelectedShop((current) =>
        current ? (shopData.shops || []).find((shop) => shop.id === current.id) || current : null,
      );
      hasLoadedData.current = true;
    } catch (err: any) {
      if (!hasLoadedData.current) setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true, true);
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchData(true);
      AsyncStorage.getItem(PRINTER_MAC_KEY)
        .then((savedMac) => {
          if (cancelled) return;
          if (savedMac) {
            setSelectedPrinterMac(savedMac);
          }
        })
        .catch(() => {});
      getSavedIosBlePrinter()
        .then((printer) => {
          if (!cancelled && printer) {
            setSelectedPrinterMac(printer.macAddress);
            setSelectedIosPrinterName(printer.deviceName);
          }
        })
        .catch(() => {});
      return () => { cancelled = true; };
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
    const q = flowStep === 'catalog' || flowStep === 'free' ? '' : productSearch.toLowerCase();
    return products.filter((product) =>
      product.name.toLowerCase().includes(q)
      && (typeFilter === 'All' || getProductType(product) === typeFilter)
      && (sizeFilter === 'All' || getProductSize(product) === sizeFilter)
      && (brandFilter === 'All' || getProductBrand(product) === brandFilter),
    );
  }, [products, productSearch, typeFilter, sizeFilter, brandFilter, flowStep]);

  const productTypes = useMemo(
    () => ['All', ...Array.from(new Set(products.map(getProductType))).sort()],
    [products],
  );
  const productsForSelectedType = useMemo(
    () => products.filter(
      (product) => typeFilter === 'All' || getProductType(product) === typeFilter,
    ),
    [products, typeFilter],
  );
  const productSizes = useMemo(
    () => ['All', ...Array.from(new Set(productsForSelectedType.map(getProductSize))).sort()],
    [productsForSelectedType],
  );
  const productsForSelectedTypeAndSize = useMemo(
    () => productsForSelectedType.filter(
      (product) => sizeFilter === 'All' || getProductSize(product) === sizeFilter,
    ),
    [productsForSelectedType, sizeFilter],
  );
  const productBrands = useMemo(
    () => ['All', ...Array.from(new Set(productsForSelectedTypeAndSize.map(getProductBrand))).sort()],
    [productsForSelectedTypeAndSize],
  );

  const selectTypeFilter = (value: string) => {
    setTypeFilter(value);
    setSizeFilter('All');
    setBrandFilter('All');
  };

  const selectSizeFilter = (value: string) => {
    setSizeFilter(value);
    setBrandFilter('All');
  };

  const addProductUnits = (product: Product, units: number, free = false) => {
    if (units <= 0) return;
    const stock = Number(product.available_stock) || 0;
    const existing = orderItems.find((item) => item.product_id === product.id);
    const alreadySelected = (existing?.quantity || 0) + (existing?.free_quantity || 0);
    const allowed = Math.min(units, Math.max(0, stock - alreadySelected));
    if (allowed <= 0) {
      Alert.alert('Out of Stock', `${product.name} has no more available stock.`);
      return;
    }
    if (allowed < units) Alert.alert('Limited Stock', `Only ${allowed} more units are available.`);
    setOrderItems((items) => {
      const current = items.find((item) => item.product_id === product.id);
      if (current) {
        return items.map((item) => item.product_id === product.id
          ? {
              ...item,
              quantity: item.quantity + (free ? 0 : allowed),
              free_quantity: item.free_quantity + (free ? allowed : 0),
            }
          : item);
      }
      return [...items, {
        product_id: product.id,
        name: product.name,
        unit_price: Number(product.unit_price) || 0,
        quantity: free ? 0 : allowed,
        free_quantity: free ? allowed : 0,
        units_per_case: product.units_per_case,
      }];
    });
  };

  const addItem = (andNext = false) => {
    if (!selectedProduct) return;
    const enteredQty = Number(quantity);
    if (!quantity.trim() || !Number.isFinite(enteredQty) || enteredQty < 1) {
      Alert.alert('Quantity Required', orderByCase ? 'Enter the number of cases.' : 'Enter a quantity.');
      return;
    }
    const requestedQty = orderByCase ? enteredQty * getCaseSize(selectedProduct) : enteredQty;

    const stock = Number(selectedProduct.available_stock) || 0;
    const existing = orderItems.find((i) => i.product_id === selectedProduct.id);
    const alreadyInOrder = existing ? existing.quantity + existing.free_quantity : 0;
    const remainingStock = stock - alreadyInOrder;

    if (remainingStock <= 0) {
      Alert.alert(
        'Out of Stock',
        `${selectedProduct.name} has no more available stock${alreadyInOrder > 0 ? ` (${alreadyInOrder} already in this order)` : ''}.`,
      );
      return;
    }

    const qty = Math.min(requestedQty, remainingStock);
    if (qty < requestedQty) {
      Alert.alert(
        'Limited Stock',
        `Only ${remainingStock} of ${selectedProduct.name} available — added ${qty} instead of ${requestedQty}.`,
      );
    }

    setOrderItems((items) => {
      if (existing) {
        return items.map((i) =>
          i.product_id === selectedProduct.id
            ? addAsFree
              ? { ...i, free_quantity: i.free_quantity + qty }
              : { ...i, quantity: i.quantity + qty }
            : i,
        );
      }
      return [
        ...items,
        {
          product_id: selectedProduct.id,
          name: selectedProduct.name,
          unit_price: Number(selectedProduct.unit_price) || 0,
          quantity: addAsFree ? 0 : qty,
          free_quantity: addAsFree ? qty : 0,
          units_per_case: selectedProduct.units_per_case,
        },
      ];
    });
    setSelectedProduct(null);
    setProductSearch('');
    setQuantity('');
    setAddAsFree(false);
    if (andNext) setShowProductPicker(true);
  };

  const getAvailableStock = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product ? Number(product.available_stock) || 0 : Infinity;
  };

  const updateQuantity = (productId: string, delta: number) => {
    setOrderItems((items) =>
      items
        .map((item) => {
          if (item.product_id !== productId) return item;
          const next = Math.max(0, item.quantity + delta);
          if (delta > 0 && next + item.free_quantity > getAvailableStock(productId)) return item;
          return { ...item, quantity: next };
        })
        .filter((item) => item.quantity > 0 || item.free_quantity > 0),
    );
  };

  const updateFreeQuantity = (productId: string, delta: number) => {
    setOrderItems((items) =>
      items
        .map((item) => {
          if (item.product_id !== productId) return item;
          const next = Math.max(0, item.free_quantity + delta);
          if (delta > 0 && item.quantity + next > getAvailableStock(productId)) return item;
          return { ...item, free_quantity: next };
        })
        .filter((item) => item.quantity > 0 || item.free_quantity > 0),
    );
  };

  const removeItem = (productId: string) => {
    setOrderItems((items) => items.filter((item) => item.product_id !== productId));
  };

  const clearForm = () => {
    setSelectedShop(null);
    setOrderItems([]);
    setShopSearch('');
    setProductSearch('');
    setSelectedProduct(null);
    setQuantity('');
    setAddAsFree(false);
    setError('');
    setMessageStatus({ type: null, message: '' });
  };

  const handleClearPress = () => {
    if (!selectedShop && orderItems.length === 0) return;
    Alert.alert('Clear Order', 'This will clear the shop and all items on this screen. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearForm },
    ]);
  };

  const orderTotal = orderItems.reduce(
    (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
    0,
  );

  const hasEmptyItems = orderItems.some((item) => item.quantity <= 0 && item.free_quantity <= 0);

  const availableCredit = selectedShop
    ? Math.max(0, Number(selectedShop.max_bill_amount) - Number(selectedShop.current_outstanding))
    : 0;
  const exceedsCredit = !!selectedShop && orderTotal > availableCredit;
  const noBillSlots =
    !!selectedShop && Number(selectedShop.active_bills) >= Number(selectedShop.max_active_bills);

  const paidItemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const paidProductCount = orderItems.filter((item) => item.quantity > 0).length;
  const freeItemCount = orderItems.reduce((sum, item) => sum + item.free_quantity, 0);

  const navigateFlow = (nextStep: FlowStep) => {
    if (nextStep === flowStep) return;
    flowHistory.current.push(flowStep);
    setFlowStep(nextStep);
  };

  const resetFlow = (nextStep: FlowStep, history: FlowStep[] = []) => {
    flowHistory.current = history;
    setFlowStep(nextStep);
  };

  const chooseShop = (shop: Shop) => {
    if (selectedShop?.id !== shop.id && orderItems.length > 0) setOrderItems([]);
    setSelectedShop(shop);
    setShopSearch('');
    navigateFlow('shop');
  };

  const openQuantityEntry = (
    product: Product,
    mode: QuantityEntryMode,
    currentValue: number,
  ) => {
    setQuantityEntry({ product, mode });
    setQuantityEntryValue(String(currentValue));
  };

  const closeQuantityEntry = () => {
    setQuantityEntry(null);
    setQuantityEntryValue('');
  };

  const applyQuantityEntry = () => {
    if (!quantityEntry) return;
    const entered = Number(quantityEntryValue);
    if (!/^\d+$/.test(quantityEntryValue.trim()) || !Number.isSafeInteger(entered) || entered < 0) {
      Alert.alert('Invalid Quantity', 'Enter a whole number of zero or more.');
      return;
    }

    const { product, mode } = quantityEntry;
    const caseSize = getCaseSize(product);
    if (mode === 'each' && entered >= caseSize) {
      Alert.alert(
        'Too Many Individual Units',
        `Enter 0 to ${caseSize - 1} individual units. Use the Case card for full cases.`,
      );
      return;
    }

    const existing = orderItems.find((item) => item.product_id === product.id);
    const currentPaid = existing?.quantity || 0;
    const currentCases = Math.floor(currentPaid / caseSize);
    const currentEach = currentPaid % caseSize;
    const nextPaid =
      mode === 'case'
        ? entered * caseSize + currentEach
        : currentCases * caseSize + entered;
    const freeQuantity = existing?.free_quantity || 0;
    const availableForPaid = Math.max(0, (Number(product.available_stock) || 0) - freeQuantity);

    if (nextPaid > availableForPaid) {
      Alert.alert(
        'Limited Stock',
        `Only ${availableForPaid} paid units are available after free items.`,
      );
      return;
    }

    setOrderItems((items) => {
      const current = items.find((item) => item.product_id === product.id);
      if (!current) {
        if (nextPaid === 0) return items;
        return [
          ...items,
          {
            product_id: product.id,
            name: product.name,
            unit_price: Number(product.unit_price) || 0,
            quantity: nextPaid,
            free_quantity: 0,
            units_per_case: product.units_per_case,
          },
        ];
      }
      if (nextPaid === 0 && current.free_quantity === 0) {
        return items.filter((item) => item.product_id !== product.id);
      }
      return items.map((item) =>
        item.product_id === product.id ? { ...item, quantity: nextPaid } : item,
      );
    });
    closeQuantityEntry();
  };

  const openBillFlow = async (mode: BillMode) => {
    if (!selectedShop) return;
    setBillMode(mode);
    setSelectedBill(null);
    setShopBills([]);
    setBillsLoading(true);
    setError('');
    navigateFlow('bills');
    try {
      const response = await apiFetchCached<{ bills?: ShopBills[] }>('/api/marudham/bills/representative', {
        force: true,
      });
      const group = (response.bills || []).find((item) => item.shop_id === selectedShop.id);
      setShopBills((group?.bills || []).filter((bill) => mode === 'return' || Number(bill.outstanding) > 0));
    } catch (err: any) {
      setError(err.message || 'Failed to load bills.');
    } finally {
      setBillsLoading(false);
    }
  };

  const chooseBill = async (bill: Bill) => {
    setSelectedBill(bill);
    setError('');
    if (billMode === 'collection') {
      setCollectionAmount('');
      setCollectionNotes('');
      navigateFlow('payment');
      return;
    }
    setBillsLoading(true);
    try {
      const response = await apiFetch(`/api/marudham/orders/${bill.id}/details`);
      const items = (response.order?.items || []).map((item: any) => ({
        order_item_id: String(item.order_item_id ?? item.id ?? ''),
        product_id: String(item.product_id ?? ''),
        name: String(item.name ?? item.product_name ?? 'Product'),
        unit_price: Number(item.unit_price || 0),
        quantity: Number(item.remaining_qty ?? item.quantity ?? 0),
      })).filter((item: ReturnLineItem) => item.order_item_id && item.quantity > 0);
      setReturnItems(items);
      setReturnQuantities({});
      navigateFlow('return');
    } catch (err: any) {
      setError(err.message || 'Failed to load bill items.');
    } finally {
      setBillsLoading(false);
    }
  };

  const submitCollection = async () => {
    if (!selectedBill) return;
    const amount = Number(collectionAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(selectedBill.outstanding)) {
      Alert.alert('Invalid Amount', `Enter an amount between 0 and ${formatCurrency(selectedBill.outstanding)} LKR.`);
      return;
    }
    setBillActionLoading(true);
    try {
      await apiFetch(`/api/marudham/bills/${selectedBill.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({ amount, notes: collectionNotes }),
      });
      invalidateApiCache([
        '/api/marudham/bills/representative',
        '/api/marudham/collections/representative',
        SHOPS_PATH,
        '/api/marudham/orders',
      ]);
      await fetchData(true, true);
      Alert.alert('Collection Recorded', `${formatCurrency(amount)} LKR was recorded successfully.`);
      resetFlow('shop', ['shops']);
    } catch (err: any) {
      setError(err.message || 'Failed to record collection.');
    } finally {
      setBillActionLoading(false);
    }
  };

  const submitShopReturn = async () => {
    if (!selectedBill) return;
    const items = returnItems
      .map((item) => ({ order_item_id: item.order_item_id, quantity: Number(returnQuantities[item.order_item_id] || 0) }))
      .filter((item) => item.quantity > 0);
    if (!items.length) {
      Alert.alert('Select Products', 'Enter at least one return quantity.');
      return;
    }
    const invalid = items.some((entry) => {
      const source = returnItems.find((item) => item.order_item_id === entry.order_item_id);
      return !source || entry.quantity > source.quantity;
    });
    if (invalid) {
      Alert.alert('Invalid Quantity', 'A return quantity cannot exceed the ordered quantity.');
      return;
    }
    setBillActionLoading(true);
    try {
      await apiFetch(`/api/marudham/bills/${selectedBill.id}/return`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
      invalidateApiCache([
        '/api/marudham/bills/representative',
        SHOPS_PATH,
        PRODUCTS_PATH,
        '/api/marudham/orders',
      ]);
      await fetchData(true, true);
      Alert.alert('Return Recorded', 'The selected products were returned successfully.');
      resetFlow('shop', ['shops']);
    } catch (err: any) {
      setError(err.message || 'Failed to record return.');
    } finally {
      setBillActionLoading(false);
    }
  };

  const goBackInFlow = () => {
    const previousStep = flowHistory.current.pop();
    if (previousStep) {
      if (previousStep === 'shops') setSelectedShop(null);
      setFlowStep(previousStep);
      return;
    }
    if (flowStep !== 'shops') {
      setSelectedShop(null);
      setFlowStep('shops');
    }
  };

  useEffect(() => {
    if (flowStep === 'shops') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBackInFlow();
      return true;
    });
    return () => subscription.remove();
  }, [flowStep]);

  const handleSubmitOrder = async () => {
    if (!selectedShop || orderItems.length === 0 || hasEmptyItems) return;
    setSubmitting(true);
    setError('');
    setMessageStatus({ type: null, message: '' });
    try {
      const response = await apiFetch('/api/marudham/orders', {
        method: 'POST',
        body: JSON.stringify({
          shop_id: selectedShop.id,
          items: orderItems.flatMap((item) => [
            ...(item.quantity > 0
              ? [
                  {
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: Number(item.unit_price || 0),
                  },
                ]
              : []),
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
      resetFlow('shops');
      invalidateApiCache([
        '/api/marudham/orders',
        '/api/marudham/orders/pending',
        SHOPS_PATH,
        PRODUCTS_PATH,
        '/api/marudham/bills/representative',
      ]);
      fetchData(true, true);
      if (selectedShop.phone) {
        sendSMS(response.order.id).catch(() => {
          setMessageStatus({ type: 'error', message: 'Order created but SMS failed.' });
        });
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
    const columnGaps = 3;
    const itemWidth = totalWidth >= 42 ? 18 : 12;
    const qtyWidth = totalWidth >= 42 ? 4 : 3;
    const unitWidth = totalWidth >= 42 ? 8 : 6;
    const totalWidthCol = totalWidth - itemWidth - qtyWidth - unitWidth - columnGaps;
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
        joinColumns([
          { value: 'Item', width: itemWidth },
          { value: 'Qty', width: qtyWidth, align: 'right' },
          { value: 'Unit', width: unitWidth, align: 'right' },
          { value: 'Total', width: totalWidthCol, align: 'right' },
        ]),
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
          joinColumns([
            { value: trimCell(itemName, itemWidth), width: itemWidth },
            { value: String(qty), width: qtyWidth, align: 'right' },
            { value: unit.toFixed(2), width: unitWidth, align: 'right' },
            { value: total, width: totalWidthCol, align: 'right' },
          ]),
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

  const buildCpclReceiptPayload = (
    lineWidth: number = RECEIPT_LINE_WIDTH,
    printerProfile: { printerWidthMM: number; printerNbrCharactersPerLine: number },
  ) => {
    const shopName = receipt?.shop?.name || 'N/A';
    const shopPhone = receipt?.shop?.phone || '';
    const itemCount = (receipt?.items || []).length;
    const paperWidth = Math.floor(printerProfile.printerWidthMM * CPCL_DOTS_PER_MM);
    const rightEdge = paperWidth - CPCL_RIGHT_MARGIN;
    const startY = 24;
    const lineHeight = CPCL_BASE_LINE_HEIGHT * CPCL_MAG_Y + 8;
    const itemMaxChars = Math.max(14, Math.floor((rightEdge - CPCL_LEFT_MARGIN - 8) / CPCL_CHAR_WIDTH));
    const commands: string[] = [];
    let y = startY;

    const text = (x: number, textY: number, value: string) => {
      const clean = sanitizeCpclLine(escapeCpclText(value));
      if (clean.trim()) commands.push(`TEXT ${CPCL_FONT} 0 ${Math.max(CPCL_LEFT_MARGIN, x)} ${textY} ${clean}`);
    };
    const textRight = (value: string, textY: number, edgeX = rightEdge) => {
      const clean = sanitizeCpclLine(escapeCpclText(value));
      const x = edgeX - clean.length * CPCL_CHAR_WIDTH;
      text(x, textY, clean);
    };
    const rule = (ruleY: number) => {
      commands.push(`LINE ${CPCL_LEFT_MARGIN} ${ruleY} ${rightEdge} ${ruleY} 1`);
    };
    const row = (label: string, value: string) => {
      text(CPCL_LEFT_MARGIN, y, label);
      textRight(value, y);
      y += lineHeight;
    };

    text(CPCL_LEFT_MARGIN, y, RECEIPT_COMPANY_NAME);
    y += lineHeight;
    text(CPCL_LEFT_MARGIN, y, 'Sales Order Receipt');
    y += lineHeight;
    rule(y);
    y += lineHeight;
    row('Shop', shopName);
    if (shopPhone) row('Phone', shopPhone);
    row('Date', receiptDateInfo.dateText);
    row('Time', receiptDateInfo.timeText);
    row('Items', String(itemCount));
    rule(y);
    y += lineHeight;
    text(CPCL_LEFT_MARGIN, y, 'ITEM DETAILS');
    y += lineHeight;
    rule(y);
    y += lineHeight;
    text(CPCL_LEFT_MARGIN, y, 'Item');
    textRight('Total', y);
    y += lineHeight;
    rule(y);
    y += lineHeight;

    (receipt?.items || []).forEach((item: any, index: number) => {
      const qty = Number(item.quantity || 0);
      const freeQty = Number(item.free_quantity || 0);
      const unit = Number(item.unit_price || 0);
      const total = (unit * qty).toFixed(2);
      const itemName = trimCell(`${index + 1}. ${item.name || 'Item'}`, itemMaxChars);
      text(CPCL_LEFT_MARGIN, y, itemName);
      y += lineHeight;
      text(CPCL_LEFT_MARGIN, y, `  ${qty} x ${unit.toFixed(2)}`);
      textRight(total, y);
      y += lineHeight;
      if (freeQty > 0) {
        row('  Free Qty', String(freeQty));
      }
    });

    rule(y);
    y += lineHeight;
    row('TOTAL AMOUNT (LKR)', receiptTotal.toFixed(2));
    rule(y);
    y += lineHeight;

    const height = Math.max(260, y + 60);
    return `! 0 200 200 ${height} 1\r\nTONE ${CPCL_PRINT_TONE}\r\nSPEED ${CPCL_PRINT_SPEED}\r\nSETBOLD ${CPCL_BOLD}\r\nSETMAG ${CPCL_MAG_X} ${CPCL_MAG_Y}\r\n${commands.join('\r\n')}\r\nFORM\r\nPRINT\r\n`;
  };


  const requestBluetoothPermissions = async () => {
    if (Platform.OS !== 'android') {
      return true;
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
    if (Platform.OS === 'ios') {
      const savedPrinter = await getSavedIosBlePrinter();
      if (savedPrinter) {
        setSelectedPrinterMac(savedPrinter.macAddress);
        setSelectedIosPrinterName(savedPrinter.deviceName);
      }
      const devices = await scanIosBlePrinters(BLUETOOTH_SCAN_TIMEOUT_MS);
      setPairedPrinters(devices);
      return devices;
    }
    if (
      !ThermalPrinterModule ||
      typeof ThermalPrinterModule.getBluetoothDeviceList !== 'function' ||
      typeof ThermalPrinterModule.printBluetooth !== 'function'
    ) {
      throw new Error('Bluetooth printer module is unavailable in this build.');
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
          message: Platform.OS === 'ios'
            ? 'No BLE printer found. Turn on the printer and make sure it supports BLE printing.'
            : 'No paired Bluetooth printer found. Pair the printer in phone Bluetooth settings first.',
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
    if (Platform.OS === 'ios') {
      await saveIosBlePrinter(printer);
      setSelectedIosPrinterName(printer.deviceName);
    } else {
      await AsyncStorage.setItem(PRINTER_MAC_KEY, printer.macAddress);
    }
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
        throw new Error(
          Platform.OS === 'ios'
            ? 'No BLE printer found. Turn on the printer and make sure it supports BLE printing.'
            : 'No paired Bluetooth printer found. Pair the printer in phone Bluetooth settings first.',
        );
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
      if (Platform.OS === 'ios') {
        const lines = buildPrintableReceiptLines(printerProfile.printerNbrCharactersPerLine);
        await printReceiptLinesWithIosBlePrinter(macAddress, lines);
      } else if (useCpcl) {
        const cpclPayload = buildCpclReceiptPayload(getCpclLineWidth(printerProfile), printerProfile);
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
        message: `Print command sent to Bluetooth printer${selectedDevice?.deviceName ? ` (${selectedDevice.deviceName})` : ''}${Platform.OS === 'ios' ? ' (BLE)' : useCpcl ? ' (CPCL)' : ' (ESC/POS)'}.`,
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to print receipt.';
      setMessageStatus({ type: 'error', message: errorMessage });
      Alert.alert('Print Failed', errorMessage);
    } finally {
      setPrinting(false);
    }
  };

  const renderFlowHeader = (_title: string, subtitle?: string) => {
    if (flowStep === 'shops') return null;
    return (
      <View style={styles.flowHeader}>
        <TouchableOpacity style={styles.backButton} onPress={goBackInFlow}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        {subtitle ? (
          <View style={styles.headerTextWrap}>
            <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderFilterRow = (label: string, values: string[], selected: string, onSelect: (value: string) => void) => (
    <View style={styles.filterSection}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {values.map((value) => (
          <TouchableOpacity
            key={`${label}-${value}`}
            style={[styles.filterChip, selected === value && styles.filterChipActive]}
            onPress={() => onSelect(value)}
          >
            <Text style={[styles.filterChipText, selected === value && styles.filterChipTextActive]}>{value}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderProductCard = (product: Product, freeOnly = false) => {
    const item = orderItems.find((entry) => entry.product_id === product.id);
    const caseSize = getCaseSize(product);
    const paidQuantity = item?.quantity || 0;
    const cases = Math.floor(paidQuantity / caseSize);
    const each = paidQuantity % caseSize;
    const freeQuantity = item?.free_quantity || 0;
    const stock = Number(product.available_stock) || 0;
    return (
      <View key={product.id} style={styles.catalogCard}>
        <View style={styles.catalogInfo}>
          <View style={styles.catalogHeaderRow}>
            <Text style={styles.catalogName} numberOfLines={2}>{product.name}</Text>
            <Text style={[styles.catalogStock, stock <= 0 ? styles.stockZero : stock <= caseSize ? styles.stockLow : styles.stockOk]}>
              {stock} stock
            </Text>
          </View>
        </View>
        {freeOnly ? (
          <View style={styles.freeCompactPanel}>
            <Text style={styles.quantityPanelLabel}>Free individual units</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepperButton} onPress={() => updateFreeQuantity(product.id, -1)}>
                <Text style={styles.stepperButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{freeQuantity}</Text>
              <TouchableOpacity style={styles.stepperButtonActive} onPress={() => addProductUnits(product, 1, true)}>
                <Text style={styles.stepperButtonTextActive}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.purchasePanels}>
            <View
              style={[styles.quantityPanel, cases > 0 && styles.quantityPanelSelected]}
            >
              <TouchableOpacity
                style={styles.quantityPanelTapArea}
                onPress={() => openQuantityEntry(product, 'case', cases)}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel={`Type cases for ${product.name}`}
              >
                <View style={styles.quantityPanelHeader}>
                  <Text style={styles.quantityPanelLabel}>Case ({caseSize})</Text>
                  <Text style={styles.quantityPanelPrice}>LKR {formatCurrency(product.unit_price * caseSize)}</Text>
                </View>
                <View style={styles.directQuantity}>
                  <Text style={styles.directQuantityValue}>{cases}</Text>
                  <Text style={styles.directQuantityHint}>Tap to type</Text>
                </View>
              </TouchableOpacity>
              <View style={[styles.stepperRow, styles.quantityQuickActions]}>
                <TouchableOpacity
                  style={[styles.stepperButton, cases === 0 && styles.stepperButtonDisabled]}
                  onPress={() => updateQuantity(product.id, -caseSize)}
                  disabled={cases === 0}
                  accessibilityLabel={`Remove one case of ${product.name}`}
                >
                  <Text style={styles.stepperButtonText}>−</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepperButtonActive}
                  onPress={() => addProductUnits(product, caseSize)}
                  accessibilityLabel={`Add one case of ${product.name}`}
                >
                  <Text style={styles.stepperButtonTextActive}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View
              style={[styles.quantityPanel, each > 0 && styles.quantityPanelSelected]}
            >
              <TouchableOpacity
                style={styles.quantityPanelTapArea}
                onPress={() => openQuantityEntry(product, 'each', each)}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel={`Type individual units for ${product.name}`}
              >
                <View style={styles.quantityPanelHeader}>
                  <Text style={styles.quantityPanelLabel}>Each</Text>
                  <Text style={styles.quantityPanelPrice}>LKR {formatCurrency(product.unit_price)}</Text>
                </View>
                <View style={styles.directQuantity}>
                  <Text style={styles.directQuantityValue}>{each}</Text>
                  <Text style={styles.directQuantityHint}>Tap to type</Text>
                </View>
              </TouchableOpacity>
              <View style={[styles.stepperRow, styles.quantityQuickActions]}>
                <TouchableOpacity
                  style={[styles.stepperButton, each === 0 && styles.stepperButtonDisabled]}
                  onPress={() => updateQuantity(product.id, -1)}
                  disabled={each === 0}
                  accessibilityLabel={`Remove one unit of ${product.name}`}
                >
                  <Text style={styles.stepperButtonText}>−</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepperButtonActive}
                  onPress={() => addProductUnits(product, 1)}
                  accessibilityLabel={`Add one unit of ${product.name}`}
                >
                  <Text style={styles.stepperButtonTextActive}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderCatalogueFilters = (showSearch = true) => (
    <View style={styles.filtersCard}>
      {showSearch ? (
        <TextInput
          placeholder="Search products..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          value={productSearch}
          onChangeText={setProductSearch}
        />
      ) : null}
      {renderFilterRow('Type', productTypes, typeFilter, selectTypeFilter)}
      {renderFilterRow('Size', productSizes, sizeFilter, selectSizeFilter)}
      {renderFilterRow('Product', productBrands, brandFilter, setBrandFilter)}
    </View>
  );

  const renderStepContent = () => {
    if (flowStep === 'shops') {
      return (
        <>
          {renderFlowHeader('Select Shop', 'Choose a shop to order, collect, or return products.')}
          <TextInput
            placeholder="Search shop name, address, or phone..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            value={shopSearch}
            onChangeText={setShopSearch}
          />
          <View style={styles.flowList}>
            {filteredShops.map((shop) => (
              <TouchableOpacity key={shop.id} style={styles.shopListCard} onPress={() => chooseShop(shop)}>
                <View style={styles.shopListMain}>
                  <Text style={styles.shopListName}>{shop.name}</Text>
                  <Text style={styles.shopListMeta}>{shop.address}</Text>
                  {!!shop.phone && <Text style={styles.shopListMeta}>{shop.phone}</Text>}
                </View>
                <View style={styles.shopListSide}>
                  <Text style={styles.shopOutstanding}>{formatCurrency(shop.current_outstanding)} LKR</Text>
                  <Text style={styles.shopListMeta}>Outstanding</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.accent} />
                </View>
              </TouchableOpacity>
            ))}
            {!filteredShops.length ? <Text style={styles.emptyText}>No shops found.</Text> : null}
          </View>
        </>
      );
    }

    if (flowStep === 'shop' && selectedShop) {
      const creditLimit = Number(selectedShop.max_bill_amount) || 0;
      const outstanding = Number(selectedShop.current_outstanding) || 0;
      const creditUsage = creditLimit > 0 ? Math.min(1, outstanding / creditLimit) : 0;
      const maxBills = Number(selectedShop.max_active_bills) || 0;
      const activeBills = Number(selectedShop.active_bills) || 0;
      return (
        <>
          {renderFlowHeader('Shop Operations', selectedShop.name)}
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.compactShopHero}
          >
            <View style={styles.compactShopTop}>
              <View style={styles.compactShopIcon}>
                <Ionicons name="storefront" size={21} color="#fff" />
              </View>
              <View style={styles.compactShopIdentity}>
                <Text style={styles.compactShopName} numberOfLines={1}>{selectedShop.name}</Text>
                <Text style={styles.compactShopMeta} numberOfLines={1}>{selectedShop.address}</Text>
                {!!selectedShop.phone && <Text style={styles.compactShopMeta}>{selectedShop.phone}</Text>}
              </View>
              <View style={[styles.accountBadge, outstanding > 0 ? styles.accountBadgeDue : styles.accountBadgeClear]}>
                <Text style={styles.accountBadgeText}>{outstanding > 0 ? 'DUE' : 'CLEAR'}</Text>
              </View>
            </View>
            <View style={styles.compactCreditRow}>
              <View style={styles.compactCreditHeader}>
                <Text style={styles.compactCreditLabel}>Credit used</Text>
                <Text style={styles.compactCreditValue}>{Math.round(creditUsage * 100)}%</Text>
              </View>
              <View style={styles.compactCreditTrack}>
                <View style={[styles.compactCreditFill, { width: `${Math.round(creditUsage * 100)}%` as any }]} />
              </View>
            </View>
          </LinearGradient>

          <View style={styles.compactStatsRow}>
            <View style={styles.compactStat}>
              <Text style={styles.compactStatLabel}>Available</Text>
              <Text style={[styles.compactStatValue, { color: colors.success }]}>{formatCurrency(availableCredit)}</Text>
              <Text style={styles.compactStatUnit}>LKR credit</Text>
            </View>
            <View style={styles.compactStatDivider} />
            <View style={styles.compactStat}>
              <Text style={styles.compactStatLabel}>Outstanding</Text>
              <Text style={[styles.compactStatValue, { color: outstanding > 0 ? colors.danger : colors.text }]}>{formatCurrency(outstanding)}</Text>
              <Text style={styles.compactStatUnit}>LKR due</Text>
            </View>
            <View style={styles.compactStatDivider} />
            <View style={styles.compactStat}>
              <Text style={styles.compactStatLabel}>Bills</Text>
              <Text style={styles.compactStatValue}>{activeBills}/{maxBills}</Text>
              <Text style={styles.compactStatUnit}>active</Text>
            </View>
          </View>

          <View style={styles.compactActionHeader}>
            <Text style={styles.sectionTitle}>Select operation</Text>
          </View>
          <View style={styles.compactActionRow}>
            <TouchableOpacity style={styles.compactActionTile} onPress={() => navigateFlow('catalog')} activeOpacity={0.75}>
              <View style={[styles.compactActionIcon, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="cart-outline" size={24} color={colors.accent} />
              </View>
              <Text style={styles.compactActionTitle}>Order</Text>
              <Text style={styles.compactActionMeta}>New sale</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.compactActionTile} onPress={() => openBillFlow('collection')} activeOpacity={0.75}>
              <View style={[styles.compactActionIcon, { backgroundColor: colors.successSurface }]}>
                <Ionicons name="cash-outline" size={24} color={colors.success} />
              </View>
              <Text style={styles.compactActionTitle}>Collect</Text>
              <Text style={styles.compactActionMeta}>Bill payment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.compactActionTile} onPress={() => openBillFlow('return')} activeOpacity={0.75}>
              <View style={[styles.compactActionIcon, { backgroundColor: colors.warningSurface }]}>
                <Ionicons name="return-down-back-outline" size={24} color={colors.warning} />
              </View>
              <Text style={styles.compactActionTitle}>Return</Text>
              <Text style={styles.compactActionMeta}>Past bill</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    if (flowStep === 'catalog') {
      return (
        <>
          {renderFlowHeader('Build Order', selectedShop?.name)}
          {renderCatalogueFilters(false)}
          <Text style={styles.resultCount}>{filteredProducts.length} Products</Text>
          <View style={styles.flowList}>{filteredProducts.map((product) => renderProductCard(product))}</View>
        </>
      );
    }

    if (flowStep === 'cart') {
      const paidItems = orderItems.filter((item) => item.quantity > 0);
      return (
        <>
          {renderFlowHeader('Your Cart', `${paidItemCount} paid units selected`)}
          <View style={styles.flowList}>
            {paidItems.map((item) => (
              <View key={item.product_id} style={styles.cartItemCard}>
                <View style={styles.cartItemInfo}><Text style={styles.catalogName}>{item.name}</Text><Text style={styles.catalogMeta}>{formatCurrency(item.unit_price)} LKR each</Text></View>
                <View style={styles.stepperRow}>
                  <TouchableOpacity style={styles.stepperButton} onPress={() => updateQuantity(item.product_id, -1)}><Text style={styles.stepperButtonText}>−</Text></TouchableOpacity>
                  <Text style={styles.stepperValue}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.stepperButtonActive} onPress={() => updateQuantity(item.product_id, 1)}><Text style={styles.stepperButtonTextActive}>+</Text></TouchableOpacity>
                </View>
                <Text style={styles.cartLineTotal}>{formatCurrency(item.unit_price * item.quantity)} LKR</Text>
              </View>
            ))}
            {!paidItems.length ? <Text style={styles.emptyText}>Your cart is empty. Go back and add products.</Text> : null}
          </View>
        </>
      );
    }

    if (flowStep === 'free') {
      return (
        <>
          {renderFlowHeader('Add Free Items', 'Free products can only be added as individual units.')}
          {renderCatalogueFilters(false)}
          <View style={styles.flowList}>{filteredProducts.map((product) => renderProductCard(product, true))}</View>
        </>
      );
    }

    if (flowStep === 'summary') {
      return (
        <>
          {renderFlowHeader('Order Summary', selectedShop?.name)}
          <View style={styles.summaryDetailCard}>
            {orderItems.map((item) => (
              <View key={item.product_id} style={styles.summaryLine}>
                <View style={styles.summaryLineInfo}><Text style={styles.catalogName}>{item.name}</Text><Text style={styles.catalogMeta}>{item.quantity} paid{item.free_quantity ? ` + ${item.free_quantity} free` : ''}</Text></View>
                <Text style={styles.cartLineTotal}>{formatCurrency(item.quantity * item.unit_price)} LKR</Text>
              </View>
            ))}
            <View style={styles.summaryGrandTotal}><Text style={styles.summaryGrandLabel}>Total</Text><Text style={styles.summaryGrandValue}>{formatCurrency(orderTotal)} LKR</Text></View>
          </View>
          {noBillSlots ? <View style={styles.creditWarningDanger}><Text style={styles.creditWarningDangerText}>This shop has no bill slots left. The order may be rejected.</Text></View> : null}
          {exceedsCredit ? <View style={styles.creditWarningAmber}><Text style={styles.creditWarningAmberText}>Order exceeds available credit by {formatCurrency(orderTotal - availableCredit)} LKR.</Text></View> : null}
          <TouchableOpacity style={[styles.placeOrderButton, (!orderItems.length || submitting) && styles.buttonDisabled]} onPress={handleSubmitOrder} disabled={!orderItems.length || submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.placeOrderText}>Place Order</Text>}
          </TouchableOpacity>
        </>
      );
    }

    if (flowStep === 'bills') {
      return (
        <>
          {renderFlowHeader(billMode === 'collection' ? 'Select Bill to Collect' : 'Select Bill to Return', selectedShop?.name)}
          {billsLoading ? <ActivityIndicator color={colors.accent} /> : (
            <View style={styles.flowList}>
              {shopBills.map((bill) => (
                <TouchableOpacity key={bill.id} style={styles.billCard} onPress={() => chooseBill(bill)}>
                  <View>
                    <Text style={styles.billNumber}>Bill #{bill.id.slice(0, 8).toUpperCase()}</Text>
                    <Text style={styles.catalogMeta}>{formatBillDate(bill.created_at)}</Text>
                  </View>
                  <View style={styles.shopListSide}><Text style={styles.shopOutstanding}>{formatCurrency(bill.outstanding)} LKR</Text><Text style={styles.shopListMeta}>Outstanding</Text></View>
                </TouchableOpacity>
              ))}
              {!shopBills.length ? (
                <Text style={styles.emptyText}>No approved bills with an outstanding balance.</Text>
              ) : null}
            </View>
          )}
        </>
      );
    }

    if (flowStep === 'payment' && selectedBill) {
      return (
        <>
          {renderFlowHeader('Record Collection', selectedShop?.name)}
          <View style={styles.summaryDetailCard}>
            <Text style={styles.modalLabel}>Bill</Text><Text style={styles.catalogName}>#{selectedBill.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.modalLabel}>Outstanding</Text><Text style={styles.summaryGrandValue}>{formatCurrency(selectedBill.outstanding)} LKR</Text>
            <TextInput placeholder="Amount" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" style={styles.searchInput} value={collectionAmount} onChangeText={setCollectionAmount} />
            <TextInput placeholder="Notes (optional)" placeholderTextColor={colors.textMuted} style={[styles.searchInput, styles.notesInput]} multiline value={collectionNotes} onChangeText={setCollectionNotes} />
            <TouchableOpacity style={[styles.placeOrderButton, billActionLoading && styles.buttonDisabled]} onPress={submitCollection} disabled={billActionLoading}><Text style={styles.placeOrderText}>{billActionLoading ? 'Recording...' : 'Record Collection'}</Text></TouchableOpacity>
          </View>
        </>
      );
    }

    if (flowStep === 'return' && selectedBill) {
      return (
        <>
          {renderFlowHeader('Return Products', `Bill #${selectedBill.id.slice(0, 8).toUpperCase()}`)}
          <View style={styles.flowList}>
            {returnItems.map((item) => (
              <View key={item.order_item_id} style={styles.returnFlowRow}>
                <View style={styles.cartItemInfo}><Text style={styles.catalogName}>{item.name}</Text><Text style={styles.catalogMeta}>Ordered: {item.quantity} · {formatCurrency(item.unit_price)} LKR</Text></View>
                <TextInput placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="number-pad" style={styles.returnFlowInput} value={returnQuantities[item.order_item_id] ? String(returnQuantities[item.order_item_id]) : ''} onChangeText={(value) => setReturnQuantities((current) => ({ ...current, [item.order_item_id]: Number(value) || 0 }))} />
              </View>
            ))}
          </View>
          <TouchableOpacity style={[styles.placeOrderButton, billActionLoading && styles.buttonDisabled]} onPress={submitShopReturn} disabled={billActionLoading}><Text style={styles.placeOrderText}>{billActionLoading ? 'Recording...' : 'Record Return'}</Text></TouchableOpacity>
        </>
      );
    }
    return null;
  };

  const renderFlowFooter = () => {
    if (!['catalog', 'cart', 'free'].includes(flowStep)) return null;
    const nextStep: FlowStep = flowStep === 'catalog' ? 'free' : flowStep === 'cart' ? 'free' : 'summary';
    return (
      <View style={[styles.flowBottomBar, { marginBottom: bottomTabBarHeight + 8 }]}>
        <TouchableOpacity style={styles.cartButton} onPress={() => navigateFlow('cart')}>
          <Ionicons name="cart" size={25} color={colors.accent} />
          <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{paidProductCount}</Text></View>
        </TouchableOpacity>
        <View style={styles.bottomTotal}><Text style={styles.bottomTotalLabel}>{freeItemCount ? `${freeItemCount} free units · ` : ''}Total</Text><Text style={styles.bottomTotalValue}>{formatCurrency(orderTotal)} LKR</Text></View>
        <TouchableOpacity style={styles.nextArrow} onPress={() => navigateFlow(nextStep)} disabled={flowStep !== 'free' && paidItemCount === 0}>
          <Ionicons name="chevron-forward" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderFixedListHeader = () => {
    if (flowStep === 'shops') {
      return (
        <View style={styles.fixedTopSection}>
          {renderFlowHeader('Select Shop', 'Choose a shop to order, collect, or return products.')}
          <TextInput
            placeholder="Search shop name, address, or phone..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            value={shopSearch}
            onChangeText={setShopSearch}
          />
        </View>
      );
    }
    return (
      <View style={styles.fixedTopSection}>
        {renderFlowHeader(
          flowStep === 'free' ? 'Add Free Items' : 'Build Order',
          flowStep === 'free' ? 'Free products use individual units only.' : selectedShop?.name,
        )}
        {renderCatalogueFilters(false)}
      </View>
    );
  };

  const renderFixedListBody = () => {
    if (flowStep === 'shops') {
      return (
        <View style={styles.flowList}>
          {filteredShops.map((shop) => (
            <TouchableOpacity key={shop.id} style={styles.shopListCard} onPress={() => chooseShop(shop)}>
              <View style={styles.shopListMain}>
                <Text style={styles.shopListName}>{shop.name}</Text>
                <Text style={styles.shopListMeta}>{shop.address}</Text>
                {!!shop.phone && <Text style={styles.shopListMeta}>{shop.phone}</Text>}
              </View>
              <View style={styles.shopListSide}>
                <Text style={styles.shopOutstanding}>{formatCurrency(shop.current_outstanding)} LKR</Text>
                <Text style={styles.shopListMeta}>Outstanding</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.accent} />
              </View>
            </TouchableOpacity>
          ))}
          {!filteredShops.length ? <Text style={styles.emptyText}>No shops found.</Text> : null}
        </View>
      );
    }
    const freeOnly = flowStep === 'free';
    return (
      <>
        <Text style={styles.resultCount}>{filteredProducts.length} Products</Text>
        <View style={styles.flowList}>{filteredProducts.map((product) => renderProductCard(product, freeOnly))}</View>
      </>
    );
  };

  const showLegacyOrderForm: boolean = false;
  const hasFixedListHeader = flowStep === 'shops' || flowStep === 'catalog' || flowStep === 'free';


  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.centerText}>Loading order setup...</Text>
      </View>
    );
  }

  return (
      <View style={styles.flowRoot}>
      {hasFixedListHeader ? (
        <>
          {renderFixedListHeader()}
          {flowStep === 'shops' ? (
            <FlatList
              style={styles.fixedListScroll}
              contentContainerStyle={styles.fixedListContent}
              data={filteredShops}
              keyExtractor={(shop) => shop.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              nestedScrollEnabled
              ItemSeparatorComponent={() => <View style={styles.fixedListSeparator} />}
              ListEmptyComponent={<Text style={styles.emptyText}>No shops found.</Text>}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
              renderItem={({ item: shop }) => (
                <TouchableOpacity style={styles.shopListCard} onPress={() => chooseShop(shop)}>
                  <View style={styles.shopListMain}>
                    <Text style={styles.shopListName}>{shop.name}</Text>
                    <Text style={styles.shopListMeta}>{shop.address}</Text>
                    {!!shop.phone && <Text style={styles.shopListMeta}>{shop.phone}</Text>}
                  </View>
                  <View style={styles.shopListSide}>
                    <Text style={styles.shopOutstanding}>{formatCurrency(shop.current_outstanding)} LKR</Text>
                    <Text style={styles.shopListMeta}>Outstanding</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.accent} />
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : (
            <FlatList
              style={styles.fixedListScroll}
              contentContainerStyle={styles.fixedListContent}
              data={filteredProducts}
              keyExtractor={(product) => product.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              nestedScrollEnabled
              ItemSeparatorComponent={() => <View style={styles.fixedListSeparator} />}
              ListHeaderComponent={<Text style={styles.resultCount}>{filteredProducts.length} Products</Text>}
              ListEmptyComponent={<Text style={styles.emptyText}>No products match these filters.</Text>}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
              renderItem={({ item: product }) => renderProductCard(product, flowStep === 'free')}
            />
          )}
        </>
      ) : (
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 16 }]}
        scrollIndicatorInsets={{ bottom: 16 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {showLegacyOrderForm ? (
          <>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Create Order</Text>
            <Text style={styles.subtitle}>Build a new order for your assigned shops.</Text>
          </View>
          <TouchableOpacity style={styles.clearButton} onPress={handleClearPress}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

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
              {!!selectedShop.phone && <Text style={styles.shopMeta}>{selectedShop.phone}</Text>}
              <View style={styles.shopStatGrid}>
                <View style={styles.shopStatItem}>
                  <Text style={styles.shopStatLabel}>Available Credit</Text>
                  <Text style={[styles.shopStatValue, { color: colors.accent }]}>
                    {Math.max(0, Number(selectedShop.max_bill_amount) - Number(selectedShop.current_outstanding)).toFixed(2)} LKR
                  </Text>
                </View>
                <View style={styles.shopStatItem}>
                  <Text style={styles.shopStatLabel}>Available Bills</Text>
                  <Text style={[styles.shopStatValue, { color: colors.accent }]}>
                    {Math.max(0, Number(selectedShop.max_active_bills) - Number(selectedShop.active_bills))} / {selectedShop.max_active_bills}
                  </Text>
                </View>
                <View style={styles.shopStatItem}>
                  <Text style={styles.shopStatLabel}>Outstanding</Text>
                  <Text style={[styles.shopStatValue, Number(selectedShop.current_outstanding) > 0 ? styles.shopStatDanger : styles.shopStatSafe]}>
                    {Number(selectedShop.current_outstanding).toFixed(2)} LKR
                  </Text>
                </View>
                <View style={styles.shopStatItem}>
                  <Text style={styles.shopStatLabel}>Active Bills</Text>
                  <Text style={[styles.shopStatValue, Number(selectedShop.active_bills) >= Number(selectedShop.max_active_bills) ? styles.shopStatDanger : styles.shopStatSafe]}>
                    {selectedShop.active_bills}
                  </Text>
                </View>
              </View>
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

          <TouchableOpacity
            style={styles.freeToggleRow}
            onPress={() => setAddAsFree((prev) => !prev)}
            activeOpacity={0.7}
          >
            <View style={[styles.freeToggleBox, addAsFree && styles.freeToggleBoxChecked]}>
              {addAsFree ? <Text style={styles.freeToggleCheck}>✓</Text> : null}
            </View>
            <Text style={styles.freeToggleLabel}>Add as free item (no charge)</Text>
          </TouchableOpacity>

          <View style={styles.unitToggleRow}>
            <TouchableOpacity
              style={[styles.unitToggleOption, !orderByCase && styles.unitToggleOptionActive]}
              onPress={() => setOrderByCase(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.unitToggleText, !orderByCase && styles.unitToggleTextActive]}>
                Units
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unitToggleOption, orderByCase && styles.unitToggleOptionActive]}
              onPress={() => setOrderByCase(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.unitToggleText, orderByCase && styles.unitToggleTextActive]}>
                Cases (1 = {selectedProduct ? getCaseSize(selectedProduct) : DEFAULT_CASE_SIZE})
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TextInput
              placeholder={orderByCase ? 'Cases' : 'Qty'}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.qtyInput]}
              keyboardType="numeric"
              value={quantity}
              onChangeText={setQuantity}
            />
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, !selectedProduct && styles.buttonDisabled]}
              onPress={() => addItem(false)}
              disabled={!selectedProduct}
            >
              <Text style={styles.buttonTextSecondary}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, !selectedProduct && styles.buttonDisabled]}
              onPress={() => addItem(true)}
              disabled={!selectedProduct}
            >
              <Text style={styles.buttonText}>Add & Next</Text>
            </TouchableOpacity>
          </View>

          {orderItems.length > 0 ? (
            <FlatList
              data={orderItems}
              keyExtractor={(item) => item.product_id}
              scrollEnabled={false}
              contentContainerStyle={styles.itemsList}
              renderItem={({ item }) => {
                const itemCaseSize = getCaseSize(item);
                return (
                <View style={styles.itemCard}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>{formatCurrency(item.unit_price)} LKR</Text>
                    {item.quantity >= itemCaseSize && item.quantity % itemCaseSize === 0 ? (
                      <Text style={styles.itemMeta}>
                        {item.quantity / itemCaseSize} case{item.quantity / itemCaseSize === 1 ? '' : 's'}
                      </Text>
                    ) : null}
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
                );
              }}
            />
          ) : (
            <Text style={styles.emptyText}>No items added yet.</Text>
          )}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Order Total</Text>
          <Text style={styles.summaryValue}>{formatCurrency(orderTotal)} LKR</Text>
        </View>

        {noBillSlots ? (
          <View style={styles.creditWarningDanger}>
            <Text style={styles.creditWarningDangerText}>
              This shop has no bill slots left ({selectedShop?.active_bills}/{selectedShop?.max_active_bills} active). The order may be rejected.
            </Text>
          </View>
        ) : null}

        {exceedsCredit ? (
          <View style={styles.creditWarningAmber}>
            <Text style={styles.creditWarningAmberText}>
              Order total exceeds available credit by {formatCurrency(orderTotal - availableCredit)} LKR (available: {formatCurrency(availableCredit)} LKR).
            </Text>
          </View>
        ) : null}

        {hasEmptyItems ? (
          <Text style={styles.errorText}>
            Some items have no paid or free quantity. Set a quantity or remove them.
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.submitButton, (!selectedShop || orderItems.length === 0 || hasEmptyItems) && styles.buttonDisabled]}
          onPress={() => setShowConfirm(true)}
          disabled={!selectedShop || orderItems.length === 0 || hasEmptyItems}
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
                        {item.quantity > 0 ? `x${item.quantity}` : ''}
                        {item.free_quantity > 0
                          ? `${item.quantity > 0 ? ' + ' : ''}${item.free_quantity} free`
                          : ''}
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
          </>
        ) : (
          <>
            {renderStepContent()}
          </>
        )}

      </ScrollView>
      )}
      {renderFlowFooter()}

        <Modal
          visible={!!quantityEntry}
          transparent
          animationType="fade"
          onRequestClose={closeQuantityEntry}
        >
          <KeyboardAvoidingView
            style={styles.modalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.quantityEntryCard}>
              <View style={styles.quantityEntryHeader}>
                <View style={styles.quantityEntryIcon}>
                  <Ionicons
                    name={quantityEntry?.mode === 'case' ? 'cube-outline' : 'beer-outline'}
                    size={22}
                    color={colors.accent}
                  />
                </View>
                <View style={styles.quantityEntryTitleWrap}>
                  <Text style={styles.quantityEntryTitle}>
                    {quantityEntry?.mode === 'case' ? 'Enter Cases' : 'Enter Individual Units'}
                  </Text>
                  <Text style={styles.quantityEntryProduct} numberOfLines={2}>
                    {quantityEntry?.product.name}
                  </Text>
                </View>
              </View>
              <TextInput
                autoFocus
                selectTextOnFocus
                keyboardType="number-pad"
                returnKeyType="done"
                value={quantityEntryValue}
                onChangeText={(value) => setQuantityEntryValue(value.replace(/[^0-9]/g, ''))}
                onSubmitEditing={applyQuantityEntry}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                style={styles.quantityEntryInput}
                maxLength={6}
              />
              <Text style={styles.quantityEntryHelp}>
                {quantityEntry?.mode === 'case'
                  ? `1 case = ${quantityEntry ? getCaseSize(quantityEntry.product) : 0} units`
                  : `Enter loose units from 0 to ${quantityEntry ? getCaseSize(quantityEntry.product) - 1 : 0}`}
              </Text>
              <View style={styles.quantityEntryActions}>
                <TouchableOpacity style={styles.quantityEntryCancel} onPress={closeQuantityEntry}>
                  <Text style={styles.quantityEntryCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quantityEntryApply} onPress={applyQuantityEntry}>
                  <Text style={styles.quantityEntryApplyText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
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
                  Printer:{' '}
                  {Platform.OS === 'ios'
                    ? selectedIosPrinterName || 'Not selected'
                    : selectedPrinterMac || 'Not selected'}
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
                    style={[styles.actionSecondary, (printing || loadingPrinters) && styles.buttonDisabled]}
                    onPress={openPrinterPicker}
                    disabled={printing || loadingPrinters}
                  >
                    <Text style={styles.actionText}>
                      Choose Printer
                    </Text>
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
                  <Text style={styles.centerText}>
                    {Platform.OS === 'ios' ? 'Scanning Bluetooth printers...' : 'Loading paired printers...'}
                  </Text>
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
                <Text style={styles.emptyText}>
                  {Platform.OS === 'ios'
                    ? 'No BLE printers found.'
                    : 'No paired Bluetooth printers found.'}
                </Text>
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
          <KeyboardAvoidingView
            style={styles.modalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
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
                keyExtractor={(item, index) => `${item.id ?? 'product'}-${index}`}
                style={styles.productList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      if ((Number(item.available_stock) || 0) <= 0) {
                        Alert.alert('Out of Stock', `${item.name} has no available stock.`);
                        return;
                      }
                      setSelectedProduct(item);
                      setProductSearch('');
                      setShowProductPicker(false);
                    }}
                  >
                    <View style={styles.dropdownItemLeft}>
                      <Text style={styles.dropdownTitle}>{item.name}</Text>
                      <Text style={styles.dropdownSubtitle}>{formatCurrency(item.unit_price)} LKR</Text>
                    </View>
                    <Text style={[
                      styles.dropdownStock,
                      item.available_stock === 0 ? styles.stockZero :
                      item.available_stock <= 5 ? styles.stockLow :
                      styles.stockOk,
                    ]}>
                      {item.available_stock}
                    </Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={styles.actionSecondary} onPress={() => setShowProductPicker(false)}>
                <Text style={styles.actionText}>Close</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={showShopPicker} transparent animationType="slide" onRequestClose={() => setShowShopPicker(false)}>
          <KeyboardAvoidingView
            style={styles.modalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
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
                keyExtractor={(item, index) => `${item.id ?? 'shop'}-${index}`}
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
          </KeyboardAvoidingView>
        </Modal>

        {/* Error popup */}
        <Modal visible={!!error} transparent animationType="fade" onRequestClose={() => setError('')}>
          <View style={styles.modalBackdrop}>
            <View style={styles.errorModalCard}>
              <View style={styles.errorIconWrap}>
                <Text style={styles.errorIconText}>✕</Text>
              </View>
              <Text style={styles.errorModalTitle}>Something went wrong</Text>
              <Text style={styles.errorModalMessage}>{error}</Text>
              <TouchableOpacity style={styles.errorModalButton} onPress={() => setError('')}>
                <Text style={styles.errorModalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.background,
    gap: 16,
  },
  flowRoot: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.background,
  },
  fixedTopSection: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fixedListScroll: {
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  fixedListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  fixedListSeparator: { height: 8 },
  flowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  flowList: {
    gap: 12,
  },
  shopListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    gap: 12,
  },
  shopListMain: { flex: 1, gap: 3 },
  shopListName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  shopListMeta: { color: colors.textMuted, fontSize: 12 },
  shopListSide: { alignItems: 'flex-end', gap: 2 },
  shopOutstanding: { color: colors.danger, fontWeight: '800', fontSize: 14 },
  compactShopHero: {
    borderRadius: 16,
    padding: 13,
    gap: 10,
  },
  compactShopTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compactShopIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  compactShopIdentity: { flex: 1, gap: 1 },
  compactShopName: { color: '#fff', fontSize: 16, fontWeight: '900' },
  compactShopMeta: { color: 'rgba(255,255,255,0.82)', fontSize: 11 },
  compactCreditRow: { gap: 5, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)' },
  compactCreditHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  compactCreditLabel: { color: 'rgba(255,255,255,0.82)', fontSize: 10, fontWeight: '700' },
  compactCreditValue: { color: '#fff', fontSize: 10, fontWeight: '900' },
  compactCreditTrack: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.22)' },
  compactCreditFill: { height: '100%', borderRadius: 3, backgroundColor: '#fff' },
  compactStatsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
    paddingHorizontal: 6,
  },
  compactStat: { flex: 1, alignItems: 'center', gap: 2 },
  compactStatDivider: { width: 1, backgroundColor: colors.border },
  compactStatLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  compactStatValue: { color: colors.text, fontSize: 14, fontWeight: '900' },
  compactStatUnit: { color: colors.textMuted, fontSize: 9 },
  compactActionHeader: { marginTop: 1 },
  compactActionRow: { flexDirection: 'row', gap: 8 },
  compactActionTile: {
    flex: 1,
    minHeight: 104,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    gap: 4,
  },
  compactActionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  compactActionTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  compactActionMeta: { color: colors.textMuted, fontSize: 9, textAlign: 'center' },
  shopHeroCard: {
    borderRadius: 20,
    padding: 17,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  shopHeroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shopAvatar: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopHeroIdentity: { flex: 1, gap: 3 },
  shopHeroName: { color: '#fff', fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  shopHeroAddress: { color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 17 },
  accountBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  accountBadgeDue: { backgroundColor: 'rgba(127,29,29,0.34)', borderColor: 'rgba(255,255,255,0.28)' },
  accountBadgeClear: { backgroundColor: 'rgba(6,78,59,0.34)', borderColor: 'rgba(255,255,255,0.28)' },
  accountBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  shopContactRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 11, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)' },
  shopContactText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  shopDetailCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 17,
  },
  shopMetricRow: { flexDirection: 'row', alignItems: 'stretch' },
  shopMetric: { flex: 1, alignItems: 'center', gap: 3 },
  shopMetricDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 10 },
  metricIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  shopMetricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  shopMetricValue: { color: colors.text, fontSize: 17, fontWeight: '900' },
  shopMetricUnit: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  capacitySection: { gap: 7, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  capacityHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  capacityLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  capacityValue: { color: colors.text, fontSize: 12, fontWeight: '900' },
  capacityTrack: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  capacityFill: { height: '100%', borderRadius: 4, backgroundColor: colors.accent },
  billCapacityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  billCapacityText: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 3 },
  slotBadge: { flexDirection: 'row', alignItems: 'baseline', gap: 4, backgroundColor: colors.accentSoft, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8 },
  slotBadgeValue: { color: colors.accent, fontSize: 17, fontWeight: '900' },
  slotBadgeLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  actionSectionHeader: { gap: 3, marginTop: 2 },
  actionSectionMeta: { color: colors.textMuted, fontSize: 12 },
  actionGrid: { gap: 10 },
  actionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 15,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  actionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionTextGroup: { flex: 1, gap: 3 },
  actionTileTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  actionTileMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  filtersCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  filterSection: { gap: 6 },
  filterLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  filterRow: { gap: 7, paddingRight: 8 },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterChipText: { color: colors.textSubtle, fontWeight: '700', fontSize: 12 },
  filterChipTextActive: { color: '#fff' },
  resultCount: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 8 },
  catalogCard: {
    backgroundColor: colors.surface,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 8,
  },
  catalogInfo: { gap: 2 },
  catalogHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  catalogName: { color: colors.text, fontWeight: '800', fontSize: 13, flex: 1, lineHeight: 17 },
  catalogMeta: { color: colors.textMuted, fontSize: 12 },
  catalogStockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  catalogPrice: { color: colors.text, fontWeight: '700' },
  catalogStock: { fontSize: 10, fontWeight: '800' },
  purchasePanels: { flexDirection: 'row', gap: 7 },
  quantityPanel: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 7,
    gap: 3,
  },
  quantityPanelSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  quantityPanelTapArea: {
    gap: 3,
  },
  quantityQuickActions: {
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 9,
    paddingTop: 9,
    paddingHorizontal: 1,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quantityPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  quantityPanelPrice: { color: colors.text, fontSize: 11, fontWeight: '800' },
  quantityPanelLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  directQuantity: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
  },
  directQuantityValue: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '900',
  },
  directQuantityHint: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  freeCompactPanel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceMuted, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 9, paddingVertical: 6 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 2 },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  stepperButtonActive: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  stepperButtonDisabled: { opacity: 0.35 },
  stepperButtonText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  stepperButtonTextActive: { color: '#fff', fontSize: 18, fontWeight: '800' },
  stepperValue: { color: colors.text, minWidth: 20, textAlign: 'center', fontWeight: '800', fontSize: 12 },
  cartItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
  },
  cartItemInfo: { flex: 1, gap: 3 },
  cartLineTotal: { color: colors.text, fontWeight: '800', textAlign: 'right' },
  summaryDetailCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    gap: 13,
  },
  summaryLine: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryLineInfo: { flex: 1, gap: 3 },
  summaryGrandTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  summaryGrandLabel: { color: colors.textMuted, fontWeight: '800', textTransform: 'uppercase' },
  summaryGrandValue: { color: colors.accent, fontSize: 22, fontWeight: '900' },
  placeOrderButton: { backgroundColor: colors.accent, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  placeOrderText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  billCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    gap: 12,
  },
  billNumber: { color: colors.text, fontWeight: '800' },
  notesInput: { minHeight: 84, textAlignVertical: 'top' },
  returnFlowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 13 },
  returnFlowInput: { width: 72, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted, color: colors.text, textAlign: 'center' },
  flowBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 12,
    marginTop: 8,
    marginHorizontal: 12,
  },
  cartButton: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  cartBadge: { position: 'absolute', right: -4, top: -5, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  bottomTotal: { flex: 1 },
  bottomTotalLabel: { color: colors.textMuted, fontSize: 11 },
  bottomTotalValue: { color: colors.accent, fontSize: 19, fontWeight: '900' },
  nextArrow: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  clearButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  clearButtonText: {
    color: colors.danger,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  dropdownTitle: {
    color: colors.text,
    fontWeight: '600',
  },
  dropdownSubtitle: {
    color: colors.textMuted,
    marginTop: 4,
  },
  dropdownStock: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'right',
  },
  stockZero: { color: '#ef4444' },
  stockLow: { color: '#f59e0b' },
  stockOk: { color: '#22c55e' },
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
    marginBottom: 2,
  },
  shopMeta: {
    color: colors.textSubtle,
    marginBottom: 8,
  },
  shopStatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  shopStatItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 8,
  },
  shopStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  shopStatValue: {
    fontWeight: '700',
    fontSize: 13,
  },
  shopStatDanger: { color: '#ef4444' },
  shopStatSafe: { color: '#22c55e' },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  freeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  freeToggleBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeToggleBoxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  freeToggleCheck: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  freeToggleLabel: {
    color: colors.textSubtle,
    fontSize: 13,
    fontWeight: '600',
  },
  unitToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  unitToggleOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  unitToggleOptionActive: {
    backgroundColor: colors.accent,
  },
  unitToggleText: {
    color: colors.textSubtle,
    fontSize: 13,
    fontWeight: '700',
  },
  unitToggleTextActive: {
    color: colors.background,
  },
  creditWarningAmber: {
    backgroundColor: colors.warningSurface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  creditWarningAmberText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '600',
  },
  creditWarningDanger: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  creditWarningDangerText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
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
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  buttonText: {
    color: colors.background,
    fontWeight: '700',
  },
  buttonTextSecondary: {
    color: colors.accent,
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
  quantityEntryCard: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  quantityEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  quantityEntryIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  quantityEntryTitleWrap: {
    flex: 1,
    gap: 2,
  },
  quantityEntryTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  quantityEntryProduct: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  quantityEntryInput: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 14,
  },
  quantityEntryHelp: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  quantityEntryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  quantityEntryCancel: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quantityEntryCancelText: {
    color: colors.text,
    fontWeight: '800',
  },
  quantityEntryApply: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  quantityEntryApplyText: {
    color: '#fff',
    fontWeight: '900',
  },
  receiptCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
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
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  receiptValue: {
    color: colors.text,
    fontSize: 13,
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
    paddingHorizontal: 7,
    paddingVertical: 7,
    fontSize: 12,
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
    fontSize: 12,
  },
  receiptFooter: {
    marginTop: 8,
    alignItems: 'center',
    gap: 4,
  },
  receiptFooterText: {
    color: colors.textMuted,
    fontSize: 12,
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
  errorModalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  errorIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  errorIconText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  errorModalTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorModalMessage: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorModalButton: {
    marginTop: 6,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  errorModalButtonText: {
    color: colors.background,
    fontWeight: '800',
    fontSize: 15,
  },
});
