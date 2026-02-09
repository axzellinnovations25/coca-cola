const pool = require('../db');
const { generateRandomPassword, hashPassword, generateResetToken, generateResetTokenHash } = require('../utils/password');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sessionService = require('./sessionService');

async function logAction({ user_id, action, details }) {
  try {
    await pool.query(
      'INSERT INTO logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user_id, action, details ? JSON.stringify(details) : null]
    );
  } catch (error) {
    // Do not block user flows if audit logging fails
    console.warn('Log insert failed:', error.message);
  }
}

async function createUserService({ first_name, last_name, email, nic_no, phone_no, role, created_by }) {
  // 1. Validate input
  if (!first_name || !last_name || !email || !nic_no || !phone_no || !role) {
    throw new Error('All fields are required');
  }
  if (!['superadmin', 'admin', 'representative'].includes(role)) {
    throw new Error('Invalid role');
  }

  // 2. Check uniqueness
  const emailCheck = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (emailCheck.rows.length > 0) {
    throw new Error('Email already exists');
  }
  const nicCheck = await pool.query('SELECT 1 FROM users WHERE nic_no = $1', [nic_no]);
  if (nicCheck.rows.length > 0) {
    throw new Error('NIC No already exists');
  }

  // 3. Generate and hash password
  const password = generateRandomPassword(12);
  const password_hash = await hashPassword(password);

  // 4. Insert user
  const insertQuery = `
    INSERT INTO users (first_name, last_name, email, nic_no, phone_no, role, password_hash)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, first_name, last_name, email, nic_no, phone_no, role, created_at
  `;
  const values = [first_name, last_name, email, nic_no, phone_no, role, password_hash];
  const result = await pool.query(insertQuery, values);
  const user = result.rows[0];

  // 5. Log the action
  await logAction({
    user_id: created_by || null,
    action: 'create_user',
    details: { created_user_id: user.id, email, role },
  });

  return { user, password };
}

async function loginService({ email, password }) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid email or password');
  }

  const user = result.rows[0];
  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    throw new Error('Invalid email or password');
  }

  // Create session with 6-hour expiry
  const session = await sessionService.createSession(user);

  // Log successful login
  await logAction({
    user_id: user.id,
    action: 'login',
    details: { email: user.email, role: user.role }
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
    },
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    sessionId: session.sessionId
  };
}

async function getLogsService() {
  const result = await pool.query(`
    SELECT l.*, u.email as creator_email, u.role as creator_role
    FROM logs l
    LEFT JOIN users u ON l.user_id = u.id
    ORDER BY l.created_at DESC
  `);
  return result.rows;
}

async function listUsersService(requestingUser) {
  let result;
  if (requestingUser.role === 'superadmin') {
    result = await pool.query(`
      SELECT id, first_name, last_name, email, nic_no, phone_no, role, created_at
      FROM users
      ORDER BY created_at DESC
    `);
  } else if (requestingUser.role === 'admin') {
    result = await pool.query(`
      SELECT id, first_name, last_name, email, nic_no, phone_no, role, created_at
      FROM users
      WHERE role = 'representative'
      ORDER BY created_at DESC
    `);
  } else if (requestingUser.role === 'representative') {
    result = await pool.query(`
      SELECT id, first_name, last_name, email, nic_no, phone_no, role, created_at
      FROM users
      WHERE id = $1
      ORDER BY created_at DESC
    `, [requestingUser.id]);
  } else {
    throw new Error('Invalid role');
  }
  return result.rows;
}

async function editUserService({ id, first_name, last_name, email, nic_no, phone_no, role, edited_by }) {
  if (!id || !first_name || !last_name || !email || !nic_no || !phone_no || !role) {
    throw new Error('All fields are required');
  }
  if (!['superadmin', 'admin', 'representative'].includes(role)) {
    throw new Error('Invalid role');
  }
  // Check unique email (exclude current user)
  const emailCheck = await pool.query('SELECT 1 FROM users WHERE email = $1 AND id != $2', [email, id]);
  if (emailCheck.rows.length > 0) {
    throw new Error('Email already exists');
  }
  // Check unique NIC (exclude current user)
  const nicCheck = await pool.query('SELECT 1 FROM users WHERE nic_no = $1 AND id != $2', [nic_no, id]);
  if (nicCheck.rows.length > 0) {
    throw new Error('NIC No already exists');
  }
  // Fetch user before update for audit log
  const beforeRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  if (beforeRes.rows.length === 0) throw new Error('User not found');
  const beforeUser = beforeRes.rows[0];
  // Update user
  const updateQuery = `
    UPDATE users SET
      first_name = $1,
      last_name = $2,
      email = $3,
      nic_no = $4,
      phone_no = $5,
      role = $6,
      updated_at = now()
    WHERE id = $7
    RETURNING id, first_name, last_name, email, nic_no, phone_no, role, created_at
  `;
  const values = [first_name, last_name, email, nic_no, phone_no, role, id];
  const result = await pool.query(updateQuery, values);
  if (result.rows.length === 0) throw new Error('User not found');
  const afterUser = result.rows[0];
  // Log the edit
  await logAction({
    user_id: edited_by || null,
    action: 'edit_user',
    details: {
      edited_user_id: beforeUser.id,
      before: {
        email: beforeUser.email,
        role: beforeUser.role,
        first_name: beforeUser.first_name,
        last_name: beforeUser.last_name,
        nic_no: beforeUser.nic_no,
        phone_no: beforeUser.phone_no,
      },
      after: {
        email: afterUser.email,
        role: afterUser.role,
        first_name: afterUser.first_name,
        last_name: afterUser.last_name,
        nic_no: afterUser.nic_no,
        phone_no: afterUser.phone_no,
      },
    },
  });
  return afterUser;
}

