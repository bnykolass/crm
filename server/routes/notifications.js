const express = require('express');
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

// Get Socket.io instance
let io;
const setSocketIO = (socketIO) => {
  io = socketIO;
};

const getSocketIO = () => io;

const router = express.Router();

// Get all notifications for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, offset = 0, unread_only = false } = req.query;
    
    let query = `
      SELECT 
        n.*,
        t.title as task_title,
        t.status as task_status,
        p.name as project_name,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM notifications n
      LEFT JOIN tasks t ON n.task_id = t.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE n.user_id = ?
    `;
    let params = [req.user.id];

    if (unread_only === 'true') {
      query += ' AND n.is_read = FALSE';
    }

    query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const notifications = await db.allAsync(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?';
    let countParams = [req.user.id];
    
    if (unread_only === 'true') {
      countQuery += ' AND is_read = FALSE';
    }
    
    const countResult = await db.getAsync(countQuery, countParams);

    res.json({
      notifications,
      total: countResult.total,
      unread_count: unread_only === 'true' ? countResult.total : 
        (await db.getAsync('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE', [req.user.id])).count
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread notification count
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const result = await db.getAsync(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    
    res.json({ count: result.count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify notification belongs to current user
    const notification = await db.getAsync(
      'SELECT user_id FROM notifications WHERE id = ?',
      [id]
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    if (notification.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.runAsync(
      'UPDATE notifications SET is_read = TRUE WHERE id = ?',
      [id]
    );
    
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authMiddleware, async (req, res) => {
  try {
    await db.runAsync(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify notification belongs to current user
    const notification = await db.getAsync(
      'SELECT user_id FROM notifications WHERE id = ?',
      [id]
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    if (notification.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.runAsync('DELETE FROM notifications WHERE id = ?', [id]);
    
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Create notification (internal function for other routes)
const createNotification = async (userId, type, title, message = null, taskId = null) => {
  try {
    const result = await db.runAsync(
      `INSERT INTO notifications (user_id, type, title, message, task_id)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, type, title, message, taskId]
    );
    
    // Get the full notification data
    const notification = await db.getAsync(`
      SELECT 
        n.*,
        t.title as task_title,
        t.status as task_status,
        p.name as project_name
      FROM notifications n
      LEFT JOIN tasks t ON n.task_id = t.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE n.id = ?
    `, [result.lastID]);
    
    // Send real-time notification via Socket.io
    if (io) {
      io.to(`user-${userId}`).emit('new-notification', {
        ...notification,
        timestamp: new Date().toISOString()
      });
      
      // Also emit unread count update
      const unreadCount = await db.getAsync(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
        [userId]
      );
      
      io.to(`user-${userId}`).emit('unread-count-update', {
        count: unreadCount.count
      });
    }
    
    return result.lastID;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

// Bulk create notifications for multiple users
const createBulkNotifications = async (userIds, type, title, message = null, taskId = null) => {
  try {
    const promises = userIds.map(userId => 
      createNotification(userId, type, title, message, taskId)
    );
    
    return await Promise.all(promises);
  } catch (error) {
    console.error('Create bulk notifications error:', error);
    throw error;
  }
};

module.exports = router;
module.exports.createNotification = createNotification;
module.exports.createBulkNotifications = createBulkNotifications;
module.exports.setSocketIO = setSocketIO;
module.exports.getSocketIO = getSocketIO;