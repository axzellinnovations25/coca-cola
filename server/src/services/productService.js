const pool = require('../db');
const messagingService = require('./messagingService');
const { randomUUID } = require('crypto');

async function logProductAction({ product_id, user_id, action, details }) {
  const logId = randomUUID();
  await pool.query(
    'INSERT INTO product_logs (id, product_id, user_id, action, details) VALUES ($1, $2, $3, $4, $5)',
    [logId, product_id, user_id, action, details ? JSON.stringify(details) : null]
  );
}

async function logOrderAction({ order_id, sales_rep_id, action, details }) {
  // If this is a create action, fetch product names for the items
  if (action === 'create' && details && details.items) {
    try {
      //console.log('Logging order creation with items:', details.items);
      
      // Get product IDs from the items
      const productIds = details.items.map(item => item.product_id);
      //console.log('Product IDs to fetch:', productIds);
      
      // Fetch product names
      const productNamesQuery = await pool.query(
        'SELECT id, name FROM products WHERE id = ANY($1)',
        [productIds]
      );
      //console.log('Product names query result:', productNamesQuery.rows);
      
      // Create a map of product_id to product_name
      const productMap = {};
      productNamesQuery.rows.forEach(product => {
        productMap[product.id] = product.name;
      });
      //console.log('Product map:', productMap);
      
      // Update the items in details to include product names
      details.items = details.items.map(item => ({
        ...item,
        product_name: productMap[item.product_id] || 'Unknown Product'
      }));
      //console.log('Updated items with product names:', details.items);
    } catch (error) {
      //console.error('Error fetching product names for order log:', error);
      // Continue without product names if there's an error
    }
  }

  if (action === 'return' && details && details.returned_items) {
    try {
      const productIds = details.returned_items.map(item => item.product_id);
      const productNamesQuery = await pool.query(
        'SELECT id, name FROM products WHERE id = ANY($1)',
        [productIds]
      );
      const productMap = {};
      productNamesQuery.rows.forEach(product => {
        productMap[product.id] = product.name;
      });
      details.returned_items = details.returned_items.map(item => ({
        ...item,
        product_name: productMap[item.product_id] || 'Unknown Product'
      }));
    } catch (error) {
      // Continue without product names if there's an error
    }
  }
  
  await pool.query(
    'INSERT INTO order_logs (order_id, sales_rep_id, action, details) VALUES ($1, $2, $3, $4)',
    [order_id, sales_rep_id, action, details ? JSON.stringify(details) : null]
  );
}

async function logPaymentAction({ payment_id, order_id, sales_rep_id, action, details }) {
  const logId = randomUUID();
  await pool.query(
    'INSERT INTO payment_logs (id, payment_id, order_id, sales_rep_id, action, details) VALUES ($1, $2, $3, $4, $5, $6)',
    [logId, payment_id, order_id, sales_rep_id, action, details ? JSON.stringify(details) : null]
  );
}

async function listProducts() {
  const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
  return result.rows;
}

async function addProduct({ name, description, unit_price, stock, user_id }) {
  const result = await pool.query(
    `INSERT INTO products (name, description, unit_price, stock)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, description, unit_price, stock]
  );
  const product = result.rows[0];
  await logProductAction({ product_id: product.id, user_id, action: 'add', details: { name, description, unit_price, stock } });
  return product;
}

async function editProduct({ id, name, description, unit_price, stock, user_id }) {
  // Fetch before for log
  const beforeRes = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  if (beforeRes.rows.length === 0) throw new Error('Product not found');
  const before = beforeRes.rows[0];
  const result = await pool.query(
    `UPDATE products SET name = $1, description = $2, unit_price = $3, stock = $4, updated_at = now()
     WHERE id = $5 RETURNING *`,
    [name, description, unit_price, stock, id]
  );
  if (result.rows.length === 0) throw new Error('Product not found');
  const after = result.rows[0];
  await logProductAction({ product_id: id, user_id, action: 'edit', details: { before, after } });
  return after;
}

async function deleteProduct(id, user_id) {
  // Fetch before for log
  const beforeRes = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  if (beforeRes.rows.length === 0) throw new Error('Product not found');
  const before = beforeRes.rows[0];
  const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) throw new Error('Product not found');
  await logProductAction({ product_id: id, user_id, action: 'delete', details: { before } });
}

async function listProductLogs() {
  const result = await pool.query(`
    SELECT l.*, u.email as user_email, u.role as user_role, p.name as product_name
    FROM product_logs l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN products p ON l.product_id = p.id
    ORDER BY l.created_at DESC
  `);
  return result.rows;
}

async function listShops() {
  const result = await pool.query(`
    SELECT s.*, u.first_name as sales_rep_first_name, u.last_name as sales_rep_last_name
    FROM shops s
    LEFT JOIN users u ON s.sales_rep_id = u.id
    ORDER BY s.created_at DESC
  `);
  return result.rows;
}

async function addShop({ name, address, owner_nic, email, phone, sales_rep_id, max_bill_amount, max_active_bills, user_id }) {
  const result = await pool.query(
    `INSERT INTO shops (name, address, owner_nic, email, phone, sales_rep_id, max_bill_amount, max_active_bills)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [name, address, owner_nic, email, phone, sales_rep_id, max_bill_amount, max_active_bills]
  );
  const shop = result.rows[0];
  await logShopAction({ shop_id: shop.id, user_id, action: 'add', details: { name, address, owner_nic, email, phone, sales_rep_id, max_bill_amount, max_active_bills } });
  return shop;
}

async function editShop({ id, name, address, owner_nic, email, phone, sales_rep_id, max_bill_amount, max_active_bills, user_id }) {
  const beforeRes = await pool.query('SELECT * FROM shops WHERE id = $1', [id]);
  if (beforeRes.rows.length === 0) throw new Error('Shop not found');
  const before = beforeRes.rows[0];
  const result = await pool.query(
    `UPDATE shops SET name = $1, address = $2, owner_nic = $3, email = $4, phone = $5, sales_rep_id = $6, max_bill_amount = $7, max_active_bills = $8, updated_at = now()
     WHERE id = $9 RETURNING *`,
    [name, address, owner_nic, email, phone, sales_rep_id, max_bill_amount, max_active_bills, id]
  );
  if (result.rows.length === 0) throw new Error('Shop not found');
  const after = result.rows[0];
  await logShopAction({ shop_id: id, user_id, action: 'edit', details: { before, after } });
  return after;
}

