const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { authMiddleware, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Configure multer for profile photo uploads
const profilePhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/profile-photos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const profilePhotoUpload = multer({
  storage: profilePhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Povolené sú len obrázky (jpeg, jpg, png, gif)'));
    }
  }
});

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await db.getAsync(
      'SELECT id, email, first_name, last_name, nickname, profile_photo, role FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update current user profile
router.put('/profile', authMiddleware, profilePhotoUpload.single('profilePhoto'), async (req, res) => {
  try {
    const { firstName, lastName, nickname } = req.body;
    let profilePhotoPath = null;

    // Get current user data
    const currentUser = await db.getAsync(
      'SELECT profile_photo FROM users WHERE id = ?',
      [req.user.id]
    );

    if (req.file) {
      // Delete old photo if exists
      if (currentUser.profile_photo) {
        const oldPath = path.join(__dirname, '..', currentUser.profile_photo);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      
      profilePhotoPath = `/uploads/profile-photos/${req.file.filename}`;
    }

    // Update user profile
    const updateQuery = profilePhotoPath
      ? `UPDATE users SET first_name = ?, last_name = ?, nickname = ?, profile_photo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      : `UPDATE users SET first_name = ?, last_name = ?, nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    const updateParams = profilePhotoPath
      ? [firstName, lastName, nickname || null, profilePhotoPath, req.user.id]
      : [firstName, lastName, nickname || null, req.user.id];

    await db.runAsync(updateQuery, updateParams);

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get basic info for online users (available to all authenticated users)
router.get('/online-info', authMiddleware, async (req, res) => {
  try {
    const { userIds } = req.query;
    if (!userIds) {
      return res.json([]);
    }
    
    const ids = userIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    if (ids.length === 0) {
      return res.json([]);
    }
    
    const placeholders = ids.map(() => '?').join(',');
    const users = await db.allAsync(`
      SELECT id, first_name, last_name, nickname, profile_photo
      FROM users
      WHERE id IN (${placeholders}) AND is_active = 1
    `, ids);
    
    res.json(users);
  } catch (error) {
    console.error('Get online users info error:', error);
    res.status(500).json({ error: 'Failed to fetch online users info' });
  }
});

// Get all users
router.get('/', authMiddleware, requirePermission('manage_users'), async (req, res) => {
  try {
    const users = await db.allAsync(`
      SELECT id, email, first_name, last_name, nickname, profile_photo, hourly_rate, role, is_active, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    // Get permissions for each user
    for (const user of users) {
      const permissions = await db.allAsync(
        `SELECT p.name 
         FROM permissions p
         JOIN user_permissions up ON p.id = up.permission_id
         WHERE up.user_id = ?`,
        [user.id]
      );
      user.permissions = permissions.map(p => p.name);
    }

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Users can view their own profile or admins can view any
    if (req.user.id !== parseInt(id) && !req.user.permissions.includes('manage_users')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await db.getAsync(
      'SELECT id, email, first_name, last_name, nickname, profile_photo, hourly_rate, role, is_active FROM users WHERE id = ?',
      [id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const permissions = await db.allAsync(
      `SELECT p.name 
       FROM permissions p
       JOIN user_permissions up ON p.id = up.permission_id
       WHERE up.user_id = ?`,
      [id]
    );
    
    user.permissions = permissions.map(p => p.name);
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user (admin only)
router.post('/', authMiddleware, requirePermission('manage_users'), profilePhotoUpload.single('profilePhoto'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, nickname, hourlyRate, role, isActive = true } = req.body;
    const permissions = req.body.permissions ? JSON.parse(req.body.permissions) : [];
    let profilePhotoPath = null;
    
    if (req.file) {
      profilePhotoPath = `/uploads/profile-photos/${req.file.filename}`;
    }

    // Check if user already exists
    const existing = await db.getAsync('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.runAsync(
      `INSERT INTO users (email, password, first_name, last_name, nickname, profile_photo, hourly_rate, role, is_active, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, firstName, lastName, nickname || null, profilePhotoPath, hourlyRate || null, role || 'employee', isActive, true]
    );

    const userId = result.lastID;

    // Add permissions
    if (permissions.length > 0) {
      for (const permissionName of permissions) {
        const permission = await db.getAsync(
          'SELECT id FROM permissions WHERE name = ?',
          [permissionName]
        );
        if (permission) {
          await db.runAsync(
            'INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)',
            [userId, permission.id]
          );
        }
      }
    }

    res.status(201).json({ 
      id: userId,
      message: 'User created successfully' 
    });
  } catch (error) {
    console.error('Create user error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to create user: ' + error.message });
  }
});

// Update user
router.put('/:id', authMiddleware, requirePermission('manage_users'), profilePhotoUpload.single('profilePhoto'), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, firstName, lastName, nickname, hourlyRate, role, isActive } = req.body;
    const permissions = req.body.permissions ? JSON.parse(req.body.permissions) : undefined;
    let profilePhotoPath = null;

    // Get current user data
    const currentUser = await db.getAsync(
      'SELECT profile_photo FROM users WHERE id = ?',
      [id]
    );

    if (req.file) {
      // Delete old photo if exists
      if (currentUser.profile_photo) {
        const oldPath = path.join(__dirname, '..', currentUser.profile_photo);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      
      profilePhotoPath = `/uploads/profile-photos/${req.file.filename}`;
    }

    // Update basic info
    const updateQuery = profilePhotoPath
      ? `UPDATE users SET email = ?, first_name = ?, last_name = ?, nickname = ?, profile_photo = ?, hourly_rate = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      : `UPDATE users SET email = ?, first_name = ?, last_name = ?, nickname = ?, hourly_rate = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    const updateParams = profilePhotoPath
      ? [email, firstName, lastName, nickname || null, profilePhotoPath, hourlyRate || null, role, isActive === 'true' || isActive === true ? 1 : 0, id]
      : [email, firstName, lastName, nickname || null, hourlyRate || null, role, isActive === 'true' || isActive === true ? 1 : 0, id];

    await db.runAsync(updateQuery, updateParams);

    // Update password if provided
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.runAsync(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, id]
      );
    }

    // Update permissions
    if (permissions !== undefined) {
      // Remove all existing permissions
      await db.runAsync('DELETE FROM user_permissions WHERE user_id = ?', [id]);
      
      // Add new permissions
      for (const permissionName of permissions) {
        const permission = await db.getAsync(
          'SELECT id FROM permissions WHERE name = ?',
          [permissionName]
        );
        if (permission) {
          await db.runAsync(
            'INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)',
            [id, permission.id]
          );
        }
      }
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', authMiddleware, requirePermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting the last admin
    const user = await db.getAsync('SELECT role FROM users WHERE id = ?', [id]);
    if (user?.role === 'admin') {
      const adminCount = await db.getAsync('SELECT COUNT(*) as count FROM users WHERE role = ? AND id != ?', ['admin', id]);
      if (adminCount.count === 0) {
        return res.status(400).json({ error: 'Nemôžete vymazať posledného administrátora' });
      }
    }

    // Check if user has any data
    const checks = await Promise.all([
      db.getAsync('SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ? OR created_by = ?', [id, id]),
      db.getAsync('SELECT COUNT(*) as count FROM projects WHERE created_by = ?', [id]),
      db.getAsync('SELECT COUNT(*) as count FROM companies WHERE created_by = ?', [id]),
      db.getAsync('SELECT COUNT(*) as count FROM timesheets WHERE user_id = ?', [id]),
      db.getAsync('SELECT COUNT(*) as count FROM chat_messages WHERE sender_id = ? OR receiver_id = ?', [id, id]),
      db.getAsync('SELECT COUNT(*) as count FROM files WHERE uploaded_by = ?', [id]),
      db.getAsync('SELECT COUNT(*) as count FROM quotes WHERE created_by = ? OR reviewed_by = ?', [id, id]),
      db.getAsync('SELECT COUNT(*) as count FROM task_comments WHERE user_id = ?', [id]),
      db.getAsync('SELECT COUNT(*) as count FROM project_employees WHERE user_id = ?', [id])
    ]);

    const hasData = checks.some(check => check.count > 0);

    if (hasData) {
      // User has data - only deactivate
      await db.runAsync(
        'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      res.json({ 
        message: 'Používateľ bol deaktivovaný. Nemôže byť vymazaný, pretože má existujúce záznamy v systéme.',
        deactivated: true 
      });
    } else {
      // User has no data - can be deleted
      await db.runAsync('BEGIN TRANSACTION');
      try {
        // Delete user permissions
        await db.runAsync('DELETE FROM user_permissions WHERE user_id = ?', [id]);
        
        // Delete the user
        await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
        
        await db.runAsync('COMMIT');
        res.json({ 
          message: 'Používateľ bol úspešne vymazaný.',
          deleted: true 
        });
      } catch (err) {
        await db.runAsync('ROLLBACK');
        throw err;
      }
    }
  } catch (error) {
    console.error('Delete user error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to delete user: ' + error.message });
  }
});

