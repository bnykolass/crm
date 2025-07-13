const jwt = require('jsonwebtoken');
const db = require('../database/db');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.getAsync(
      `SELECT id, email, first_name, last_name, nickname, profile_photo, role 
       FROM users 
       WHERE id = ? AND is_active = 1`,
      [decoded.userId]
    );

    if (!user) {
      throw new Error();
    }

    // Get user permissions
    const permissions = await db.allAsync(
      `SELECT p.name 
       FROM permissions p
       JOIN user_permissions up ON p.id = up.permission_id
       WHERE up.user_id = ?`,
      [user.id]
    );

    req.user = user;
    req.user.permissions = permissions.map(p => p.name);
    req.token = token;
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (req.user.role === 'admin' || req.user.permissions.includes(permission)) {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
};

module.exports = { authMiddleware, requirePermission };