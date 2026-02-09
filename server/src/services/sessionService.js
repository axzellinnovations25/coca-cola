const jwt = require('jsonwebtoken');
const pool = require('../db');

// Session configuration
const SESSION_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '1h', // 1 hour for access token (shorter for security)
  REFRESH_TOKEN_EXPIRY: '5d', // 5 days for refresh token (as requested)
  MAX_SESSIONS_PER_USER: 1, // Maximum active sessions per user
};

/**
 * Create a new session for a user
 * @param {Object} user - User object
 * @returns {Object} - Session tokens and info
 */
async function createSession(user) {
  try {
    // Check if user has too many active sessions
    const activeSessions = await getActiveSessions(user.id);
    if (activeSessions.length >= SESSION_CONFIG.MAX_SESSIONS_PER_USER) {
      // Remove oldest session
      await removeOldestSession(user.id);
    }

    // Generate a single session ID to use for both token and database
    const sessionId = generateSessionId();

    // Create access token (1 hour)
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        type: 'access',
        sessionId: sessionId, // Use the same sessionId
      },
      process.env.JWT_SECRET,
      { expiresIn: SESSION_CONFIG.ACCESS_TOKEN_EXPIRY }
    );

    // Create refresh token (5 days)
    const refreshToken = jwt.sign(
      {
        id: user.id,
        type: 'refresh',
        sessionId: sessionId, // Use the same sessionId
      },
      process.env.JWT_SECRET,
      { expiresIn: SESSION_CONFIG.REFRESH_TOKEN_EXPIRY }
    );

    // Store session in database using the same sessionId
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

    await pool.query(
      `INSERT INTO user_sessions (id, user_id, access_token_hash, refresh_token_hash, expires_at, created_at, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), true, NOW())`,
      [
        sessionId, // Use the same sessionId
        user.id,
        hashToken(accessToken),
        hashToken(refreshToken),
        expiresAt
      ]
    );

    // Log session creation
    await logSessionAction({
      user_id: user.id,
      action: 'session_created',
      session_id: sessionId,
      details: { ip_address: null, user_agent: null }
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 1 * 60 * 60, // 1 hour in seconds
      sessionId
    };
  } catch (error) {
    console.error('Session creation error:', error);
    throw new Error('Failed to create session');
  }
}

/**
 * Validate and refresh an access token
 * @param {string} refreshToken - Refresh token
 * @returns {Object} - New tokens or null if invalid
 */
async function refreshSession(refreshToken) {
  try {
    // Verify refresh token
    const refreshDecoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (refreshDecoded.type !== 'refresh') {
      throw new Error('Invalid refresh token type');
    }

    // Check if session exists and is valid
    const session = await getSessionByTokenHash(hashToken(refreshToken));
    if (!session || new Date() > session.expires_at) {
      throw new Error('Session expired or invalid');
    }

    // Get user details
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [refreshDecoded.id]);
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Create new access token using the existing sessionId
    const newAccessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        type: 'access',
        sessionId: session.id, // Use the existing sessionId
      },
      process.env.JWT_SECRET,
      { expiresIn: SESSION_CONFIG.ACCESS_TOKEN_EXPIRY }
    );

    // Update session with new access token
    await pool.query(
      'UPDATE user_sessions SET access_token_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashToken(newAccessToken), session.id]
    );

    return {
      accessToken: newAccessToken,
      expiresIn: 1 * 60 * 60, // 1 hour in seconds
      sessionId: session.id
    };
  } catch (error) {
    console.error('Session refresh error:', error);
    return null;
  }
}

/**
 * Invalidate a session (logout)
 * @param {string} sessionId - Session ID to invalidate
 * @param {string} userId - User ID
 */
async function invalidateSession(sessionId, userId) {
  try {
    await pool.query(
      'UPDATE user_sessions SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    // Log session invalidation
    await logSessionAction({
      user_id: userId,
      action: 'session_invalidated',
      session_id: sessionId,
      details: { reason: 'user_logout' }
    });
  } catch (error) {
    console.error('Session invalidation error:', error);
  }
}

/**
 * Invalidate all sessions for a user
 * @param {string} userId - User ID
 */
async function invalidateAllSessions(userId) {
  try {
    await pool.query(
      'UPDATE user_sessions SET is_active = false, updated_at = NOW() WHERE user_id = $1',
      [userId]
    );

    // Log all sessions invalidation
    await logSessionAction({
      user_id: userId,
      action: 'all_sessions_invalidated',
      session_id: null,
      details: { reason: 'security_measure' }
    });
  } catch (error) {
    console.error('All sessions invalidation error:', error);
  }
}

/**
 * Get active sessions for a user
 * @param {string} userId - User ID
 * @returns {Array} - Active sessions
 */
async function getActiveSessions(userId) {
  try {
    const result = await pool.query(
      `SELECT id, created_at, expires_at, last_activity 
       FROM user_sessions 
       WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error('Get active sessions error:', error);
    return [];
  }
}

/**
 * Clean up expired sessions
 */
async function cleanupExpiredSessions() {
  try {
    await pool.query(
      'UPDATE user_sessions SET is_active = false WHERE expires_at < NOW() AND is_active = true'
    );
  } catch (error) {
    console.error('Cleanup expired sessions error:', error);
  }
}

// Helper functions
function generateSessionId() {
  return require('crypto').randomBytes(32).toString('hex');
}

function hashToken(token) {
  return require('crypto').createHash('sha256').update(token).digest('hex');
}

async function getSessionByTokenHash(tokenHash) {
  const result = await pool.query(
    'SELECT * FROM user_sessions WHERE refresh_token_hash = $1 AND is_active = true',
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function removeOldestSession(userId) {
  const result = await pool.query(
    `UPDATE user_sessions 
     SET is_active = false, updated_at = NOW() 
     WHERE user_id = $1 AND is_active = true 
     AND id = (
       SELECT id FROM user_sessions 
       WHERE user_id = $1 AND is_active = true 
       ORDER BY created_at ASC 
       LIMIT 1
     )`,
    [userId]
  );
}

async function logSessionAction({ user_id, action, session_id, details }) {
  try {
    await pool.query(
      `INSERT INTO session_logs (user_id, action, session_id, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [user_id, action, session_id, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Session log error:', error);
  }
}

module.exports = {
  createSession,
  refreshSession,
  invalidateSession,
  invalidateAllSessions,
  getActiveSessions,
  cleanupExpiredSessions,
  SESSION_CONFIG
}; 