async function deleteShop(id, user_id) {
  const beforeRes = await pool.query('SELECT * FROM shops WHERE id = $1', [id]);
  if (beforeRes.rows.length === 0) throw new Error('Shop not found');
  const before = beforeRes.rows[0];
  const result = await pool.query('DELETE FROM shops WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) throw new Error('Shop not found');
  await logShopAction({ shop_id: id, user_id, action: 'delete', details: { before } });
}

async function logShopAction({ shop_id, user_id, action, details }) {
  await pool.query(
    'INSERT INTO shop_logs (shop_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
    [shop_id, user_id, action, details ? JSON.stringify(details) : null]
  );
}

async function listShopLogs() {
  const result = await pool.query(`
    SELECT l.*, u.email as user_email, u.role as user_role, s.name as shop_name
    FROM shop_logs l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN shops s ON l.shop_id = s.id
    ORDER BY l.created_at DESC
  `);
  return result.rows;
}

async function listAssignedShops(sales_rep_id) {
  const result = await pool.query(`
    SELECT s.*, 
      COALESCE(SUM(CASE 
        WHEN o.status = 'approved' THEN (o.total::numeric) - COALESCE((SELECT SUM(p.amount)::numeric FROM payments p WHERE p.order_id = o.id), 0)
        ELSE 0 
      END), 0) as current_outstanding,
      (SELECT COUNT(*) FROM orders o2 
       WHERE o2.shop_id = s.id 
       AND o2.status = 'approved'
       AND ((o2.total::numeric) - COALESCE((SELECT SUM(p.amount)::numeric FROM payments p WHERE p.order_id = o2.id), 0)) > 0) as active_bills
    FROM shops s
    LEFT JOIN orders o ON o.shop_id = s.id
    WHERE s.sales_rep_id = $1
    GROUP BY s.id, s.name, s.address, s.owner_nic, s.email, s.phone, s.sales_rep_id, s.max_bill_amount, s.max_active_bills, s.created_at, s.updated_at
    ORDER BY s.created_at DESC
  `, [sales_rep_id]);
  return result.rows;
}

async function listOrderProducts() {
  const result = await pool.query('SELECT * FROM products ORDER BY name ASC');
  return result.rows;
}

async function createOrder({ shop_id, sales_rep_id, notes, items }) {
  const orderId = randomUUID();
  // Calculate total
  const total = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  // Fetch shop info for validation - now considering payments
  const shopRes = await pool.query(`
    SELECT max_bill_amount, max_active_bills,
      COALESCE(SUM(CASE WHEN o.status = 'approved' THEN (o.total::numeric) - COALESCE((SELECT SUM(p.amount)::numeric FROM payments p WHERE p.order_id = o.id), 0) ELSE 0 END), 0) as current_outstanding,
      (SELECT COUNT(*) FROM orders o2 
       WHERE o2.shop_id = s.id 
       AND o2.status = 'approved'
       AND ((o2.total::numeric) - COALESCE((SELECT SUM(p.amount)::numeric FROM payments p WHERE p.order_id = o2.id), 0)) > 0) as active_bills
    FROM shops s 
    LEFT JOIN orders o ON o.shop_id = s.id
    WHERE s.id = $1
    GROUP BY s.id, s.max_bill_amount, s.max_active_bills
  `, [shop_id]);
  if (shopRes.rows.length === 0) throw new Error('Shop not found');
  const shop = shopRes.rows[0];
  const availableCredit = Number(shop.max_bill_amount) - Number(shop.current_outstanding);
  if (total > availableCredit) {
    throw new Error(`Order total exceeds available credit (${availableCredit.toFixed(2)} LKR).`);
  }
  if (Number(shop.active_bills) >= Number(shop.max_active_bills)) {
    throw new Error(`Shop has reached the maximum number of active bills (${shop.max_active_bills}).`);
  }
  // Proceed with order creation with pending status
  const orderRes = await pool.query(
    `INSERT INTO orders (id, shop_id, sales_rep_id, notes, total, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', now()) RETURNING *`,
    [orderId, shop_id, sales_rep_id, notes, total]
  );
  const order = orderRes.rows[0];
  for (const item of items) {
    await pool.query(
      `INSERT INTO order_items (order_id, product_id, unit_price, quantity, total)
       VALUES ($1, $2, $3, $4, $5)` ,
      [order.id, item.product_id, item.unit_price, item.quantity, item.unit_price * item.quantity]
    );
  }
  
  // Log the order creation
  await logOrderAction({
    order_id: order.id,
    sales_rep_id,
    action: 'create',
    details: {
      shop_id,
      total,
      notes,
      status: 'pending',
      items: items.map(item => ({
        product_id: item.product_id,
        unit_price: item.unit_price,
        quantity: item.quantity,
        total: item.unit_price * item.quantity
      }))
    }
  });
  
  return order;
}

async function updatePendingOrderForSalesRep({ order_id, sales_rep_id, notes, items }) {
  if (!order_id) throw new Error('Order ID is required');
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order items are required');
  }

  const orderRes = await pool.query(
    'SELECT id, shop_id, sales_rep_id, status, total, notes FROM orders WHERE id = $1',
    [order_id]
  );
  if (orderRes.rows.length === 0) throw new Error('Order not found');
  const order = orderRes.rows[0];
  if (order.sales_rep_id !== sales_rep_id && order.sales_rep_id !== String(sales_rep_id)) {
    throw new Error('Access denied - Order does not belong to you');
  }
  if (order.status !== 'pending') {
    throw new Error('Only pending orders can be edited');
  }

  const normalizedItems = items.map(item => ({
    product_id: item.product_id,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price)
  }));

  if (normalizedItems.some(item => !item.product_id || isNaN(item.quantity) || item.quantity <= 0)) {
    throw new Error('Invalid order items');
  }

  const productIds = normalizedItems.map(item => item.product_id);
  const productsRes = await pool.query(
    'SELECT id FROM products WHERE id = ANY($1)',
    [productIds]
  );
  if (productsRes.rows.length !== productIds.length) {
    throw new Error('One or more products are invalid');
  }

  const total = normalizedItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  const shopRes = await pool.query(`
    SELECT max_bill_amount, max_active_bills,
      COALESCE(SUM(CASE WHEN o.status = 'approved' THEN (o.total::numeric) - COALESCE((SELECT SUM(p.amount)::numeric FROM payments p WHERE p.order_id = o.id), 0) ELSE 0 END), 0) as current_outstanding,
      (SELECT COUNT(*) FROM orders o2 
       WHERE o2.shop_id = s.id 
       AND o2.status = 'approved'
       AND ((o2.total::numeric) - COALESCE((SELECT SUM(p.amount)::numeric FROM payments p WHERE p.order_id = o2.id), 0)) > 0) as active_bills
    FROM shops s 
    LEFT JOIN orders o ON o.shop_id = s.id
    WHERE s.id = $1
    GROUP BY s.id, s.max_bill_amount, s.max_active_bills
  `, [order.shop_id]);
  if (shopRes.rows.length === 0) throw new Error('Shop not found');
  const shop = shopRes.rows[0];
  const availableCredit = Number(shop.max_bill_amount) - Number(shop.current_outstanding);
  if (total > availableCredit) {
    throw new Error(`Order total exceeds available credit (${availableCredit.toFixed(2)} LKR).`);
  }
  if (Number(shop.active_bills) >= Number(shop.max_active_bills)) {
    throw new Error(`Shop has reached the maximum number of active bills (${shop.max_active_bills}).`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const beforeItemsRes = await client.query(
      'SELECT product_id, unit_price, quantity, total FROM order_items WHERE order_id = $1',
      [order_id]
    );

    await client.query(
      'UPDATE orders SET notes = $1, total = $2 WHERE id = $3',
      [notes || null, total, order_id]
    );

    await client.query('DELETE FROM order_items WHERE order_id = $1', [order_id]);

    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, unit_price, quantity, total)
         VALUES ($1, $2, $3, $4, $5)`,
        [order_id, item.product_id, item.unit_price, item.quantity, item.unit_price * item.quantity]
      );
    }

    await client.query('COMMIT');

    await logOrderAction({
      order_id,
      sales_rep_id,
      action: 'edit',
      details: {
        before: {
          total: Number(order.total),
          notes: order.notes,
          items: beforeItemsRes.rows
        },
        after: {
          total,
          notes: notes || null,
          items: normalizedItems
        }
      }
    });

    return { id: order_id, total, notes: notes || null, status: order.status };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateOrderAsAdmin({ order_id, admin_id, notes, items }) {
  if (!order_id) throw new Error('Order ID is required');
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order items are required');
  }

  const orderRes = await pool.query(
    'SELECT id, shop_id, sales_rep_id, status, total, notes FROM orders WHERE id = $1',
    [order_id]
  );
  if (orderRes.rows.length === 0) throw new Error('Order not found');
  const order = orderRes.rows[0];

  const normalizedItems = items.map(item => ({
    product_id: item.product_id,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price)
  }));

  if (normalizedItems.some(item => !item.product_id || isNaN(item.quantity) || item.quantity <= 0)) {
    throw new Error('Invalid order items');
  }

  const productIds = normalizedItems.map(item => item.product_id);
  const productsRes = await pool.query(
    'SELECT id FROM products WHERE id = ANY($1)',
    [productIds]
  );
  if (productsRes.rows.length !== productIds.length) {
    throw new Error('One or more products are invalid');
  }

  const total = normalizedItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const beforeItemsRes = await client.query(
      'SELECT product_id, unit_price, quantity, total FROM order_items WHERE order_id = $1',
      [order_id]
    );

    if (order.status === 'approved') {
      const beforeMap = new Map();
      for (const item of beforeItemsRes.rows) {
        beforeMap.set(item.product_id, Number(item.quantity));
      }
      const afterMap = new Map();
      for (const item of normalizedItems) {
        afterMap.set(item.product_id, Number(item.quantity));
      }

      const productSet = new Set([...beforeMap.keys(), ...afterMap.keys()]);
      for (const productId of productSet) {
        const beforeQty = beforeMap.get(productId) || 0;
        const afterQty = afterMap.get(productId) || 0;
        const diff = afterQty - beforeQty;
        if (diff === 0) continue;

        const stockRes = await client.query(
          'SELECT stock FROM products WHERE id = $1 FOR UPDATE',
          [productId]
        );
        if (stockRes.rows.length === 0) {
          throw new Error('Product not found');
        }
        const currentStock = Number(stockRes.rows[0].stock);
        const newStock = currentStock - diff;
        if (newStock < 0) {
          throw new Error('Insufficient inventory for approved order update');
        }
        await client.query(
          'UPDATE products SET stock = $1 WHERE id = $2',
          [newStock, productId]
        );
      }
    }

    await client.query(
      'UPDATE orders SET notes = $1, total = $2 WHERE id = $3',
      [notes || null, total, order_id]
    );

    await client.query('DELETE FROM order_items WHERE order_id = $1', [order_id]);

    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, unit_price, quantity, total)
         VALUES ($1, $2, $3, $4, $5)`,
        [order_id, item.product_id, item.unit_price, item.quantity, item.unit_price * item.quantity]
      );
    }

    await client.query('COMMIT');

    await logOrderAction({
      order_id,
      sales_rep_id: admin_id,
      action: 'admin_edit',
      details: {
        before: {
          total: Number(order.total),
          notes: order.notes,
          items: beforeItemsRes.rows
        },
        after: {
          total,
          notes: notes || null,
          items: normalizedItems
        },
        status: order.status
      }
    });

    return { id: order_id, total, notes: notes || null, status: order.status };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listOrders(sales_rep_id) {
  const result = await pool.query(`
    SELECT o.id, s.name as shop_name, o.created_at, o.total, o.status,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
    FROM orders o
    LEFT JOIN shops s ON o.shop_id = s.id
    WHERE o.sales_rep_id = $1
    ORDER BY o.created_at DESC
  `, [sales_rep_id]);
  return result.rows;
}

