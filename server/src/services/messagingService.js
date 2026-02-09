const axios = require('axios');

// Text.lk API Configuration
const TEXT_LK_CONFIG = {
  apiToken: process.env.TEXT_LK_API_TOKEN,
  senderId: process.env.TEXT_LK_SENDER_ID || 'MotionRep',
  baseUrl: 'https://app.text.lk/api/v3'
};

/**
 * Validate and format phone number for Text.lk API
 * @param {string} phoneNumber - Raw phone number from database
 * @returns {string} - Formatted phone number with country code
 */
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    throw new Error('Phone number is required');
  }

  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If it doesn't start with +, assume it's a Sri Lankan number
  if (!cleaned.startsWith('+')) {
    // If it starts with 0, replace with +94
    if (cleaned.startsWith('0')) {
      cleaned = '+94' + cleaned.substring(1);
    } else if (cleaned.startsWith('94')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 9) {
      // 9-digit number, add +94
      cleaned = '+94' + cleaned;
    } else {
      // Assume it's already a valid number
      cleaned = '+' + cleaned;
    }
  }
  
  // Validate the final format
  if (!/^\+\d{10,15}$/.test(cleaned)) {
    throw new Error(`Invalid phone number format: ${phoneNumber}`);
  }
  
  return cleaned;
}

/**
 * Send SMS using Text.lk API v3
 * @param {string} phoneNumber - Phone number with country code (e.g., +94712345678)
 * @param {string} message - Message content
 * @returns {Promise<Object>} - API response
 */
