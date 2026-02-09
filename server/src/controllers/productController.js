const productService = require('../services/productService');
const messagingService = require('../services/messagingService');

exports.listProducts = async (req, res) => {
  try {
    const products = await productService.listProducts();
    res.json({ products });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.addProduct = async (req, res) => {
  try {
    const { name, description, unit_price, stock } = req.body;
    const user_id = req.user && req.user.id;
    const product = await productService.addProduct({ name, description, unit_price, stock, user_id });
    res.status(201).json({ product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.editProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, unit_price, stock } = req.body;
    const user_id = req.user && req.user.id;
    const product = await productService.editProduct({ id, name, description, unit_price, stock, user_id });
    res.json({ product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user && req.user.id;
    await productService.deleteProduct(id, user_id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.listProductLogs = async (req, res) => {
  try {
    const logs = await productService.listProductLogs();
    res.json({ logs });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const shopService = require('../services/productService');

exports.listShops = async (req, res) => {
  try {
    const shops = await shopService.listShops();
    res.json({ shops });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.addShop = async (req, res) => {
  try {
    const { name, address, owner_nic, email, phone, sales_rep_id, max_bill_amount, max_active_bills } = req.body;
    const user_id = req.user && req.user.id;
    const shop = await shopService.addShop({ name, address, owner_nic, email, phone, sales_rep_id, max_bill_amount, max_active_bills, user_id });
    res.status(201).json({ shop });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.editShop = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, owner_nic, email, phone, sales_rep_id, max_bill_amount, max_active_bills } = req.body;
    const user_id = req.user && req.user.id;
    const shop = await shopService.editShop({ id, name, address, owner_nic, email, phone, sales_rep_id, max_bill_amount, max_active_bills, user_id });
    res.json({ shop });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteShop = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user && req.user.id;
    await shopService.deleteShop(id, user_id);
    res.json({ message: 'Shop deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.listShopLogs = async (req, res) => {
  try {
    const logs = await shopService.listShopLogs();
    res.json({ logs });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.listAssignedShops = async (req, res) => {
  try {
    const sales_rep_id = req.user && req.user.id;
    const shops = await shopService.listAssignedShops(sales_rep_id);
    res.json({ shops });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.listOrderProducts = async (req, res) => {
  try {
    const products = await shopService.listOrderProducts();
    res.json({ products });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const sales_rep_id = req.user && req.user.id;
    const { shop_id, notes, items } = req.body;
    const order = await shopService.createOrder({ shop_id, sales_rep_id, notes, items });
    res.status(201).json({ order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.listOrders = async (req, res) => {
  try {
    const sales_rep_id = req.user && req.user.id;
    const orders = await shopService.listOrders(sales_rep_id);
    res.json({ orders });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// New controller for admin to list all orders
exports.listAllOrders = async (req, res) => {
  try {
    const orders = await shopService.listAllOrders();
    res.json({ orders });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// New controller for admin to approve orders
exports.approveOrder = async (req, res) => {
  try {
    const { order_id } = req.params;
    const admin_id = req.user && req.user.id;
    const result = await shopService.approveOrder(order_id, admin_id);
    
    // Return approval result with SMS status
    res.json({
      message: result.message,
      inventory_updated: result.inventory_updated,
      items_processed: result.items_processed,
      sms_sent: result.sms_sent || false,
      sms_error: result.sms_error || null
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// New controller for admin to reject orders
exports.rejectOrder = async (req, res) => {
  try {
    const { order_id } = req.params;
    const { rejection_reason } = req.body;
    const admin_id = req.user && req.user.id;
    
    // Validate rejection reason
    if (!rejection_reason || rejection_reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }
    
    const result = await shopService.rejectOrder(order_id, admin_id, rejection_reason.trim());
    
    // Return rejection result with SMS status
    res.json({
      message: result.message,
      rejection_reason: result.rejection_reason,
      items_count: result.items_count,
      sms_sent: result.sms_sent || false,
      sms_error: result.sms_error || null
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.billsRepresentative = async (req, res) => {
  try {
    const sales_rep_id = req.user && req.user.id;
    const bills = await shopService.billsForRepresentative(sales_rep_id);
    res.json({ bills });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.recordPayment = async (req, res) => {
  try {
    const order_id = req.params.id;
    const sales_rep_id = req.user && req.user.id;
    const { amount, notes } = req.body;
    const result = await shopService.recordPayment({ order_id, sales_rep_id, amount, notes });
    
    // Return payment ID and SMS status
    res.json({ 
      message: 'Payment recorded successfully',
      payment_id: result.id,
      sms_sent: result.sms_sent || false,
      sms_error: result.sms_error || null
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.recordReturn = async (req, res) => {
  try {
    const order_id = req.params.id;
    const sales_rep_id = req.user && req.user.id;
    const { items } = req.body;
    const result = await shopService.recordReturn({ order_id, sales_rep_id, items });
    
    res.json({ 
      message: 'Return recorded successfully',
      order_id: result.id,
      total: result.total
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.listOrderLogs = async (req, res) => {
  try {
    const logs = await shopService.listOrderLogs();
    res.json({ logs });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.listPaymentLogs = async (req, res) => {
  try {
    const logs = await shopService.listPaymentLogs();
    res.json({ logs });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getSalesRepresentativesWithStats = async (req, res) => {
  try {
    const representatives = await shopService.getSalesRepresentativesWithStats();
    res.json({ representatives });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// New controller for getting pending orders count
exports.getPendingOrdersCount = async (req, res) => {
  try {
    const sales_rep_id = req.user && req.user.id;
    const count = await shopService.getPendingOrdersCount(sales_rep_id);
    res.json({ pending_count: count });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// New controller for getting pending orders
exports.getPendingOrders = async (req, res) => {
  try {
    const sales_rep_id = req.user && req.user.id;
    const orders = await shopService.getPendingOrders(sales_rep_id);
    res.json({ orders });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// New controller for getting order details
exports.getOrderDetails = async (req, res) => {
  try {
    const { order_id } = req.params;
    const orderDetails = await shopService.getOrderDetails(order_id);
    res.json({ order: orderDetails });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// New controller for getting order payments
exports.getOrderPayments = async (req, res) => {
  try {
    const { order_id } = req.params;
    const payments = await shopService.getOrderPayments(order_id);
    res.json({ payments });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// New controller for sales representatives to get their order details
exports.getOrderDetailsForSalesRep = async (req, res) => {
  try {
    const { order_id } = req.params;
    const sales_rep_id = req.user && req.user.id;
    
    // Get order details and verify it belongs to this sales representative
    const orderDetails = await shopService.getOrderDetails(order_id);
    
    if (!orderDetails) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check if the order belongs to this sales representative
    const order = await shopService.getOrderById(order_id);
    if (!order || order.sales_rep_id !== sales_rep_id) {
      return res.status(403).json({ error: 'Access denied - Order does not belong to you' });
    }
    
    res.json({ order: orderDetails });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Sales representative can edit their pending orders
exports.updatePendingOrderForSalesRep = async (req, res) => {
  try {
    const { order_id } = req.params;
    const sales_rep_id = req.user && req.user.id;
    const { notes, items } = req.body;

    const updatedOrder = await shopService.updatePendingOrderForSalesRep({
      order_id,
      sales_rep_id,
      notes,
      items
    });

    res.json({ order: updatedOrder });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Admin can edit orders (including approved)
exports.updateOrderAsAdmin = async (req, res) => {
  try {
    const { order_id } = req.params;
    const admin_id = req.user && req.user.id;
    const { notes, items } = req.body;

    const updatedOrder = await shopService.updateOrderAsAdmin({
      order_id,
      admin_id,
      notes,
      items
    });

    res.json({ order: updatedOrder });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.listSalesQuantityLogs = async (req, res) => {
  try {
    const logs = await productService.listSalesQuantityLogs();
    res.json({ logs });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getInventoryStats = async (req, res) => {
  try {
    const stats = await productService.getInventoryStats();
    res.json({ stats });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// New controller for getting detailed shop information
exports.getShopDetails = async (req, res) => {
  try {
    const { shop_id } = req.params;
    
    if (!shop_id) {
      return res.status(400).json({ error: 'Shop ID is required' });
    }
    
    console.log('Getting shop details for shop_id:', shop_id);
    const shopDetails = await shopService.getShopDetails(shop_id);
    console.log('Shop details retrieved successfully');
    
    res.json({ shop: shopDetails });
  } catch (error) {
    console.error('Error in getShopDetails:', error);
    res.status(400).json({ error: error.message });
  }
};

// New controller for sending order notification via SMS
exports.sendOrderSMS = async (req, res) => {
  try {
    const { order_id } = req.params;
    const sales_rep_id = req.user && req.user.id;
    
    // Get order details with shop and items
    const orderDetails = await shopService.getOrderDetails(order_id);
    if (!orderDetails) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Verify the order belongs to this sales rep
    if (orderDetails.sales_rep_id !== sales_rep_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if shop has phone number
    if (!orderDetails.shop.phone) {
      return res.status(400).json({ 
        error: 'Shop phone number not available. Please update shop details with a valid phone number.' 
      });
    }
    
    const result = await messagingService.sendSMS(
      orderDetails.shop.phone,
      messagingService.formatOrderMessage(orderDetails, orderDetails.shop, orderDetails.items, 'sms')
    );
    
    res.json(result);
  } catch (error) {
    console.error('SMS sending error:', error);
    res.status(400).json({ error: error.message });
  }
};

// New controller for sending order notification via WhatsApp
exports.sendOrderWhatsApp = async (req, res) => {
  try {
    const { order_id } = req.params;
    const sales_rep_id = req.user && req.user.id;
    
    // Get order details with shop and items
    const orderDetails = await shopService.getOrderDetails(order_id);
    if (!orderDetails) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Verify the order belongs to this sales rep
    if (orderDetails.sales_rep_id !== sales_rep_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if shop has phone number
    if (!orderDetails.shop.phone) {
      return res.status(400).json({ 
        error: 'Shop phone number not available. Please update shop details with a valid phone number.' 
      });
    }
    
    const result = await messagingService.sendWhatsApp(
      orderDetails.shop.phone,
      messagingService.formatOrderMessage(orderDetails, orderDetails.shop, orderDetails.items, 'whatsapp')
    );
    
    res.json(result);
  } catch (error) {
    console.error('WhatsApp sending error:', error);
    res.status(400).json({ error: error.message });
  }
};

// New controller for sending order notification via both channels
exports.sendOrderNotification = async (req, res) => {
  try {
    const { order_id } = req.params;
    const { channels = ['sms', 'whatsapp'] } = req.body;
    const sales_rep_id = req.user && req.user.id;
    
    // Get order details with shop and items
    const orderDetails = await shopService.getOrderDetails(order_id);
    if (!orderDetails) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Verify the order belongs to this sales rep
    if (orderDetails.sales_rep_id !== sales_rep_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if shop has phone number
    if (!orderDetails.shop.phone) {
      return res.status(400).json({ 
        error: 'Shop phone number not available. Please update shop details with a valid phone number.' 
      });
    }
    
    const results = await messagingService.sendOrderNotification(
      orderDetails,
      orderDetails.shop,
      orderDetails.items,
      channels
    );
    
    res.json(results);
  } catch (error) {
    console.error('Notification sending error:', error);
    res.status(400).json({ error: error.message });
  }
}; 

// New controller for sending payment notification via SMS
exports.sendPaymentSMS = async (req, res) => {
  try {
    const { payment_id } = req.params;
    const sales_rep_id = req.user && req.user.id;
    
    // Get payment details with order and shop
    const paymentDetails = await shopService.getPaymentDetails(payment_id);
    if (!paymentDetails) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Verify the payment belongs to this sales rep
    if (paymentDetails.sales_rep_id !== sales_rep_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if shop has phone number
    if (!paymentDetails.shop.phone) {
      return res.status(400).json({ 
        error: 'Shop phone number not available. Please update shop details with a valid phone number.' 
      });
    }
    
    const result = await messagingService.sendSMS(
      paymentDetails.shop.phone,
      messagingService.formatPaymentMessage(
        paymentDetails.payment, 
        paymentDetails.order, 
        paymentDetails.shop, 
        paymentDetails.remainingBillsCount, 
        'sms'
      )
    );
    
    res.json(result);
  } catch (error) {
    console.error('Payment SMS sending error:', error);
    res.status(400).json({ error: error.message });
  }
};

// New controller for sending payment notification via WhatsApp
exports.sendPaymentWhatsApp = async (req, res) => {
  try {
    const { payment_id } = req.params;
    const sales_rep_id = req.user && req.user.id;
    
    // Get payment details with order and shop
    const paymentDetails = await shopService.getPaymentDetails(payment_id);
    if (!paymentDetails) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Verify the payment belongs to this sales rep
    if (paymentDetails.sales_rep_id !== sales_rep_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if shop has phone number
    if (!paymentDetails.shop.phone) {
      return res.status(400).json({ 
        error: 'Shop phone number not available. Please update shop details with a valid phone number.' 
      });
    }
    
    const result = await messagingService.sendWhatsApp(
      paymentDetails.shop.phone,
      messagingService.formatPaymentMessage(
        paymentDetails.payment, 
        paymentDetails.order, 
        paymentDetails.shop, 
        paymentDetails.remainingBillsCount, 
        'whatsapp'
      )
    );
    
    res.json(result);
  } catch (error) {
    console.error('Payment WhatsApp sending error:', error);
    res.status(400).json({ error: error.message });
  }
};

// New controller for sending payment notification via both channels
exports.sendPaymentNotification = async (req, res) => {
  try {
    const { payment_id } = req.params;
    const { channels = ['sms', 'whatsapp'] } = req.body;
    const sales_rep_id = req.user && req.user.id;
    
    // Get payment details with order and shop
    const paymentDetails = await shopService.getPaymentDetails(payment_id);
    if (!paymentDetails) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Verify the payment belongs to this sales rep
    if (paymentDetails.sales_rep_id !== sales_rep_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if shop has phone number
    if (!paymentDetails.shop.phone) {
      return res.status(400).json({ 
        error: 'Shop phone number not available. Please update shop details with a valid phone number.' 
      });
    }
    
    const result = await messagingService.sendPaymentNotification(
      paymentDetails.payment,
      paymentDetails.order,
      paymentDetails.shop,
      paymentDetails.remainingBillsCount,
      channels
    );
    
    res.json(result);
  } catch (error) {
    console.error('Payment notification sending error:', error);
    res.status(400).json({ error: error.message });
  }
}; 

// New controller for sending order approval notification via SMS
exports.sendOrderApprovalSMS = async (req, res) => {
  try {
    const { order_id } = req.params;
    const admin_id = req.user && req.user.id;
    
    // Get order details with shop and items
    const orderDetails = await shopService.getOrderDetails(order_id);
    if (!orderDetails) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check if shop has phone number
    if (!orderDetails.shop.phone) {
      return res.status(400).json({ 
        error: 'Shop phone number not available. Please update shop details with a valid phone number.' 
      });
    }
    
    const result = await messagingService.sendSMS(
      orderDetails.shop.phone,
      messagingService.formatOrderApprovalMessage(orderDetails, orderDetails.shop, orderDetails.items, 'sms')
    );
    
    res.json(result);
  } catch (error) {
    console.error('Order approval SMS sending error:', error);
    res.status(400).json({ error: error.message });
  }
};

// New controller for sending order approval notification via WhatsApp
exports.sendOrderApprovalWhatsApp = async (req, res) => {
  try {
    const { order_id } = req.params;
    const admin_id = req.user && req.user.id;
    
    // Get order details with shop and items
    const orderDetails = await shopService.getOrderDetails(order_id);
    if (!orderDetails) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check if shop has phone number
    if (!orderDetails.shop.phone) {
      return res.status(400).json({ 
        error: 'Shop phone number not available. Please update shop details with a valid phone number.' 
      });
    }
    
    const result = await messagingService.sendWhatsApp(
      orderDetails.shop.phone,
      messagingService.formatOrderApprovalMessage(orderDetails, orderDetails.shop, orderDetails.items, 'whatsapp')
    );
    
    res.json(result);
  } catch (error) {
    console.error('Order approval WhatsApp sending error:', error);
    res.status(400).json({ error: error.message });
  }
};

// New controller for sending order approval notification via both channels
exports.sendOrderApprovalNotification = async (req, res) => {
  try {
    const { order_id } = req.params;
    const { channels = ['sms', 'whatsapp'] } = req.body;
    const admin_id = req.user && req.user.id;
    
    // Get order details with shop and items
    const orderDetails = await shopService.getOrderDetails(order_id);
    if (!orderDetails) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check if shop has phone number
    if (!orderDetails.shop.phone) {
      return res.status(400).json({ 
        error: 'Shop phone number not available. Please update shop details with a valid phone number.' 
      });
    }
    
    const result = await messagingService.sendOrderApprovalNotification(
      orderDetails,
      orderDetails.shop,
      orderDetails.items,
      channels
    );
    
    res.json(result);
  } catch (error) {
    console.error('Order approval notification sending error:', error);
    res.status(400).json({ error: error.message });
  }
}; 

// New controller for getting representative collections
exports.getRepresentativeCollections = async (req, res) => {
  try {
    const sales_rep_id = req.user && req.user.id;
    const collections = await shopService.getRepresentativeCollections(sales_rep_id);
    res.json({ collections });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// New controller for getting representative collection statistics
exports.getRepresentativeCollectionStats = async (req, res) => {
  try {
    const sales_rep_id = req.user && req.user.id;
    const stats = await shopService.getRepresentativeCollectionStats(sales_rep_id);
    res.json({ stats });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}; 
