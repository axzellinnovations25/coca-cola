const userService = require('../services/userService');
const emailService = require('../services/emailService');
const sessionService = require('../services/sessionService');

exports.createUser = async (req, res) => {
  try {
    const { first_name, last_name, email, nic_no, phone_no, role, created_by } = req.body;
    const { user, password } = await userService.createUserService({ first_name, last_name, email, nic_no, phone_no, role, created_by });

    await emailService.sendGreetingEmail({
      to: email,
      firstName: first_name,
      email,
      password,
    });

    res.status(201).json({ message: 'User created and email sent', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    if (role !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const logs = await userService.getLogsService();
    res.json({ logs });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const session = await userService.loginService({ email, password });
    res.json(session);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const users = await userService.listUsersService(req.user);
    res.json({ users });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.editUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, nic_no, phone_no, role } = req.body;
    const editorId = req.user && req.user.id;
    const updatedUser = await userService.editUserService({ id, first_name, last_name, email, nic_no, phone_no, role, edited_by: editorId });
    res.json({ user: updatedUser });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deleterId = req.user && req.user.id;
    await userService.deleteUserService(id, deleterId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update logout handler to use session service
exports.logout = async (req, res) => {
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
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const { user, resetToken } = await userService.forgotPasswordService(email);
    
    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail({
        to: user.email,
        firstName: user.first_name,
        resetToken,
      });
      
      res.json({ 
        message: 'Password reset link has been sent to your email address.',
        success: true
      });
    } catch (emailError) {
      res.status(500).json({ 
        error: 'Failed to send password reset email. Please try again later.',
        success: false
      });
    }
    
  } catch (error) {
    if (error.message === 'No account found with this email address.') {
      res.status(404).json({ 
        error: 'No account found with this email address.',
        success: false
      });
    } else {
      res.status(500).json({ 
        error: 'An error occurred while processing your request. Please try again.',
        success: false
      });
    }
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    
    const result = await userService.resetPasswordService(token, newPassword);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.validateResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    const result = await userService.validateResetTokenService(token);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}; 