async function deleteUserService(id, deleted_by) {
  // Fetch user info before deleting for audit log
  const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  if (userRes.rows.length === 0) throw new Error('User not found');
  const deletedUser = userRes.rows[0];

  // Check if user is referenced in shops table as sales_rep_id
  const shopsCheck = await pool.query('SELECT COUNT(*) as count FROM shops WHERE sales_rep_id = $1', [id]);
  const shopsCount = parseInt(shopsCheck.rows[0].count);

  if (shopsCount > 0) {
    throw new Error(`Cannot delete user. This user is assigned as a sales representative to ${shopsCount} shop(s). Please reassign or remove the shop assignments first.`);
  }

  // Check if user is referenced in orders table (if it exists)
  try {
    const ordersCheck = await pool.query('SELECT COUNT(*) as count FROM orders WHERE created_by = $1', [id]);
    const ordersCount = parseInt(ordersCheck.rows[0].count);
    
    if (ordersCount > 0) {
      throw new Error(`Cannot delete user. This user has created ${ordersCount} order(s). Please reassign or delete the orders first.`);
    }
  } catch (error) {
    // Orders table might not exist, continue with deletion
  }

  // Check if user is referenced in payments table (if it exists)
  try {
    const paymentsCheck = await pool.query('SELECT COUNT(*) as count FROM payments WHERE created_by = $1', [id]);
    const paymentsCount = parseInt(paymentsCheck.rows[0].count);
    
    if (paymentsCount > 0) {
      throw new Error(`Cannot delete user. This user has created ${paymentsCount} payment(s). Please reassign or delete the payments first.`);
    }
  } catch (error) {
    // Payments table might not exist, continue with deletion
  }

  // If all checks pass, proceed with deletion
  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) throw new Error('User not found');
  
  // Log the deletion
  await logAction({
    user_id: deleted_by || null,
    action: 'delete_user',
    details: {
      deleted_user_id: deletedUser.id,
      email: deletedUser.email,
      role: deletedUser.role,
    },
  });
}

async function forgotPasswordService(email) {
  // Check if user exists
  const userRes = await pool.query('SELECT id, first_name, last_name, email FROM users WHERE email = $1', [email]);
  if (userRes.rows.length === 0) {
    throw new Error('No account found with this email address.');
  }
  
  const user = userRes.rows[0];
  
  // Generate reset token
  const resetToken = generateResetToken();
  const resetTokenHash = generateResetTokenHash(resetToken);
  
  // Set expiration (15 minutes from now)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  
  // Store reset token in database
  await pool.query(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET token_hash = $2, expires_at = $3, created_at = now()',
    [user.id, resetTokenHash, expiresAt]
  );
  
  return {
    user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email },
    resetToken
  };
}

async function resetPasswordService(token, newPassword) {
  if (!token || !newPassword) {
    throw new Error('Token and new password are required');
  }
  
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  
  const tokenHash = generateResetTokenHash(token);
  
  // Find valid reset token
  const tokenRes = await pool.query(`
    SELECT prt.*, u.email 
    FROM password_reset_tokens prt 
    JOIN users u ON prt.user_id = u.id 
    WHERE prt.token_hash = $1 AND prt.expires_at > now() AND prt.used = false
  `, [tokenHash]);
  
  if (tokenRes.rows.length === 0) {
    throw new Error('Invalid or expired reset token');
  }
  
  const resetToken = tokenRes.rows[0];
  
  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);
  
  // Update user password
  await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [newPasswordHash, resetToken.user_id]);
  
  // Mark token as used
  await pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);
  
  // Log the password reset
  await logAction({
    user_id: resetToken.user_id,
    action: 'password_reset',
    details: { email: resetToken.email },
  });
  
  return { message: 'Password reset successfully' };
}

async function validateResetTokenService(token) {
  if (!token) {
    throw new Error('Token is required');
  }
  
  const tokenHash = generateResetTokenHash(token);
  
  const tokenRes = await pool.query(`
    SELECT prt.*, u.email 
    FROM password_reset_tokens prt 
    JOIN users u ON prt.user_id = u.id 
    WHERE prt.token_hash = $1 AND prt.expires_at > now() AND prt.used = false
  `, [tokenHash]);
  
  if (tokenRes.rows.length === 0) {
    
    // Let's also check if the token exists but is expired or used
    const allTokenRes = await pool.query(`
      SELECT prt.*, u.email 
      FROM password_reset_tokens prt 
      JOIN users u ON prt.user_id = u.id 
      WHERE prt.token_hash = $1
    `, [tokenHash]);
    
    if (allTokenRes.rows.length > 0) {
      const tokenInfo = allTokenRes.rows[0];
    } else {
    }
    
    throw new Error('Invalid or expired reset token');
  }
  
  return { valid: true, email: tokenRes.rows[0].email };
}

module.exports = {
  createUserService,
  forgotPasswordService,
  resetPasswordService,
  validateResetTokenService,
};
module.exports.getLogsService = getLogsService;
module.exports.loginService = loginService;
module.exports.listUsersService = listUsersService;
module.exports.editUserService = editUserService;
module.exports.deleteUserService = deleteUserService; 