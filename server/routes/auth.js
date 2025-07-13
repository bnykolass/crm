const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.getAsync(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Get user permissions
    const permissions = await db.allAsync(
      `SELECT p.name 
       FROM permissions p
       JOIN user_permissions up ON p.id = up.permission_id
       WHERE up.user_id = ?`,
      [user.id]
    );

    // Update first login status
    if (user.first_login) {
      await db.runAsync(
        'UPDATE users SET first_login = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        nickname: user.nickname,
        profile_photo: user.profile_photo,
        role: user.role,
        permissions: permissions.map(p => p.name),
        mustChangePassword: user.must_change_password || user.first_login
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.first_name,
      lastName: req.user.last_name,
      nickname: req.user.nickname,
      profile_photo: req.user.profile_photo,
      role: req.user.role,
      permissions: req.user.permissions
    }
  });
});

// Change password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await db.getAsync(
      'SELECT password FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await db.runAsync(
      'UPDATE users SET password = ?, must_change_password = 0, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;