// Get all permissions
router.get('/permissions/list', authMiddleware, requirePermission('manage_users'), async (req, res) => {
  try {
    const permissions = await db.allAsync('SELECT * FROM permissions ORDER BY name');
    res.json(permissions);
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await db.getAsync(
      'SELECT id, email, first_name, last_name, nickname, profile_photo, role FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update current user profile
router.put('/profile', authMiddleware, profilePhotoUpload.single('profilePhoto'), async (req, res) => {
  try {
    const { firstName, lastName, nickname } = req.body;
    let profilePhotoPath = null;

    // Get current user data
    const currentUser = await db.getAsync(
      'SELECT profile_photo FROM users WHERE id = ?',
      [req.user.id]
    );

    if (req.file) {
      // Delete old photo if exists
      if (currentUser.profile_photo) {
        const oldPath = path.join(__dirname, '..', currentUser.profile_photo);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      
      // Set new photo path
      profilePhotoPath = `/uploads/profile-photos/${req.file.filename}`;
    }

    // Update user profile
    const updateQuery = profilePhotoPath
      ? `UPDATE users SET first_name = ?, last_name = ?, nickname = ?, profile_photo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      : `UPDATE users SET first_name = ?, last_name = ?, nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    const updateParams = profilePhotoPath
      ? [firstName, lastName, nickname || null, profilePhotoPath, req.user.id]
      : [firstName, lastName, nickname || null, req.user.id];

    await db.runAsync(updateQuery, updateParams);

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;