async function sendSMS(phoneNumber, message) {
  try {
    if (!TEXT_LK_CONFIG.apiToken) {
      throw new Error('Text.lk API token not configured');
    }

    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    

    const response = await axios.post(`${TEXT_LK_CONFIG.baseUrl}/sms/send`, {
      recipient: formattedPhone,
      sender_id: TEXT_LK_CONFIG.senderId,
      type: 'plain',
      message: message
    }, {
      headers: {
        'Authorization': `Bearer ${TEXT_LK_CONFIG.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (response.data.status === 'success') {
      return {
        success: true,
        data: response.data.data,
        messageId: response.data.data?.uid || null
      };
    } else {
      console.log(`SMS failed for ${formattedPhone}: ${response.data.message}`);
      return {
        success: false,
        error: response.data.message || 'Failed to send SMS'
      };
    }
  } catch (error) {
    console.error('SMS sending failed:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Send WhatsApp message using Text.lk API v3
 * @param {string} phoneNumber - Phone number with country code (e.g., +94712345678)
 * @param {string} message - Message content
 * @returns {Promise<Object>} - API response
 */
async function sendWhatsApp(phoneNumber, message) {
  try {
    if (!TEXT_LK_CONFIG.apiToken) {
      throw new Error('Text.lk API token not configured');
    }

    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    console.log(`Sending WhatsApp to: ${formattedPhone}`);

    const response = await axios.post(`${TEXT_LK_CONFIG.baseUrl}/sms/send`, {
      recipient: formattedPhone,
      sender_id: TEXT_LK_CONFIG.senderId,
      type: 'whatsapp',
      message: message
    }, {
      headers: {
        'Authorization': `Bearer ${TEXT_LK_CONFIG.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (response.data.status === 'success') {
      console.log(`WhatsApp sent successfully to ${formattedPhone}`);
      return {
        success: true,
        data: response.data.data,
        messageId: response.data.data?.uid || null
      };
    } else {
      console.log(`WhatsApp failed for ${formattedPhone}: ${response.data.message}`);
      return {
        success: false,
        error: response.data.message || 'Failed to send WhatsApp message'
      };
    }
  } catch (error) {
    console.error('WhatsApp sending failed:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Format order details for messaging
 * @param {Object} order - Order object
 * @param {Object} shop - Shop object
 * @param {Array} items - Order items
 * @param {string} type - 'sms' or 'whatsapp'
 * @returns {string} - Formatted message
 */
function formatOrderMessage(order, shop, items, type = 'sms') {
  const isSMS = type === 'sms';
  const maxLength = isSMS ? 1800 : 2000; // SMS has character limit
  
  let message = `MotionRep Order Notification\n\n`;
  message += `Order ID: ${order.id}\n`;
  message += `Shop: ${shop.name}\n`;
  message += `Address: ${shop.address}\n`;
  message += `Date: ${new Date(order.created_at).toLocaleDateString()}\n`;
  message += `Time: ${new Date(order.created_at).toLocaleTimeString()}\n\n`;
  
  message += `Order Items:\n`;
  items.forEach((item, index) => {
    message += `${index + 1}. ${item.name}\n`;
    message += `Qty: ${item.quantity} x ${Number(item.unit_price).toFixed(2)} LKR\n`;
    message += `Total: ${(item.unit_price * item.quantity).toFixed(2)} LKR\n\n`;
  });
  
  message += `Total Amount: ${Number(order.total).toFixed(2)} LKR\n\n`;
  message += `Status: PENDING APPROVAL\n\n`;
  
  if (order.notes) {
    message += `Notes: ${order.notes}\n\n`;
  }
  
  message += `This is a draft order awaiting for approval.\n`;
  message += `Contact your sales representative for any queries.\n\n`;
  message += `Thank you for choosing S.B Distribution!`;

  // Truncate if too long for SMS
  if (isSMS && message.length > maxLength) {
    message = message.substring(0, maxLength - 3) + '...';
  }

  return message;
}

/**
 * Send order notification to shop owner
 * @param {Object} order - Order object
 * @param {Object} shop - Shop object
 * @param {Array} items - Order items
 * @param {Array} channels - Array of channels to send to ('sms', 'whatsapp')
 * @returns {Promise<Object>} - Results for each channel
 */
async function sendOrderNotification(order, shop, items, channels = ['sms', 'whatsapp']) {
  const results = {};
  
  // Validate shop phone number
  if (!shop.phone) {
    return {
      error: 'Shop phone number not available',
      success: false
    };
  }
  
  for (const channel of channels) {
    try {
      const message = formatOrderMessage(order, shop, items, channel);
      
      if (channel === 'sms') {
        results.sms = await sendSMS(shop.phone, message);
      } else if (channel === 'whatsapp') {
        results.whatsapp = await sendWhatsApp(shop.phone, message);
      }
    } catch (error) {
      results[channel] = {
        success: false,
        error: error.message
      };
    }
  }
  
  return results;
}

/**
 * Format payment notification message
 * @param {Object} payment - Payment object
 * @param {Object} order - Order object
 * @param {Object} shop - Shop object
 * @param {number} remainingBillsCount - Number of remaining bills for the shop
 * @param {string} type - 'sms' or 'whatsapp'
 * @returns {string} - Formatted message
 */
function formatPaymentMessage(payment, order, shop, remainingBillsCount, type = 'sms') {
  const isSMS = type === 'sms';
  const maxLength = isSMS ? 1800 : 2000; // SMS has character limit
  
  let message = `MotionRep Payment Notification\n\n`;
  message += `Payment ID: ${payment.id}\n`;
  message += `Order ID: ${order.id}\n`;
  message += `Shop: ${shop.name}\n`;
  message += `Address: ${shop.address}\n`;
  message += `Date: ${new Date(payment.created_at).toLocaleDateString()}\n`;
  message += `Time: ${new Date(payment.created_at).toLocaleTimeString()}\n\n`;
  
  message += `Payment Details:\n`;
  message += `Amount Paid: ${Number(payment.amount).toFixed(2)} LKR\n`;
  message += `Order Total: ${Number(order.total).toFixed(2)} LKR\n`;
  message += `Outstanding: ${Number(order.total - payment.collected).toFixed(2)} LKR\n`;
  message += `Remaining Bills: ${remainingBillsCount}\n\n`;
  
  if (payment.notes) {
    message += `Payment Notes: ${payment.notes}\n\n`;
  }
  
  message += `Thank you for your payment!\n`;
  message += `Contact your sales representative for any queries.\n\n`;
  message += `Thank you for choosing S.B Distribution!`;

  // Truncate if too long for SMS
  if (isSMS && message.length > maxLength) {
    message = message.substring(0, maxLength - 3) + '...';
  }

  return message;
}

/**
 * Send payment notification to shop owner
 * @param {Object} payment - Payment object
 * @param {Object} order - Order object
 * @param {Object} shop - Shop object
 * @param {number} remainingBillsCount - Number of remaining bills for the shop
 * @param {Array} channels - Array of channels to send to ('sms', 'whatsapp')
 * @returns {Promise<Object>} - Results for each channel
 */
async function sendPaymentNotification(payment, order, shop, remainingBillsCount, channels = ['sms']) {
  const results = {};
  
  // Validate shop phone number
  if (!shop.phone) {
    return {
      error: 'Shop phone number not available',
      success: false
    };
  }
  
  for (const channel of channels) {
    try {
      const message = formatPaymentMessage(payment, order, shop, remainingBillsCount, channel);
      
      if (channel === 'sms') {
        results.sms = await sendSMS(shop.phone, message);
      } else if (channel === 'whatsapp') {
        results.whatsapp = await sendWhatsApp(shop.phone, message);
      }
    } catch (error) {
      results[channel] = {
        success: false,
        error: error.message
      };
    }
  }
  
  return results;
}

/**
 * Format order approval notification message
 * @param {Object} order - Order object
 * @param {Object} shop - Shop object
 * @param {Array} items - Order items
 * @param {string} type - 'sms' or 'whatsapp'
 * @returns {string} - Formatted message
 */
function formatOrderApprovalMessage(order, shop, items, type = 'sms') {
  const isSMS = type === 'sms';
  const maxLength = isSMS ? 1800 : 2000; // SMS has character limit
  
  let message = `MotionRep Order Approval Notification\n\n`;
  message += `Order ID: ${order.id}\n`;
  message += `Shop: ${shop.name}\n`;
  message += `Address: ${shop.address}\n`;
  message += `Date: ${new Date(order.created_at).toLocaleDateString()}\n`;
  message += `Time: ${new Date(order.created_at).toLocaleTimeString()}\n\n`;
  
  message += `✅ ORDER APPROVED ✅\n\n`;
  
  message += `Order Items:\n`;
  items.forEach((item, index) => {
    message += `${index + 1}. ${item.name}\n`;
    message += `Qty: ${item.quantity} x ${Number(item.unit_price).toFixed(2)} LKR\n`;
    message += `Total: ${(item.unit_price * item.quantity).toFixed(2)} LKR\n\n`;
  });
  
  message += `Total Amount: ${Number(order.total).toFixed(2)} LKR\n\n`;
  message += `Status: APPROVED ✅\n\n`;
  
  if (order.notes) {
    message += `Notes: ${order.notes}\n\n`;
  }
  
  message += `Your order has been approved and is now active.\n`;
  message += `Please arrange payment with your sales representative.\n\n`;
  message += `Thank you for choosing S.B Distribution!`;

  // Truncate if too long for SMS
  if (isSMS && message.length > maxLength) {
    message = message.substring(0, maxLength - 3) + '...';
  }

  return message;
}

/**
 * Send order approval notification to shop owner
 * @param {Object} order - Order object
 * @param {Object} shop - Shop object
 * @param {Array} items - Order items
 * @param {Array} channels - Array of channels to send to ('sms', 'whatsapp')
 * @returns {Promise<Object>} - Results for each channel
 */
async function sendOrderApprovalNotification(order, shop, items, channels = ['sms']) {
  const results = {};
  
  // Validate shop phone number
  if (!shop.phone) {
    return {
      error: 'Shop phone number not available',
      success: false
    };
  }
  
  for (const channel of channels) {
    try {
      const message = formatOrderApprovalMessage(order, shop, items, channel);
      
      if (channel === 'sms') {
        results.sms = await sendSMS(shop.phone, message);
      } else if (channel === 'whatsapp') {
        results.whatsapp = await sendWhatsApp(shop.phone, message);
      }
    } catch (error) {
      results[channel] = {
        success: false,
        error: error.message
      };
    }
  }
  
  return results;
}

/**
 * Format order rejection notification message
 * @param {Object} order - Order object
 * @param {Object} shop - Shop object
 * @param {Array} items - Order items
 * @param {string} type - 'sms' or 'whatsapp'
 * @returns {string} - Formatted message
 */
function formatOrderRejectionMessage(order, shop, items, type = 'sms') {
  const isSMS = type === 'sms';
  const maxLength = isSMS ? 1800 : 2000; // SMS has character limit
  
  let message = `MotionRep Order Rejection Notification\n\n`;
  message += `Order ID: ${order.id}\n`;
  message += `Shop: ${shop.name}\n`;
  message += `Address: ${shop.address}\n`;
  message += `Date: ${new Date(order.created_at).toLocaleDateString()}\n`;
  message += `Time: ${new Date(order.created_at).toLocaleTimeString()}\n\n`;
  
  message += `❌ ORDER REJECTED ❌\n\n`;
  
  message += `Order Items:\n`;
  items.forEach((item, index) => {
    message += `${index + 1}. ${item.name}\n`;
    message += `Qty: ${item.quantity} x ${Number(item.unit_price).toFixed(2)} LKR\n`;
    message += `Total: ${(item.unit_price * item.quantity).toFixed(2)} LKR\n\n`;
  });
  
  message += `Total Amount: ${Number(order.total).toFixed(2)} LKR\n\n`;
  message += `Status: REJECTED ❌\n\n`;
  
  if (order.rejection_reason) {
    message += `Rejection Reason: ${order.rejection_reason}\n\n`;
  }
  
  if (order.notes) {
    message += `Original Notes: ${order.notes}\n\n`;
  }
  
  message += `Your order has been rejected.\n`;
  message += `Please contact your sales representative for more information.\n\n`;
  message += `Thank you for choosing S.B Distribution!`;

  // Truncate if too long for SMS
  if (isSMS && message.length > maxLength) {
    message = message.substring(0, maxLength - 3) + '...';
  }

  return message;
}

/**
 * Send order rejection notification to shop owner
 * @param {Object} order - Order object
 * @param {Object} shop - Shop object
 * @param {Array} items - Order items
 * @param {Array} channels - Array of channels to send to ('sms', 'whatsapp')
 * @returns {Promise<Object>} - Results for each channel
 */
async function sendOrderRejectionNotification(order, shop, items, channels = ['sms']) {
  const results = {};
  
  // Validate shop phone number
  if (!shop.phone) {
    return {
      error: 'Shop phone number not available',
      success: false
    };
  }
  
  for (const channel of channels) {
    try {
      const message = formatOrderRejectionMessage(order, shop, items, channel);
      
      if (channel === 'sms') {
        results.sms = await sendSMS(shop.phone, message);
      } else if (channel === 'whatsapp') {
        results.whatsapp = await sendWhatsApp(shop.phone, message);
      }
    } catch (error) {
      results[channel] = {
        success: false,
        error: error.message
      };
    }
  }
  
  return results;
}

module.exports = {
  sendSMS,
  sendWhatsApp,
  formatOrderMessage,
  sendOrderNotification,
  formatPaymentMessage,
  sendPaymentNotification,
  formatOrderApprovalMessage,
  sendOrderApprovalNotification,
  formatOrderRejectionMessage,
  sendOrderRejectionNotification,
  formatPhoneNumber
}; 