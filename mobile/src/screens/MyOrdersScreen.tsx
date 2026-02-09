import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { apiFetch } from '../api/api';
import { ThemeColors, useThemeColors } from '../theme/colors';

interface Order {
  id: string;
  shop_name: string;
  created_at: string;
  total: number;
  item_count: number;
  status: string;
}

interface OrderItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total: number;
  line_key?: string;
}

interface Product {
  id: string;
  name: string;
  unit_price: number;
}

interface EditOrderItem extends OrderItem {
  line_key: string;
}

interface DetailedOrder extends Order {
  items?: OrderItem[];
  shop?: {
    name: string;
    address: string;
    phone: string;
  };
}

const formatCurrency = (value: number | string | null | undefined) =>
  Number(value || 0).toFixed(2);

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

const formatDate = (value: string | number | null | undefined, withTime = false) => {
  const d = parseDate(value);
  if (!d) return '--';
  return withTime ? d.toLocaleString() : d.toLocaleDateString();
};

const statusOptions = ['all', 'pending', 'approved', 'rejected'];

export default function MyOrdersScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showPending, setShowPending] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DetailedOrder | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [messageStatus, setMessageStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  // Edit order state
  const [editOrder, setEditOrder] = useState<DetailedOrder | null>(null);
  const [editItems, setEditItems] = useState<EditOrderItem[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [newProductId, setNewProductId] = useState('');
  const [newProductQty, setNewProductQty] = useState('1');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedEditProduct, setSelectedEditProduct] = useState<Product | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [ordersData, pendingData] = await Promise.all([
        apiFetch('/api/marudham/orders'),
        apiFetch('/api/marudham/orders/pending'),
      ]);
      setOrders(ordersData.orders || []);
      setPendingOrders(pendingData.orders || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders]),
  );

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((order) => {
      const matchesSearch =
        order.shop_name.toLowerCase().includes(q) ||
        order.status.toLowerCase().includes(q) ||
        String(order.total).includes(q);
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return products.filter((product) => product.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  const openOrder = async (order: Order) => {
    setLoadingDetails(true);
    setMessageStatus({ type: null, message: '' });
    try {
      const response = await apiFetch(`/api/marudham/orders/${order.id}/details`);
      setSelectedOrder(response.order || order);
    } catch {
      setSelectedOrder(order);
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadProducts = async (force = false) => {
    if (!force && products.length > 0) return products;
    const response = await apiFetch('/api/marudham/order-products');
    const loaded = (response.products || []).map((product: any) => ({
      id: product.id,
      name: product.name,
      unit_price: Number(product.unit_price),
    }));
    setProducts(loaded);
    return loaded;
  };

  const openProductPicker = async () => {
    setProductSearch('');
    setProductsError('');
    setShowProductPicker(true);
    setProductsLoading(true);
    try {
      await loadProducts(true);
    } catch (err: any) {
      setProductsError(err.message || 'Failed to load products.');
    } finally {
      setProductsLoading(false);
    }
  };

  const handleEditOrder = async (order: Order) => {
    setEditLoading(true);
    setEditError('');
    try {
      const [details] = await Promise.all([
        apiFetch(`/api/marudham/orders/${order.id}/details`),
        loadProducts(),
      ]);
      const loadedOrder = details.order || order;
      setEditOrder(loadedOrder);
      setEditNotes(loadedOrder.notes || '');
      setEditItems(
        (loadedOrder.items || []).map((item: OrderItem, index: number) => ({
          ...item,
          line_key: item.line_key || `${item.product_id}-${item.unit_price}-${index}-${Date.now()}`,
        })),
      );
    } catch (err: any) {
      setEditError(err.message || 'Failed to load order for editing.');
    } finally {
      setEditLoading(false);
    }
  };

  const saveEditOrder = async () => {
    if (!editOrder) return;
    if (!editItems.length) {
      setEditError('Add at least one item.');
      return;
    }
    setEditLoading(true);
    setEditError('');
    try {
      await apiFetch(`/api/marudham/orders/${editOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          notes: editNotes,
          items: editItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
        }),
      });
      setEditOrder(null);
      setEditItems([]);
      setEditNotes('');
      setNewProductId('');
      setNewProductQty('1');
      fetchOrders();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update order.');
    } finally {
      setEditLoading(false);
    }
  };

  const addEditItem = () => {
    const quantity = Number(newProductQty);
    const product = selectedEditProduct || products.find((p) => p.id === newProductId);
    if (!product || !quantity || quantity <= 0) return;

    setEditItems((prev) => {
      const existing = prev.find(
        (item) => item.product_id === product.id && item.unit_price === product.unit_price,
      );
      if (existing) {
        return prev.map((item) =>
          item.line_key === existing.line_key
            ? {
                ...item,
                quantity: item.quantity + quantity,
                total: (item.quantity + quantity) * item.unit_price,
              }
            : item,
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          unit_price: product.unit_price,
          quantity,
          total: product.unit_price * quantity,
          line_key: `${product.id}-${product.unit_price}-${Date.now()}`,
        },
      ];
    });
    setNewProductId('');
    setNewProductQty('1');
    setSelectedEditProduct(null);
    setProductSearch('');
    setShowProductPicker(false);
  };

  const sendSMS = async () => {
    if (!selectedOrder) return;
    setSendingSMS(true);
    setMessageStatus({ type: null, message: '' });
    try {
      const response = await apiFetch(`/api/marudham/orders/${selectedOrder.id}/send-sms`, {
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

  const sendWhatsApp = async () => {
    if (!selectedOrder) return;
    setSendingWhatsApp(true);
    setMessageStatus({ type: null, message: '' });
    try {
      const response = await apiFetch(`/api/marudham/orders/${selectedOrder.id}/send-whatsapp`, {
        method: 'POST',
      });
      if (response.success) {
        setMessageStatus({ type: 'success', message: 'WhatsApp message sent successfully.' });
      } else {
        setMessageStatus({ type: 'error', message: response.error || 'Failed to send WhatsApp' });
      }
    } catch (err: any) {
      setMessageStatus({ type: 'error', message: err.message || 'Failed to send WhatsApp' });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.centerText}>Loading orders...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Error loading orders</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={fetchOrders}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={<Text style={styles.emptyText}>No orders found.</Text>}
          ListHeaderComponent={
            <View>
              <View style={styles.headerCard}>
                <Text style={styles.title}>My Orders</Text>
                <Text style={styles.subtitle}>Track order status and send receipts.</Text>
                <TextInput
                  placeholder="Search by shop, status, or amount"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={search}
                  onChangeText={setSearch}
                />

                <View style={styles.filterRow}>
                  {statusOptions.map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[styles.filterPill, statusFilter === status && styles.filterPillActive]}
                      onPress={() => setStatusFilter(status)}
                    >
                      <Text style={[styles.filterText, statusFilter === status && styles.filterTextActive]}>
                        {status === 'all' ? 'All' : status}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {pendingOrders.length > 0 && (
                  <TouchableOpacity style={styles.pendingButton} onPress={() => setShowPending(!showPending)}>
                    <Text style={styles.pendingButtonText}>
                      {showPending ? 'Hide Pending' : 'Pending Orders'} ({pendingOrders.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {showPending && (
                <View style={styles.pendingCard}>
                  <Text style={styles.pendingTitle}>Pending Orders</Text>
                  {pendingOrders.map((order) => (
                    <View key={order.id} style={styles.listRow}>
                      <View style={styles.listText}>
                        <Text style={styles.listTitle}>{order.shop_name}</Text>
                <Text style={styles.listCaption}>{formatDate(order.created_at)}</Text>
                      </View>
                      <View style={styles.listActions}>
                        <TouchableOpacity style={styles.listActionButton} onPress={() => openOrder(order)}>
                          <Text style={styles.listActionText}>View</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.listActionButtonAlt} onPress={() => handleEditOrder(order)}>
                          <Text style={styles.listActionTextAlt}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{item.shop_name}</Text>
                <Text style={styles.cardSubtitle}>{formatDate(item.created_at)}</Text>
                </View>
                <Text style={styles.cardAmount}>{Number(item.total).toFixed(2)} LKR</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardMeta}>{item.item_count} items</Text>
                <Text style={styles.cardStatus}>{item.status}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.cardActionButton} onPress={() => openOrder(item)}>
                  <Text style={styles.cardActionText}>View</Text>
                </TouchableOpacity>
                {item.status === 'pending' && (
                  <TouchableOpacity style={styles.cardActionButtonAlt} onPress={() => handleEditOrder(item)}>
                    <Text style={styles.cardActionTextAlt}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />

      <Modal visible={!!selectedOrder} transparent animationType="slide" onRequestClose={() => setSelectedOrder(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Order Details</Text>
            {loadingDetails ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Text style={styles.modalLabel}>Shop</Text>
                <Text style={styles.modalValue}>{selectedOrder?.shop?.name || selectedOrder?.shop_name}</Text>
                <Text style={styles.modalLabel}>Date</Text>
                <Text style={styles.modalValue}>
                  {selectedOrder ? formatDate(selectedOrder.created_at, true) : ''}
                </Text>
                <Text style={styles.modalLabel}>Total</Text>
                <Text style={styles.modalValue}>{Number(selectedOrder?.total || 0).toFixed(2)} LKR</Text>
                <Text style={styles.modalLabel}>Status</Text>
                <Text style={styles.modalValue}>{selectedOrder?.status}</Text>

                {selectedOrder?.items?.length ? (
                  <>
                    <Text style={styles.modalLabel}>Items</Text>
                    {selectedOrder.items.map((item, index) => (
                      <View key={`${item.product_id}-${item.unit_price}-${index}`} style={styles.itemRow}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemMeta}>
                          {item.quantity} x {formatCurrency(item.unit_price)} LKR
                        </Text>
                      </View>
                    ))}
                  </>
                ) : null}

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
                    style={[styles.actionButton, styles.actionSecondary]}
                    onPress={sendSMS}
                    disabled={sendingSMS || sendingWhatsApp}
                  >
                    <Text style={styles.actionText}>{sendingSMS ? 'Sending...' : 'Send SMS'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionSecondary]}
                    onPress={sendWhatsApp}
                    disabled={sendingSMS || sendingWhatsApp}
                  >
                    <Text style={styles.actionText}>{sendingWhatsApp ? 'Sending...' : 'Send WhatsApp'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => setSelectedOrder(null)}>
                    <Text style={styles.actionTextOnAccent}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!editOrder} transparent animationType="slide" onRequestClose={() => setEditOrder(null)}>
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.modalCard}>
            <Text style={styles.editModalTitle}>Edit Pending Order</Text>
            {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
            <Text style={styles.modalLabel}>Items</Text>
            <View style={styles.editItems}>
              {editItems.map((item) => (
                <View key={item.line_key} style={styles.editRow}>
                  <View style={styles.editText}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {formatCurrency(item.unit_price)} LKR
                    </Text>
                  </View>
                  <TextInput
                    style={styles.editQty}
                    keyboardType="numeric"
                    value={String(item.quantity)}
                    onChangeText={(value) => {
                      const qty = Number(value || 0);
                      setEditItems((prev) =>
                        prev.map((i) =>
                          i.line_key === item.line_key
                            ? { ...i, quantity: qty, total: qty * i.unit_price }
                            : i,
                        ),
                      );
                    }}
                  />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => setEditItems((prev) => prev.filter((i) => i.line_key !== item.line_key))}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <Text style={styles.modalLabel}>Add Item</Text>
            <View style={styles.addRow}>
              <TouchableOpacity
                style={[styles.input, styles.addInput]}
                onPress={openProductPicker}
              >
                <Text style={selectedEditProduct ? styles.selectedText : styles.placeholderText}>
                  {selectedEditProduct ? selectedEditProduct.name : 'Select product'}
                </Text>
              </TouchableOpacity>
              <TextInput
                placeholder="Qty"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.addQty]}
                keyboardType="numeric"
                value={newProductQty}
                onChangeText={setNewProductQty}
              />
              <TouchableOpacity style={styles.addButton} onPress={addEditItem}>
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.editModalActions}>
              <TouchableOpacity style={[styles.actionSecondary, styles.editModalButton]} onPress={() => setEditOrder(null)}>
                <Text style={styles.editModalButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionPrimary, styles.editModalButton]} onPress={saveEditOrder} disabled={editLoading}>
                <Text style={styles.editModalButtonText}>{editLoading ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showProductPicker && (
            <View style={styles.overlay}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
              <View style={styles.pickerCard}>
                <Text style={styles.modalTitle}>Select Product</Text>
                <TextInput
                  placeholder="Search products..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={productSearch}
                  onChangeText={setProductSearch}
                />
                {productsLoading ? (
                  <View style={styles.centerInline}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.centerText}>Loading products...</Text>
                  </View>
                ) : productsError ? (
                  <View style={styles.centerInline}>
                    <Text style={styles.errorText}>{productsError}</Text>
                    <TouchableOpacity style={styles.retry} onPress={openProductPicker}>
                      <Text style={styles.retryText}>Try again</Text>
                    </TouchableOpacity>
                  </View>
                ) : filteredProducts.length === 0 ? (
                  <Text style={styles.emptyText}>No products found.</Text>
                ) : (
                  <FlatList
                    data={filteredProducts}
                    keyExtractor={(item) => item.id}
                    style={styles.productList}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedEditProduct(item);
                          setNewProductId(item.id);
                          setProductSearch('');
                          setShowProductPicker(false);
                        }}
                      >
                        <Text style={styles.dropdownTitle}>{item.name}</Text>
                        <Text style={styles.dropdownSubtitle}>{formatCurrency(item.unit_price)} LKR</Text>
                      </TouchableOpacity>
                    )}
                  />
                )}
                <TouchableOpacity style={styles.actionSecondary} onPress={() => setShowProductPicker(false)}>
                  <Text style={styles.actionText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
      </View>
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
  placeholderText: {
    color: colors.textMuted,
  },
  selectedText: {
    color: colors.text,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterText: {
    color: colors.textSubtle,
    textTransform: 'capitalize',
    fontSize: 12,
  },
  filterTextActive: {
    color: colors.background,
    fontWeight: '700',
  },
  pendingButton: {
    backgroundColor: colors.warningSurface,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  pendingButtonText: {
    color: colors.warning,
    fontWeight: '700',
  },
  pendingCard: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  pendingTitle: {
    color: colors.warning,
    fontWeight: '700',
  },
  pendingBadge: {
    color: colors.warning,
    textTransform: 'capitalize',
    fontWeight: '700',
  },
  listActions: {
    flexDirection: 'row',
    gap: 8,
  },
  listActionButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  listActionButtonAlt: {
    backgroundColor: colors.warningSurface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  listActionText: {
    color: colors.text,
    fontWeight: '700',
  },
  listActionTextAlt: {
    color: colors.warning,
    fontWeight: '700',
  },
  list: {
    padding: 20,
    gap: 12,
  },
  productList: {
    maxHeight: 260,
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
    marginTop: 4,
  },
  cardAmount: {
    color: colors.accent,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  cardActionButton: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cardActionButtonAlt: {
    flex: 1,
    backgroundColor: colors.warningSurface,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
  },
  cardActionText: {
    color: colors.text,
    fontWeight: '700',
  },
  cardActionTextAlt: {
    color: colors.warning,
    fontWeight: '700',
  },
  cardMeta: {
    color: colors.textMuted,
  },
  cardStatus: {
    color: colors.textSubtle,
    textTransform: 'capitalize',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 19, 40, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(12, 19, 40, 0.65)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 20,
    elevation: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  pickerCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    maxHeight: 420,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  editModalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
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
  itemRow: {
    marginTop: 6,
    padding: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemName: {
    color: colors.text,
    fontWeight: '600',
  },
  itemMeta: {
    color: colors.textMuted,
    marginTop: 2,
  },
  editItems: {
    gap: 8,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editText: {
    flex: 1,
  },
  editQty: {
    width: 60,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
  },
  removeButton: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeText: {
    color: colors.danger,
    fontWeight: '700',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
  },
  addQty: {
    width: 70,
  },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addButtonText: {
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
  modalActions: {
    marginTop: 10,
    gap: 10,
  },
  editModalActions: {
    marginTop: 10,
    gap: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  editModalButton: {
    width: '45%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  editModalButtonText: {
    color: '#000000',
    fontWeight: '700',
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionSecondary: {
    backgroundColor: colors.surfaceAlt,
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
});
