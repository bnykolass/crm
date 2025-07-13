const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { authMiddleware, requirePermission } = require('../middleware/auth');

// Configure multer for chat attachments
const attachmentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/chat-attachments');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'attachment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const attachmentUpload = multer({
  storage: attachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    // Allow most common file types
    const allowedExtensions = /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt|mp4|mp3|zip|rar|webp|bmp|svg)$/i;
    const allowedMimeTypes = /^(image|video|audio|application|text)\//;
    
    const extname = allowedExtensions.test(file.originalname);
    const mimetype = allowedMimeTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Nepovolený typ súboru'));
    }
  }
});

const router = express.Router();

// Get chat messages
router.get('/messages', authMiddleware, requirePermission('use_chat'), async (req, res) => {
  try {
    const { receiverId, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT cm.*, 
             s.first_name as sender_first_name, s.last_name as sender_last_name, s.nickname as sender_nickname, s.profile_photo as sender_profile_photo,
             r.first_name as receiver_first_name, r.last_name as receiver_last_name, r.nickname as receiver_nickname, r.profile_photo as receiver_profile_photo
      FROM chat_messages cm
      JOIN users s ON cm.sender_id = s.id
      LEFT JOIN users r ON cm.receiver_id = r.id
      WHERE (cm.sender_id = ? OR cm.receiver_id = ?)
    `;
    let params = [req.user.id, req.user.id];

    if (receiverId) {
      query += ' AND ((cm.sender_id = ? AND cm.receiver_id = ?) OR (cm.sender_id = ? AND cm.receiver_id = ?))';
      params.push(req.user.id, receiverId, receiverId, req.user.id);
    }

    query += ' ORDER BY cm.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const messages = await db.allAsync(query, params);
    
    res.json(messages.reverse()); // Reverse to show oldest first
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

// Send message with optional attachment
router.post('/messages', authMiddleware, requirePermission('use_chat'), attachmentUpload.single('attachment'), async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    let attachmentPath = null;
    let attachmentName = null;
    let attachmentType = null;

    // Either message or attachment is required
    if ((!message || !message.trim()) && !req.file) {
      return res.status(400).json({ error: 'Message or attachment is required' });
    }

    if (req.file) {
      attachmentPath = `/uploads/chat-attachments/${req.file.filename}`;
      attachmentName = req.file.originalname;
      attachmentType = req.file.mimetype;
    }

    // Check if receiver exists (if specified)
    if (receiverId) {
      const receiver = await db.getAsync('SELECT id FROM users WHERE id = ? AND is_active = true', [receiverId]);
      if (!receiver) {
        return res.status(404).json({ error: 'Receiver not found' });
      }
    }

    const result = await db.runAsync(
      'INSERT INTO chat_messages (sender_id, receiver_id, message, attachment_path, attachment_name, attachment_type) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, receiverId || null, message?.trim() || '', attachmentPath, attachmentName, attachmentType]
    );

    // Get the full message with sender info for real-time broadcast
    const newMessage = await db.getAsync(`
      SELECT cm.*, 
             s.first_name as sender_first_name, s.last_name as sender_last_name, s.nickname as sender_nickname, s.profile_photo as sender_profile_photo,
             r.first_name as receiver_first_name, r.last_name as receiver_last_name, r.nickname as receiver_nickname, r.profile_photo as receiver_profile_photo
      FROM chat_messages cm
      JOIN users s ON cm.sender_id = s.id
      LEFT JOIN users r ON cm.receiver_id = r.id
      WHERE cm.id = ?
    `, [result.lastID]);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark messages as read
router.patch('/messages/read', authMiddleware, requirePermission('use_chat'), async (req, res) => {
  try {
    const { senderId, groupId } = req.body;

    if (!senderId && !groupId) {
      return res.status(400).json({ error: 'Sender ID or Group ID is required' });
    }

    if (senderId) {
      await db.runAsync(
        'UPDATE chat_messages SET is_read = true WHERE sender_id = ? AND receiver_id = ? AND is_read = false',
        [senderId, req.user.id]
      );
    } else {
      await db.runAsync(
        'UPDATE chat_messages SET is_read = true WHERE group_id = ? AND sender_id != ? AND is_read = false',
        [groupId, req.user.id]
      );
    }

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark messages read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Get chat participants (users the current user has chatted with)
router.get('/participants', authMiddleware, requirePermission('use_chat'), async (req, res) => {
  try {
    const participants = await db.allAsync(`
      SELECT DISTINCT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.nickname,
        u.profile_photo,
        (SELECT COUNT(*) FROM chat_messages 
         WHERE sender_id = u.id AND receiver_id = ? AND is_read = false) as unread_count,
        (SELECT message FROM chat_messages 
         WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
         ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM chat_messages 
         WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
         ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM users u
      WHERE u.id != ? AND u.is_active = true
      AND EXISTS (
        SELECT 1 FROM chat_messages cm 
        WHERE (cm.sender_id = u.id AND cm.receiver_id = ?) 
           OR (cm.sender_id = ? AND cm.receiver_id = u.id)
      )
      ORDER BY last_message_time DESC
    `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);

    res.json(participants);
  } catch (error) {
    console.error('Get chat participants error:', error);
    res.status(500).json({ error: 'Failed to fetch chat participants' });
  }
});

// Get all active users (for starting new conversations)
router.get('/users', authMiddleware, requirePermission('use_chat'), async (req, res) => {
  try {
    const users = await db.allAsync(
      'SELECT id, first_name, last_name, email, nickname, profile_photo FROM users WHERE id != ? AND is_active = true ORDER BY first_name, last_name',
      [req.user.id]
    );

    res.json(users);
  } catch (error) {
    console.error('Get chat users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Delete message
router.delete('/messages/:id', authMiddleware, requirePermission('use_chat'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if message exists and user is the sender
    const message = await db.getAsync('SELECT sender_id FROM chat_messages WHERE id = ?', [id]);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    await db.runAsync('DELETE FROM chat_messages WHERE id = ?', [id]);
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Upload file attachment for direct messages
router.post('/upload', authMiddleware, requirePermission('use_chat'), attachmentUpload.single('file'), async (req, res) => {
  try {
    const { receiverId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const attachmentPath = `/uploads/chat-attachments/${req.file.filename}`;
    const attachmentName = req.file.originalname;
    const attachmentType = req.file.mimetype;

    // Check if receiver exists (if specified)
    if (receiverId) {
      const receiver = await db.getAsync('SELECT id FROM users WHERE id = ? AND is_active = true', [receiverId]);
      if (!receiver) {
        return res.status(404).json({ error: 'Receiver not found' });
      }
    }

    const result = await db.runAsync(
      'INSERT INTO chat_messages (sender_id, receiver_id, message, attachment_path, attachment_name, attachment_type) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, receiverId || null, '', attachmentPath, attachmentName, attachmentType]
    );

    // Get the full message with sender info for real-time broadcast
    const newMessage = await db.getAsync(`
      SELECT cm.*, 
             s.first_name as sender_first_name, s.last_name as sender_last_name, s.nickname as sender_nickname, s.profile_photo as sender_profile_photo,
             r.first_name as receiver_first_name, r.last_name as receiver_last_name, r.nickname as receiver_nickname, r.profile_photo as receiver_profile_photo
      FROM chat_messages cm
      JOIN users s ON cm.sender_id = s.id
      LEFT JOIN users r ON cm.receiver_id = r.id
      WHERE cm.id = ?
    `, [result.lastID]);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get unread messages count
router.get('/unread/count', authMiddleware, requirePermission('use_chat'), async (req, res) => {
  try {
    const count = await db.getAsync(`
      SELECT COUNT(*) as count 
      FROM chat_messages 
      WHERE receiver_id = ? AND is_read = false
    `, [req.user.id]);

    res.json({ count: count.count || 0 });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Create chat group
router.post('/groups', authMiddleware, requirePermission('use_chat'), async (req, res) => {
  try {
    const { name, description, memberIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const result = await db.runAsync(
      'INSERT INTO chat_groups (name, description, created_by) VALUES (?, ?, ?)',
      [name, description || null, req.user.id]
    );

    const groupId = result.lastID;

    // Add creator as admin
    await db.runAsync(
      'INSERT INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, ?)',
      [groupId, req.user.id, 'admin']
    );

    // Add other members
    if (memberIds && memberIds.length > 0) {
      for (const userId of memberIds) {
        if (userId !== req.user.id) {
          await db.runAsync(
            'INSERT OR IGNORE INTO chat_group_members (group_id, user_id) VALUES (?, ?)',
            [groupId, userId]
          );
        }
      }
    }

    res.status(201).json({ id: groupId, message: 'Group created successfully' });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Get user's chat groups
router.get('/groups', authMiddleware, requirePermission('use_chat'), async (req, res) => {
  try {
    const groups = await db.allAsync(`
      SELECT g.*, cgm.role,
        (SELECT COUNT(*) FROM chat_group_members WHERE group_id = g.id) as member_count,
        (SELECT COUNT(*) FROM chat_messages WHERE group_id = g.id AND sender_id != ? AND is_read = false) as unread_count
      FROM chat_groups g
      JOIN chat_group_members cgm ON g.id = cgm.group_id
      WHERE cgm.user_id = ?
      ORDER BY g.created_at DESC
    `, [req.user.id, req.user.id]);

    res.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get group messages
router.get('/groups/:groupId/messages', authMiddleware, requirePermission('use_chat'), async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Check if user is member of group
    const membership = await db.getAsync(
      'SELECT id FROM chat_group_members WHERE group_id = ? AND user_id = ?',
      [groupId, req.user.id]
    );

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const messages = await db.allAsync(`
      SELECT cm.*, u.first_name, u.last_name, u.nickname, u.profile_photo
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.group_id = ?
      ORDER BY cm.created_at DESC 
      LIMIT ? OFFSET ?
    `, [groupId, parseInt(limit), parseInt(offset)]);

    res.json(messages.reverse()); // Reverse to show oldest first
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({ error: 'Failed to fetch group messages' });
  }
});

// Send group message
router.post('/groups/:groupId/messages', authMiddleware, requirePermission('use_chat'), async (req, res) => {
  try {
    const { groupId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check if user is member of group
    const membership = await db.getAsync(
      'SELECT id FROM chat_group_members WHERE group_id = ? AND user_id = ?',
      [groupId, req.user.id]
    );

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const result = await db.runAsync(
      'INSERT INTO chat_messages (sender_id, group_id, message) VALUES (?, ?, ?)',
      [req.user.id, groupId, message.trim()]
    );

    const newMessage = await db.getAsync(`
      SELECT cm.*, u.first_name, u.last_name, u.nickname, u.profile_photo
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.id = ?
    `, [result.lastID]);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Send group message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Upload file attachment for group messages
router.post('/groups/:groupId/upload', authMiddleware, requirePermission('use_chat'), attachmentUpload.single('file'), async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    // Check if user is member of group
    const membership = await db.getAsync(
      'SELECT id FROM chat_group_members WHERE group_id = ? AND user_id = ?',
      [groupId, req.user.id]
    );

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const attachmentPath = `/uploads/chat-attachments/${req.file.filename}`;
    const attachmentName = req.file.originalname;
    const attachmentType = req.file.mimetype;

    const result = await db.runAsync(
      'INSERT INTO chat_messages (sender_id, group_id, message, attachment_path, attachment_name, attachment_type) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, groupId, '', attachmentPath, attachmentName, attachmentType]
    );

    const newMessage = await db.getAsync(`
      SELECT cm.*, u.first_name, u.last_name, u.nickname, u.profile_photo
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.id = ?
    `, [result.lastID]);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Upload group file error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

module.exports = router;