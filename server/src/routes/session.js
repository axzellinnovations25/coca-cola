const express = require('express');
const router = express.Router();
const sessionService = require('../services/sessionService');
const { authenticateJWT } = require('../middleware/auth');

// Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const result = await sessionService.refreshSession(refreshToken);
    
    if (!result) {
      return res.status(401).json({ 
        error: 'Invalid or expired refresh token',
        code: 'REFRESH_FAILED'
      });
    }

    res.json({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      sessionId: result.sessionId
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Logout (invalidate current session)
router.post('/logout', authenticateJWT, async (req, res) => {
  try {
    const { sessionId } = req.user;
    
    if (sessionId) {
      await sessionService.invalidateSession(sessionId, req.user.id);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Logout from all devices (invalidate all sessions)
router.post('/logout-all', authenticateJWT, async (req, res) => {
  try {
    await sessionService.invalidateAllSessions(req.user.id);
    
    res.json({ message: 'Logged out from all devices successfully' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ error: 'Failed to logout from all devices' });
  }
});

// Get active sessions for current user
router.get('/active', authenticateJWT, async (req, res) => {
  try {
    const sessions = await sessionService.getActiveSessions(req.user.id);
    
    res.json({ 
      sessions: sessions.map(session => ({
        id: session.id,
        created_at: session.created_at,
        expires_at: session.expires_at,
        last_activity: session.last_activity
      }))
    });
  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({ error: 'Failed to get active sessions' });
  }
});

// Invalidate specific session
router.delete('/sessions/:sessionId', authenticateJWT, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    await sessionService.invalidateSession(sessionId, req.user.id);
    
    res.json({ message: 'Session invalidated successfully' });
  } catch (error) {
    console.error('Invalidate session error:', error);
    res.status(500).json({ error: 'Failed to invalidate session' });
  }
});

module.exports = router; 