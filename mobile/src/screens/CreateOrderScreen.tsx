import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
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

const formatCurrency = (value: number | string | null | undefined) =>
  Number(value || 0).toFixed(2);

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
  const [sendingSMS, setSendingSMS] = useState(false);
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
        contentContainerStyle={styles.container}
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

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.actionSecondary}
                  onPress={() => {
                    setShowReceipt(false);
                  }}
                >
                  <Text style={styles.actionText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionPrimary} onPress={() => {}}>
                  <Text style={styles.actionTextOnAccent}>Print Receipt</Text>
                </TouchableOpacity>
              </View>
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
    gap: 12,
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
});