// New function for admin to list all orders
async function listAllOrders() {
  const result = await pool.query(`
    SELECT o.id, o.shop_id, s.name as shop_name, o.created_at, o.total, o.status, o.notes,
      u.first_name as sales_rep_first_name, u.last_name as sales_rep_last_name, u.email as sales_rep_email,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
    FROM orders o
    LEFT JOIN shops s ON o.shop_id = s.id
    LEFT JOIN users u ON o.sales_rep_id = u.id
    ORDER BY o.created_at DESC
  `);
  return result.rows;
}

// New function to approve an order
async function approveOrder(order_id, admin_id) {
  // Check if order exists and is pending
  const orderRes = await pool.query('SELECT status FROM orders WHERE id = $1', [order_id]);
  if (orderRes.rows.length === 0) throw new Error('Order not found');
  if (orderRes.rows[0].status !== 'pending') throw new Error('Order is not pending approval');
  
  // Get order details including items and shop information
  const orderDetailsRes = await pool.query(`
    SELECT o.id, o.shop_id, o.sales_rep_id, o.total, o.status, o.notes, o.created_at,
           oi.product_id, oi.quantity, oi.unit_price, oi.total as item_total,
           s.name as shop_name, s.address, s.phone,
           p.name as product_name
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN shops s ON o.shop_id = s.id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE o.id = $1
  `, [order_id]);
  
  if (orderDetailsRes.rows.length === 0) throw new Error('Order not found');
  
  const orderData = orderDetailsRes.rows[0];
  const orderItems = orderDetailsRes.rows.filter(row => row.product_id);
  
  // Start transaction for inventory updates
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update order status to approved
    await client.query('UPDATE orders SET status = $1 WHERE id = $2', ['approved', order_id]);
    
    await client.query('COMMIT');
    
    // Log the approval action
    await logOrderAction({
      order_id: order_id,
      sales_rep_id: admin_id, // admin_id will be the one approving
      action: 'approve',
      details: {
        previous_status: 'pending',
        new_status: 'approved',
        approved_by: admin_id,
        inventory_updated: false,
        items_processed: orderItems.length
      }
    });

    // Send SMS notification to shop owner
    let smsSent = false;
    let smsError = null;
    
    try {
      // Prepare order object for messaging
      const order = {
        id: orderData.id,
        total: orderData.total,
        notes: orderData.notes,
        created_at: orderData.created_at
      };
      
      // Prepare shop object for messaging
      const shop = {
        name: orderData.shop_name,
        address: orderData.address,
        phone: orderData.phone
      };
      
      // Prepare items array for messaging
      const items = orderItems.map(item => ({
        name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.item_total
      }));
      
      // Send SMS notification
      if (shop.phone) {
        const smsResult = await messagingService.sendOrderApprovalNotification(
          order,
          shop,
          items,
          ['sms']
        );
        
        if (smsResult.sms && smsResult.sms.success) {
          smsSent = true;
        } else {
          smsError = smsResult.sms?.error || 'SMS sending failed';
        }
      } else {
        smsError = 'Shop phone number not available';
      }
    } catch (smsError) {
      console.error('Failed to send order approval SMS notification:', smsError);
      smsError = smsError.message || 'SMS sending failed';
      // Don't throw error - order approval was successful, SMS failure shouldn't affect approval
    }
    
    return { 
      message: 'Order approved successfully',
      inventory_updated: false,
      items_processed: orderItems.length,
      sms_sent: smsSent,
      sms_error: smsError
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// New function to reject an order
async function rejectOrder(order_id, admin_id, rejection_reason) {
  // Check if order exists and is pending
  const orderRes = await pool.query('SELECT status FROM orders WHERE id = $1', [order_id]);
  if (orderRes.rows.length === 0) throw new Error('Order not found');
  if (orderRes.rows[0].status !== 'pending') throw new Error('Order is not pending approval');
  
  // Get order details including items and shop information
  const orderDetailsRes = await pool.query(`
    SELECT o.id, o.shop_id, o.sales_rep_id, o.total, o.status, o.notes, o.created_at,
           oi.product_id, oi.quantity, oi.unit_price, oi.total as item_total,
           s.name as shop_name, s.address, s.phone,
           p.name as product_name
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN shops s ON o.shop_id = s.id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE o.id = $1
  `, [order_id]);
  
  if (orderDetailsRes.rows.length === 0) throw new Error('Order not found');
  
  const orderData = orderDetailsRes.rows[0];
  const orderItems = orderDetailsRes.rows.filter(row => row.product_id);
  
  // Start transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update order status to rejected and add rejection reason
    await client.query(
      'UPDATE orders SET status = $1, rejection_reason = $2, rejected_at = now() WHERE id = $3', 
      ['rejected', rejection_reason, order_id]
    );
    
    await client.query('COMMIT');
    
    // Log the rejection action
    await logOrderAction({
      order_id: order_id,
      sales_rep_id: admin_id, // admin_id will be the one rejecting
      action: 'reject',
      details: {
        previous_status: 'pending',
        new_status: 'rejected',
        rejected_by: admin_id,
        rejection_reason: rejection_reason,
        items_count: orderItems.length
      }
    });

    // Send SMS notification to shop owner
    let smsSent = false;
    let smsError = null;
    
    try {
      // Prepare order object for messaging
      const order = {
        id: orderData.id,
        total: orderData.total,
        notes: orderData.notes,
        created_at: orderData.created_at,
        rejection_reason: rejection_reason
      };
      
      // Prepare shop object for messaging
      const shop = {
        name: orderData.shop_name,
        address: orderData.address,
        phone: orderData.phone
      };
      
      // Prepare items array for messaging
      const items = orderItems.map(item => ({
        name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.item_total
      }));
      
      // Send SMS notification
      if (shop.phone) {
        const smsResult = await messagingService.sendOrderRejectionNotification(
          order,
          shop,
          items,
          ['sms']
        );
        
        if (smsResult.sms && smsResult.sms.success) {
          smsSent = true;
        } else {
          smsError = smsResult.sms?.error || 'SMS sending failed';
        }
      } else {
        smsError = 'Shop phone number not available';
      }
    } catch (smsError) {
      console.error('Failed to send order rejection SMS notification:', smsError);
      smsError = smsError.message || 'SMS sending failed';
      // Don't throw error - order rejection was successful, SMS failure shouldn't affect rejection
    }
    
    return { 
      message: 'Order rejected successfully',
      rejection_reason: rejection_reason,
      items_count: orderItems.length,
      sms_sent: smsSent,
      sms_error: smsError
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function billsForRepresentative(sales_rep_id) {
  // Get all shops assigned to this rep
  const shopsRes = await pool.query('SELECT id, name FROM shops WHERE sales_rep_id = $1::text', [sales_rep_id]);
  const shopIds = shopsRes.rows.map(s => s.id);
  if (shopIds.length === 0) return [];
  // Get all approved orders for these shops
  const ordersRes = await pool.query(`
    SELECT o.id, o.shop_id, o.created_at, o.total,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id), 0) as collected
    FROM orders o
    WHERE o.shop_id = ANY($1::text[])
    AND o.status = 'approved'
    ORDER BY o.created_at DESC
  `, [shopIds]);
  // Group orders by shop
  const shopMap = {};
  for (const shop of shopsRes.rows) {
    shopMap[shop.id] = {
      shop_id: shop.id,
      shop_name: shop.name,
      total_outstanding: 0,
      bills: []
    };
  }
  for (const order of ordersRes.rows) {
    const outstanding = Number(order.total) - Number(order.collected);
    if (!shopMap[order.shop_id]) continue;
    shopMap[order.shop_id].bills.push({
      id: order.id,
      created_at: order.created_at,
      total: Number(order.total),
      collected: Number(order.collected),
      outstanding
    });
    shopMap[order.shop_id].total_outstanding += outstanding;
  }
  // Return as array
  return Object.values(shopMap);
}

async function recordPayment({ order_id, sales_rep_id, amount, notes }) {
  if (!amount || isNaN(amount) || Number(amount) <= 0) throw new Error('Invalid payment amount');
  
  // Get order and outstanding
  const orderRes = await pool.query(`
    SELECT o.*, s.name as shop_name, s.address, s.phone 
    FROM orders o 
    JOIN shops s ON o.shop_id = s.id 
    WHERE o.id = $1
  `, [order_id]);
  
  if (orderRes.rows.length === 0) throw new Error('Order not found');
  const order = orderRes.rows[0];
  const total = Number(order.total);
  
  const paymentsRes = await pool.query('SELECT COALESCE(SUM(amount),0) as collected FROM payments WHERE order_id = $1', [order_id]);
  const collected = Number(paymentsRes.rows[0].collected);
  const outstanding = total - collected;
  
  if (Number(amount) > outstanding) throw new Error('Payment exceeds outstanding amount');
  
  // Insert payment with explicit timestamp
  const paymentId = randomUUID();
  const paymentRes = await pool.query(
    'INSERT INTO payments (id, order_id, sales_rep_id, amount, notes, created_at) VALUES ($1, $2, $3, $4, $5, now()) RETURNING *',
    [paymentId, order_id, sales_rep_id, amount, notes || null]
  );
  const payment = paymentRes.rows[0];
  
  // Log the payment recording
  await logPaymentAction({
    payment_id: payment.id,
    order_id,
    sales_rep_id,
    action: 'record',
    details: {
      amount: Number(amount),
      notes: notes || null,
      order_total: total,
      previous_collected: collected,
      new_outstanding: outstanding - Number(amount)
    }
  });

  // Send SMS notification to shop owner
  let smsSent = false;
  let smsError = null;
  
  try {
    // Get remaining bills count for this shop
    const remainingBillsRes = await pool.query(`
      SELECT COUNT(DISTINCT o.id) as remaining_bills
      FROM orders o
      WHERE o.shop_id = $1 
      AND o.status = 'approved'
      AND o.total::numeric > (
        SELECT COALESCE(SUM(p.amount), 0)
        FROM payments p
        WHERE p.order_id = o.id
      )
    `, [order.shop_id]);
    
    const remainingBillsCount = parseInt(remainingBillsRes.rows[0].remaining_bills);
    
    // Prepare shop object for messaging
    const shop = {
      name: order.shop_name,
      address: order.address,
      phone: order.phone
    };
    
    // Prepare payment object with collected amount
    const paymentWithCollected = {
      ...payment,
      collected: collected + Number(amount)
    };
    
    // Send SMS notification
    const normalizedPhone = typeof shop.phone === 'string' ? shop.phone.trim() : shop.phone;
    if (normalizedPhone) {
      const smsResult = await messagingService.sendPaymentNotification(
        paymentWithCollected,
        order,
        { ...shop, phone: normalizedPhone },
        remainingBillsCount,
        ['sms']
      );
      
      if (smsResult.sms && smsResult.sms.success) {
        smsSent = true;
      } else {
        smsError = smsResult.sms?.error || 'SMS sending failed';
      }
    } else {
      smsError = 'Shop phone number not available';
    }
  } catch (err) {
    console.error('Failed to send payment SMS notification:', err);
    smsError = err?.message || 'SMS sending failed';
    // Don't throw error - payment was successful, SMS failure shouldn't affect payment
  }

  return {
    ...payment,
    sms_sent: smsSent,
    sms_error: smsError
  };
}

async function recordReturn({ order_id, sales_rep_id, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Return items are required');
  }

  const orderRes = await pool.query(
    'SELECT id, shop_id, sales_rep_id, status, total, notes FROM orders WHERE id = $1',
    [order_id]
  );
  if (orderRes.rows.length === 0) throw new Error('Order not found');
  const order = orderRes.rows[0];

  if (order.status !== 'approved') {
    throw new Error('Returns are allowed only for approved orders');
  }
  if (order.sales_rep_id !== sales_rep_id) {
    throw new Error('Access denied - Order does not belong to you');
  }

  const normalizedItems = items.map(item => ({
    product_id: item.product_id,
    quantity: Number(item.quantity)
  }));

  if (normalizedItems.some(item => !item.product_id || isNaN(item.quantity) || item.quantity <= 0)) {
    throw new Error('Invalid return items');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderItemsRes = await client.query(
      'SELECT product_id, unit_price, quantity, total FROM order_items WHERE order_id = $1',
      [order_id]
    );
    const orderItemsMap = new Map();
    orderItemsRes.rows.forEach(item => {
      orderItemsMap.set(item.product_id, {
        unit_price: Number(item.unit_price),
        quantity: Number(item.quantity)
      });
    });

    for (const item of normalizedItems) {
      const existing = orderItemsMap.get(item.product_id);
      if (!existing) throw new Error('Return item not found in order');
      if (item.quantity > existing.quantity) {
        throw new Error('Return quantity exceeds ordered quantity');
      }
      const remainingQty = existing.quantity - item.quantity;
      if (remainingQty > 0) {
        await client.query(
          'UPDATE order_items SET quantity = $1, total = $2 WHERE order_id = $3 AND product_id = $4',
          [remainingQty, existing.unit_price * remainingQty, order_id, item.product_id]
        );
      } else {
        await client.query(
          'DELETE FROM order_items WHERE order_id = $1 AND product_id = $2',
          [order_id, item.product_id]
        );
      }
    }

    const updatedItemsRes = await client.query(
      'SELECT product_id, unit_price, quantity, total FROM order_items WHERE order_id = $1',
      [order_id]
    );
    const newTotal = updatedItemsRes.rows.reduce((sum, row) => sum + Number(row.total), 0);

    await client.query(
      'UPDATE orders SET total = $1 WHERE id = $2',
      [newTotal, order_id]
    );

    await client.query('COMMIT');

    await logOrderAction({
      order_id,
      sales_rep_id,
      action: 'return',
      details: {
        returned_items: normalizedItems,
        previous_total: Number(order.total),
        new_total: newTotal
      }
    });

    return { id: order_id, total: newTotal, status: order.status };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listOrderLogs() {
  const result = await pool.query(`
    SELECT ol.*, 
           u.email as sales_rep_email, 
           u.first_name as sales_rep_first_name, 
           u.last_name as sales_rep_last_name,
           u.role as sales_rep_role,
           o.total as order_total,
           s.name as shop_name
    FROM order_logs ol
    LEFT JOIN users u ON ol.sales_rep_id = u.id
    LEFT JOIN orders o ON ol.order_id = o.id
    LEFT JOIN shops s ON o.shop_id = s.id
    ORDER BY ol.created_at DESC
  `);
  
  // Process each log to add product names if missing
  const processedLogs = await Promise.all(result.rows.map(async (log) => {
    if (log.details && log.details.items && Array.isArray(log.details.items)) {
      // Check if items already have product names
      const hasProductNames = log.details.items.some(item => item.product_name);
      
      if (!hasProductNames) {
        try {
          // Get product IDs from the items
          const productIds = log.details.items.map(item => item.product_id);
          
          // Fetch product names
          const productNamesQuery = await pool.query(
            'SELECT id, name FROM products WHERE id = ANY($1)',
            [productIds]
          );
          
          // Create a map of product_id to product_name
          const productMap = {};
          productNamesQuery.rows.forEach(product => {
            productMap[product.id] = product.name;
          });
          
          // Update the items in details to include product names
          log.details.items = log.details.items.map(item => ({
            ...item,
            product_name: productMap[item.product_id] || 'Unknown Product'
          }));
          
          // Update the log in the database for future requests
          await pool.query(
            'UPDATE order_logs SET details = $1 WHERE id = $2',
            [JSON.stringify(log.details), log.id]
          );
        } catch (error) {
          //console.error(`Error updating product names for log ${log.id}:`, error);
        }
      }
    }
    if (log.details && log.details.returned_items && Array.isArray(log.details.returned_items)) {
      const hasProductNames = log.details.returned_items.some(item => item.product_name);
      if (!hasProductNames) {
        try {
          const productIds = log.details.returned_items.map(item => item.product_id);
          const productNamesQuery = await pool.query(
            'SELECT id, name FROM products WHERE id = ANY($1)',
            [productIds]
          );
          const productMap = {};
          productNamesQuery.rows.forEach(product => {
            productMap[product.id] = product.name;
          });
          log.details.returned_items = log.details.returned_items.map(item => ({
            ...item,
            product_name: productMap[item.product_id] || 'Unknown Product'
          }));
          await pool.query(
            'UPDATE order_logs SET details = $1 WHERE id = $2',
            [JSON.stringify(log.details), log.id]
          );
        } catch (error) {
          // Continue without product names
        }
      }
    }
    return log;
  }));
  
  return processedLogs;
}

async function listPaymentLogs() {
  const result = await pool.query(`
    SELECT pl.*, 
           u.email as sales_rep_email, 
           u.first_name as sales_rep_first_name, 
           u.last_name as sales_rep_last_name,
           u.role as sales_rep_role,
           p.amount as payment_amount,
           p.notes as payment_notes,
           o.total as order_total,
           s.name as shop_name
    FROM payment_logs pl
    LEFT JOIN users u ON pl.sales_rep_id = u.id
    LEFT JOIN payments p ON pl.payment_id = p.id
    LEFT JOIN orders o ON pl.order_id = o.id
    LEFT JOIN shops s ON o.shop_id = s.id
    ORDER BY pl.created_at DESC
  `);
  return result.rows;
}

async function getSalesRepresentativesWithStats() {
  // Get all representatives
  const repsRes = await pool.query(`
    SELECT id, first_name, last_name, email, phone_no, nic_no, role, created_at
    FROM users 
    WHERE role = 'representative'
    ORDER BY created_at DESC
  `);
  
  const representatives = await Promise.all(repsRes.rows.map(async (rep) => {
    // Get shop assignments
    const shopsRes = await pool.query(`
      SELECT COUNT(*) as shop_count
      FROM shops 
      WHERE sales_rep_id = $1
    `, [rep.id]);
    
    // Get orders and calculate statistics
    const ordersRes = await pool.query(`
      SELECT o.id, o.total, o.created_at, o.status,
        COALESCE(SUM(p.amount), 0) as collected_amount
      FROM orders o
      LEFT JOIN payments p ON o.id = p.order_id
      WHERE o.sales_rep_id = $1
      AND o.status = 'approved'
      GROUP BY o.id, o.total, o.created_at, o.status
    `, [rep.id]);
    
    const orders = ordersRes.rows;
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
    const collectedAmount = orders.reduce((sum, order) => sum + Number(order.collected_amount || 0), 0);
    const outstandingAmount = totalRevenue - collectedAmount;
    const collectionRate = totalRevenue > 0 ? (collectedAmount / totalRevenue) * 100 : 0;
    
    // Updated performance rating logic
    let performanceRating = 'Poor';
    if (collectionRate >= 75) performanceRating = 'Excellent';
    else if (collectionRate >= 50) performanceRating = 'Good';
    else if (collectionRate >= 25) performanceRating = 'Average';
    // else remains 'Poor'
    
    return {
      ...rep,
      shop_count: Number(shopsRes.rows[0]?.shop_count || 0),
      order_count: orders.length,
      avg_order_value: avgOrderValue,
      total_revenue: totalRevenue,
      outstanding_amount: outstandingAmount,
      collected_amount: collectedAmount,
      collection_rate: collectionRate,
      performance_rating: performanceRating,
      status: 'Active'
    };
  }));
  
  return representatives;
}

// New function to get pending orders count for a representative
async function getPendingOrdersCount(sales_rep_id) {
  const result = await pool.query(`
    SELECT COUNT(*) as pending_count
    FROM orders 
    WHERE sales_rep_id = $1 AND status = 'pending'
  `, [sales_rep_id]);
  return result.rows[0]?.pending_count || 0;
}

// New function to get pending orders for a representative
async function getPendingOrders(sales_rep_id) {
  const result = await pool.query(`
    SELECT o.id, o.shop_id, s.name as shop_name, o.created_at, o.total, o.notes,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
    FROM orders o
    LEFT JOIN shops s ON o.shop_id = s.id
    WHERE o.sales_rep_id = $1 AND o.status = 'pending'
    ORDER BY o.created_at DESC
  `, [sales_rep_id]);
  return result.rows;
}

// New function to get detailed order information
async function getOrderDetails(order_id) {
  // Get order details with items
  const orderRes = await pool.query(`
    SELECT o.id, o.shop_id, o.sales_rep_id, o.total, o.status, o.notes, o.created_at,
           s.name as shop_name, s.address as shop_address, s.phone as shop_phone,
           u.first_name as sales_rep_first_name, u.last_name as sales_rep_last_name, u.email as sales_rep_email
    FROM orders o
    LEFT JOIN shops s ON o.shop_id = s.id
    LEFT JOIN users u ON o.sales_rep_id = u.id
    WHERE o.id = $1
  `, [order_id]);
  
  if (orderRes.rows.length === 0) {
    throw new Error('Order not found');
  }
  
  const order = orderRes.rows[0];
  
  // Get order items with product details
  const itemsRes = await pool.query(`
    SELECT oi.product_id, oi.quantity, oi.unit_price, oi.total as item_total,
           p.name as product_name
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = $1
  `, [order_id]);
  
  // Get payment information
  const paymentsRes = await pool.query(`
    SELECT COALESCE(SUM(amount), 0) as collected
    FROM payments
    WHERE order_id = $1
  `, [order_id]);
  
  const collected = Number(paymentsRes.rows[0].collected);
  const outstanding = Number(order.total) - collected;
  
  return {
    id: order.id,
    shop_id: order.shop_id,
    sales_rep_id: order.sales_rep_id,
    total: Number(order.total),
    status: order.status,
    notes: order.notes,
    created_at: order.created_at,
    collected: collected,
    outstanding: outstanding,
    shop: {
      name: order.shop_name,
      address: order.shop_address,
      phone: order.shop_phone
    },
    sales_rep: {
      first_name: order.sales_rep_first_name,
      last_name: order.sales_rep_last_name,
      email: order.sales_rep_email
    },
    items: itemsRes.rows.map(item => ({
      product_id: item.product_id,
      name: item.product_name,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      total: Number(item.item_total)
    }))
  };
}

// Function to get a single order by ID for ownership verification
async function getOrderById(order_id) {
  const result = await pool.query(`
    SELECT id, sales_rep_id, shop_id, total, status, created_at
    FROM orders
    WHERE id = $1
  `, [order_id]);
  
  return result.rows.length > 0 ? result.rows[0] : null;
}

// Function to get order payments
async function getOrderPayments(order_id) {
  const result = await pool.query(`
    SELECT id, amount, notes, created_at
    FROM payments
    WHERE order_id = $1
    ORDER BY created_at DESC
  `, [order_id]);
  
  return result.rows.map(payment => ({
    id: payment.id,
    amount: Number(payment.amount),
    notes: payment.notes,
    created_at: payment.created_at
  }));
}

async function logSalesQuantityAction({ order_id, product_id, sales_rep_id, shop_id, quantity_sold, unit_price, total_amount, previous_stock_quantity, new_stock_quantity, log_details }) {
  await pool.query(
    `INSERT INTO sales_quantity_logs 
     (order_id, product_id, sales_rep_id, shop_id, quantity_sold, unit_price, total_amount, previous_stock_quantity, new_stock_quantity, log_details) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [order_id, product_id, sales_rep_id, shop_id, quantity_sold, unit_price, total_amount, previous_stock_quantity, new_stock_quantity, log_details ? JSON.stringify(log_details) : null]
  );
}

async function updateProductInventory(product_id, quantity_to_reduce) {
  // Get current inventory quantity
  const currentRes = await pool.query('SELECT stock FROM products WHERE id = $1', [product_id]);
  if (currentRes.rows.length === 0) {
    throw new Error('Product not found');
  }
  
  const currentQuantity = currentRes.rows[0].stock;
  const newQuantity = currentQuantity - quantity_to_reduce;
  
  if (newQuantity < 0) {
    throw new Error(`Insufficient inventory. Available: ${currentQuantity}, Requested: ${quantity_to_reduce}`);
  }
  
  // Update inventory
  await pool.query(
    'UPDATE products SET stock = $1, updated_at = now() WHERE id = $2',
    [newQuantity, product_id]
  );
  
  return { previous_quantity: currentQuantity, new_quantity: newQuantity };
}

async function listSalesQuantityLogs() {
  const result = await pool.query(`
    SELECT 
      sql.*,
      p.name as product_name,
      p.description as product_description,
      s.name as shop_name,
      u.first_name as sales_rep_first_name,
      u.last_name as sales_rep_last_name,
      u.email as sales_rep_email,
      o.total as order_total,
      o.status as order_status
    FROM sales_quantity_logs sql
    LEFT JOIN products p ON sql.product_id = p.id
    LEFT JOIN shops s ON sql.shop_id = s.id
    LEFT JOIN users u ON sql.sales_rep_id = u.id
    LEFT JOIN orders o ON sql.order_id = o.id
    ORDER BY sql.created_at DESC
  `);
  return result.rows;
}

async function getInventoryStats() {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_products,
      SUM(stock) as total_inventory,
      AVG(stock) as avg_inventory,
      COUNT(CASE WHEN stock = 0 THEN 1 END) as out_of_stock,
      COUNT(CASE WHEN stock <= 10 THEN 1 END) as low_stock
    FROM products
  `);
  return result.rows[0];
}

async function getPaymentDetails(payment_id) {
  // Get payment with order and shop details
  const paymentRes = await pool.query(`
    SELECT 
      p.*,
      o.id as order_id,
      o.total as order_total,
      o.created_at as order_created_at,
      o.status as order_status,
      s.id as shop_id,
      s.name as shop_name,
      s.address as shop_address,
      s.phone as shop_phone,
      u.id as sales_rep_id,
      u.first_name as sales_rep_first_name,
      u.last_name as sales_rep_last_name
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN shops s ON o.shop_id = s.id
    JOIN users u ON p.sales_rep_id = u.id::text
    WHERE p.id = $1
  `, [payment_id]);

  if (paymentRes.rows.length === 0) {
    return null;
  }

  const paymentData = paymentRes.rows[0];

  // Get remaining bills count for this shop
  const remainingBillsRes = await pool.query(`
    SELECT COUNT(DISTINCT o.id) as remaining_bills
    FROM orders o
    WHERE o.shop_id = $1 
    AND o.status = 'approved'
    AND o.total > (
      SELECT COALESCE(SUM(p.amount), 0)
      FROM payments p
      WHERE p.order_id = o.id
    )
  `, [paymentData.shop_id]);

  const remainingBillsCount = parseInt(remainingBillsRes.rows[0].remaining_bills);

  // Get total collected for this order
  const collectedRes = await pool.query(`
    SELECT COALESCE(SUM(amount), 0) as collected
    FROM payments 
    WHERE order_id = $1
  `, [paymentData.order_id]);

  const collected = Number(collectedRes.rows[0].collected);

  return {
    payment: {
      id: paymentData.id,
      amount: paymentData.amount,
      notes: paymentData.notes,
      created_at: paymentData.created_at,
      collected: collected
    },
    order: {
      id: paymentData.order_id,
      total: paymentData.order_total,
      created_at: paymentData.order_created_at,
      status: paymentData.order_status
    },
    shop: {
      id: paymentData.shop_id,
      name: paymentData.shop_name,
      address: paymentData.shop_address,
      phone: paymentData.shop_phone
    },
    sales_rep: {
      id: paymentData.sales_rep_id,
      first_name: paymentData.sales_rep_first_name,
      last_name: paymentData.sales_rep_last_name
    },
    remainingBillsCount
  };
}

// Function to get collections made by a specific sales representative
async function getRepresentativeCollections(sales_rep_id) {
  const result = await pool.query(`
    SELECT 
      p.id as payment_id,
      p.amount,
      p.notes as payment_notes,
      p.created_at as payment_date,
      o.id as order_id,
      o.total as order_total,
      o.notes as order_notes,
      o.created_at as order_date,
      o.status as order_status,
      s.id as shop_id,
      s.name as shop_name,
      s.address as shop_address,
      s.phone as shop_phone,
      u.first_name as sales_rep_first_name,
      u.last_name as sales_rep_last_name,
      u.email as sales_rep_email
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN shops s ON o.shop_id = s.id
    JOIN users u ON p.sales_rep_id = u.id
    WHERE p.sales_rep_id = $1::text
    ORDER BY p.created_at DESC
  `, [sales_rep_id]);

  // Process the results to add calculated fields
  const collections = await Promise.all(result.rows.map(async (row) => {
    // Get total collected for this order before this payment
    const previousPaymentsRes = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as previous_collected
      FROM payments 
      WHERE order_id = $1 AND created_at < $2
    `, [row.order_id, row.payment_date]);
    
    const previousCollected = Number(previousPaymentsRes.rows[0]?.previous_collected || 0);
    const outstandingBeforePayment = Number(row.order_total) - previousCollected;
    const outstandingAfterPayment = outstandingBeforePayment - Number(row.amount);
    
    return {
      payment_id: row.payment_id,
      payment_amount: Number(row.amount),
      payment_notes: row.payment_notes,
      payment_date: row.payment_date,
      order_id: row.order_id,
      order_total: Number(row.order_total),
      order_notes: row.order_notes,
      order_date: row.order_date,
      order_status: row.order_status,
      shop: {
        id: row.shop_id,
        name: row.shop_name,
        address: row.shop_address,
        phone: row.shop_phone
      },
      sales_rep: {
        first_name: row.sales_rep_first_name,
        last_name: row.sales_rep_last_name,
        email: row.sales_rep_email
      },
      outstanding_before_payment: outstandingBeforePayment,
      outstanding_after_payment: outstandingAfterPayment,
      collection_percentage: ((Number(row.amount) / Number(row.order_total)) * 100).toFixed(2)
    };
  }));

  return collections;
}

// Function to get collection statistics for a sales representative
async function getRepresentativeCollectionStats(sales_rep_id) {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_collections,
      COALESCE(SUM(p.amount), 0) as total_amount_collected,
      COUNT(DISTINCT o.shop_id) as unique_shops,
      COUNT(DISTINCT o.id) as unique_orders,
      AVG(p.amount) as average_collection_amount,
      MIN(p.created_at) as first_collection_date,
      MAX(p.created_at) as last_collection_date
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    WHERE p.sales_rep_id = $1::text
  `, [sales_rep_id]);

  const stats = result.rows[0];
  
  // Get today's collections
  const todayResult = await pool.query(`
    SELECT 
      COUNT(*) as today_collections,
      COALESCE(SUM(amount), 0) as today_amount
    FROM payments 
    WHERE sales_rep_id = $1::text 
    AND DATE(created_at) = CURRENT_DATE
  `, [sales_rep_id]);

  const todayStats = todayResult.rows[0];

  // Get this month's collections
  const monthResult = await pool.query(`
    SELECT 
      COUNT(*) as month_collections,
      COALESCE(SUM(amount), 0) as month_amount
    FROM payments 
    WHERE sales_rep_id = $1::text 
    AND DATE_TRUNC('month', created_at::timestamp) = DATE_TRUNC('month', CURRENT_DATE)
  `, [sales_rep_id]);

  const monthStats = monthResult.rows[0];

  return {
    total_collections: Number(stats.total_collections),
    total_amount_collected: Number(stats.total_amount_collected),
    unique_shops: Number(stats.unique_shops),
    unique_orders: Number(stats.unique_orders),
    average_collection_amount: Number(stats.average_collection_amount || 0),
    first_collection_date: stats.first_collection_date,
    last_collection_date: stats.last_collection_date,
    today: {
      collections: Number(todayStats.today_collections),
      amount: Number(todayStats.today_amount)
    },
    this_month: {
      collections: Number(monthStats.month_collections),
      amount: Number(monthStats.month_amount)
    }
  };
}

// New function to get detailed shop information for admin
async function getShopDetails(shop_id) {
  // Get shop basic information
  const shopRes = await pool.query(`
    SELECT s.*, u.first_name as sales_rep_first_name, u.last_name as sales_rep_last_name
    FROM shops s
    LEFT JOIN users u ON s.sales_rep_id = u.id
    WHERE s.id = $1
  `, [shop_id]);
  
  if (shopRes.rows.length === 0) {
    throw new Error('Shop not found');
  }
  
  const shop = shopRes.rows[0];
  
  // Get outstanding amounts and active bills
  const outstandingRes = await pool.query(`
    SELECT 
      COALESCE(SUM(CASE WHEN o.status = 'approved' THEN o.total::numeric - COALESCE((SELECT SUM(p.amount::numeric) FROM payments p WHERE p.order_id = o.id), 0) ELSE 0 END), 0) as current_outstanding,
      (SELECT COUNT(*) FROM orders o2 
       WHERE o2.shop_id = $1 
       AND o2.status = 'approved'
       AND (o2.total::numeric - COALESCE((SELECT SUM(p.amount::numeric) FROM payments p WHERE p.order_id = o2.id), 0)) > 0) as active_bills
    FROM orders o
    WHERE o.shop_id = $1
  `, [shop_id]);
  
  // Get pending orders
  const pendingOrdersRes = await pool.query(`
    SELECT o.id, o.created_at, o.total, o.notes,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count,
      u.first_name as sales_rep_first_name, u.last_name as sales_rep_last_name, u.email as sales_rep_email
    FROM orders o
    LEFT JOIN users u ON o.sales_rep_id = u.id
    WHERE o.shop_id = $1 AND o.status = 'pending'
    ORDER BY o.created_at DESC
  `, [shop_id]);
  
  // Get active bills with payment details
  const activeBillsRes = await pool.query(`
    SELECT o.id, o.created_at, o.total, o.notes,
      COALESCE((SELECT SUM(p.amount::numeric) FROM payments p WHERE p.order_id = o.id), 0) as collected,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count,
      u.first_name as sales_rep_first_name, u.last_name as sales_rep_last_name
    FROM orders o
    LEFT JOIN users u ON o.sales_rep_id = u.id
    WHERE o.shop_id = $1 
    AND o.status = 'approved'
    AND (o.total::numeric - COALESCE((SELECT SUM(p.amount::numeric) FROM payments p WHERE p.order_id = o.id), 0)) > 0
    ORDER BY o.created_at DESC
  `, [shop_id]);
  
  // Get recent payments
  const recentPaymentsRes = await pool.query(`
    SELECT p.id, p.amount, p.notes, p.created_at,
      o.id as order_id, o.total as order_total,
      u.first_name as sales_rep_first_name, u.last_name as sales_rep_last_name
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    LEFT JOIN users u ON p.sales_rep_id = u.id
    WHERE o.shop_id = $1
    ORDER BY p.created_at DESC
    LIMIT 10
  `, [shop_id]);
  
  // Calculate available credit - ensure all values are numbers
  const currentOutstanding = Number(outstandingRes.rows[0].current_outstanding);
  const maxBillAmount = Number(shop.max_bill_amount);
  const availableCredit = maxBillAmount - currentOutstanding;
  
  return {
    ...shop,
    max_bill_amount: maxBillAmount, // Ensure this is a number
    max_active_bills: Number(shop.max_active_bills), // Ensure this is a number
    current_outstanding: currentOutstanding,
    active_bills: Number(outstandingRes.rows[0].active_bills),
    available_credit: availableCredit,
    pending_orders: pendingOrdersRes.rows.map(order => ({
      ...order,
      total: Number(order.total),
      item_count: Number(order.item_count)
    })),
    active_bills_details: activeBillsRes.rows.map(bill => ({
      ...bill,
      total: Number(bill.total),
      collected: Number(bill.collected),
      outstanding: Number(bill.total) - Number(bill.collected),
      item_count: Number(bill.item_count)
    })),
    recent_payments: recentPaymentsRes.rows.map(payment => ({
      ...payment,
      amount: Number(payment.amount),
      order_total: Number(payment.order_total)
    }))
  };
}

module.exports = {
  listProducts,
  addProduct,
  editProduct,
  deleteProduct,
  listProductLogs,
  listShops,
  addShop,
  editShop,
  deleteShop,
  logOrderAction,
  logPaymentAction,
  listOrderLogs,
  listPaymentLogs,
  getPaymentDetails,
  rejectOrder,
};
module.exports.listShopLogs = listShopLogs; 
module.exports.listAssignedShops = listAssignedShops;
module.exports.listOrderProducts = listOrderProducts;
module.exports.createOrder = createOrder; 
module.exports.listOrders = listOrders; 
module.exports.billsForRepresentative = billsForRepresentative; 
module.exports.recordPayment = recordPayment; 
module.exports.recordReturn = recordReturn;
module.exports.getSalesRepresentativesWithStats = getSalesRepresentativesWithStats; 
module.exports.listAllOrders = listAllOrders;
module.exports.approveOrder = approveOrder; 
module.exports.rejectOrder = rejectOrder;
module.exports.updatePendingOrderForSalesRep = updatePendingOrderForSalesRep;
module.exports.updateOrderAsAdmin = updateOrderAsAdmin;
module.exports.getPendingOrdersCount = getPendingOrdersCount;
module.exports.getPendingOrders = getPendingOrders; 
module.exports.getOrderDetails = getOrderDetails; 
module.exports.getOrderById = getOrderById;
module.exports.getOrderPayments = getOrderPayments;
module.exports.logSalesQuantityAction = logSalesQuantityAction;
module.exports.updateProductInventory = updateProductInventory;
module.exports.listSalesQuantityLogs = listSalesQuantityLogs;
module.exports.getInventoryStats = getInventoryStats; 
module.exports.getRepresentativeCollections = getRepresentativeCollections;
module.exports.getRepresentativeCollectionStats = getRepresentativeCollectionStats; 
module.exports.getShopDetails = getShopDetails; 
