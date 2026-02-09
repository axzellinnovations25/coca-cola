const express = require('express');
const router = express.Router({ mergeParams: true });
const userController = require('../controllers/userController');
const { authenticateJWT } = require('../middleware/auth');
const productController = require('../controllers/productController');

function requireAdminOrSuperadmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

function requireSalesRep(req, res, next) {
  if (!req.user || req.user.role !== 'representative') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

// POST /api/:client/users (protected)
router.post('/users', authenticateJWT, userController.createUser);
// GET /api/:client/users (protected)
router.get('/users', authenticateJWT, userController.listUsers);
// PUT /api/:client/users/:id (protected)
router.put('/users/:id', authenticateJWT, userController.editUser);
// DELETE /api/:client/users/:id (protected)
router.delete('/users/:id', authenticateJWT, userController.deleteUser);
// GET /api/:client/logs (protected)
router.get('/logs', authenticateJWT, userController.getLogs);
// POST /api/:client/login (public)
router.post('/login', userController.login);
// POST /api/:client/logout (protected, but just for standardization)
router.post('/logout', authenticateJWT, userController.logout);

// Password reset routes (public)
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);
router.get('/validate-reset-token/:token', userController.validateResetToken);

// Product management routes
router.get('/products', authenticateJWT, requireAdminOrSuperadmin, productController.listProducts);
router.post('/products', authenticateJWT, requireAdminOrSuperadmin, productController.addProduct);
router.put('/products/:id', authenticateJWT, requireAdminOrSuperadmin, productController.editProduct);
router.delete('/products/:id', authenticateJWT, requireAdminOrSuperadmin, productController.deleteProduct);
router.get('/products/logs', authenticateJWT, requireAdminOrSuperadmin, productController.listProductLogs);

// Shop management routes
router.get('/shops', authenticateJWT, requireAdminOrSuperadmin, productController.listShops);
router.post('/shops', authenticateJWT, requireAdminOrSuperadmin, productController.addShop);
router.put('/shops/:id', authenticateJWT, requireAdminOrSuperadmin, productController.editShop);
router.delete('/shops/:id', authenticateJWT, requireAdminOrSuperadmin, productController.deleteShop);
router.get('/shops/:shop_id/details', authenticateJWT, requireAdminOrSuperadmin, productController.getShopDetails);
router.get('/shops/logs', authenticateJWT, requireAdminOrSuperadmin, productController.listShopLogs);

// Order and Payment Logs (Admin/Superadmin only)
router.get('/orders/logs', authenticateJWT, requireAdminOrSuperadmin, productController.listOrderLogs);
router.get('/payments/logs', authenticateJWT, requireAdminOrSuperadmin, productController.listPaymentLogs);

// Sales Quantity Logs and Inventory Stats (Admin/Superadmin only)
router.get('/sales-quantity/logs', authenticateJWT, requireAdminOrSuperadmin, productController.listSalesQuantityLogs);
router.get('/inventory/stats', authenticateJWT, requireAdminOrSuperadmin, productController.getInventoryStats);

// Sales rep order endpoints
router.get('/shops/assigned', authenticateJWT, requireSalesRep, productController.listAssignedShops);
router.get('/order-products', authenticateJWT, requireSalesRep, productController.listOrderProducts);
router.post('/orders', authenticateJWT, requireSalesRep, productController.createOrder);
router.get('/orders', authenticateJWT, requireSalesRep, productController.listOrders);
router.get('/orders/pending/count', authenticateJWT, requireSalesRep, productController.getPendingOrdersCount);
router.get('/orders/pending', authenticateJWT, requireSalesRep, productController.getPendingOrders);
router.put('/orders/:order_id', authenticateJWT, requireSalesRep, productController.updatePendingOrderForSalesRep);

// Admin order endpoints (must come before sales rep specific routes)
router.get('/orders/all', authenticateJWT, requireAdminOrSuperadmin, productController.listAllOrders);
router.get('/orders/:order_id', authenticateJWT, requireAdminOrSuperadmin, productController.getOrderDetails);
router.get('/orders/:order_id/payments', authenticateJWT, requireAdminOrSuperadmin, productController.getOrderPayments);
router.put('/orders/:order_id/approve', authenticateJWT, requireAdminOrSuperadmin, productController.approveOrder);
router.put('/orders/:order_id/reject', authenticateJWT, requireAdminOrSuperadmin, productController.rejectOrder);
router.put('/orders/:order_id/admin', authenticateJWT, requireAdminOrSuperadmin, productController.updateOrderAsAdmin);

// Sales rep specific order details (must come after admin routes)
router.get('/orders/:order_id/details', authenticateJWT, requireSalesRep, productController.getOrderDetailsForSalesRep);

// Messaging routes for order notifications
router.post('/orders/:order_id/send-sms', authenticateJWT, requireSalesRep, productController.sendOrderSMS);
router.post('/orders/:order_id/send-whatsapp', authenticateJWT, requireSalesRep, productController.sendOrderWhatsApp);
router.post('/orders/:order_id/send-notification', authenticateJWT, requireSalesRep, productController.sendOrderNotification);

// Messaging routes for order approval notifications (Admin only)
router.post('/orders/:order_id/approval/send-sms', authenticateJWT, requireAdminOrSuperadmin, productController.sendOrderApprovalSMS);
router.post('/orders/:order_id/approval/send-whatsapp', authenticateJWT, requireAdminOrSuperadmin, productController.sendOrderApprovalWhatsApp);
router.post('/orders/:order_id/approval/send-notification', authenticateJWT, requireAdminOrSuperadmin, productController.sendOrderApprovalNotification);

// Messaging routes for payment notifications
router.post('/payments/:payment_id/send-sms', authenticateJWT, requireSalesRep, productController.sendPaymentSMS);
router.post('/payments/:payment_id/send-whatsapp', authenticateJWT, requireSalesRep, productController.sendPaymentWhatsApp);
router.post('/payments/:payment_id/send-notification', authenticateJWT, requireSalesRep, productController.sendPaymentNotification);

router.get('/bills/representative', authenticateJWT, requireSalesRep, productController.billsRepresentative);
router.post('/bills/:id/payment', authenticateJWT, requireSalesRep, productController.recordPayment);
router.post('/bills/:id/return', authenticateJWT, requireSalesRep, productController.recordReturn);

// Representative collections routes
router.get('/collections/representative', authenticateJWT, requireSalesRep, productController.getRepresentativeCollections);
router.get('/collections/representative/stats', authenticateJWT, requireSalesRep, productController.getRepresentativeCollectionStats);

// Sales representatives statistics (Admin/Superadmin only)
router.get('/sales-representatives/stats', authenticateJWT, requireAdminOrSuperadmin, productController.getSalesRepresentativesWithStats);

module.exports = router; 
