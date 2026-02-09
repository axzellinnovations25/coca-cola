const jwt = require('jsonwebtoken');
const sessionService = require('../services/sessionService');
const pool = require('../db');

async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's an access token
    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Check if session is still valid
    if (!decoded.sessionId) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Check session status in the database
    const sessionResult = await pool.query(
      'SELECT is_active, expires_at FROM user_sessions WHERE id = $1 AND user_id = $2',
      [decoded.sessionId, decoded.id]
    );
    if (
      !sessionResult.rows.length ||
      !sessionResult.rows[0].is_active ||
      new Date(sessionResult.rows[0].expires_at) < new Date()
    ) {
      return res.status(401).json({ error: 'Session is inactive or expired. Please login again.' });
    }

    // Add user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      first_name: decoded.first_name,
      last_name: decoded.last_name,
      sessionId: decoded.sessionId
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please login again.'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token.'
      });
    } else {
      return res.status(401).json({ 
        error: 'Authentication failed',
        code: 'AUTH_FAILED',
        message: 'Authentication failed. Please login again.'
      });
    }
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

const requireAdminOrSuperadmin = requireRole(['admin', 'superadmin']);
const requireSalesRep = requireRole(['representative']);

module.exports = {
  authenticateJWT,
  requireRole,
  requireAdminOrSuperadmin,
  requireSalesRep
}; 