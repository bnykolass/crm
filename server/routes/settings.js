const express = require('express');
const db = require('../database/db');
const { authMiddleware, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all settings
router.get('/', authMiddleware, requirePermission('manage_settings'), async (req, res) => {
  try {
    const settings = await db.allAsync('SELECT key, value, updated_at FROM settings ORDER BY key');
    
    // Convert to object for easier frontend handling
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });

    res.json(settingsObj);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get specific setting
router.get('/:key', authMiddleware, async (req, res) => {
  try {
    const { key } = req.params;
    
    const setting = await db.getAsync('SELECT value FROM settings WHERE key = ?', [key]);
    
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ key, value: setting.value });
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// Update settings
router.put('/', authMiddleware, requirePermission('manage_settings'), async (req, res) => {
  try {
    const settings = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings data' });
    }

    const updatedSettings = [];
    
    for (const [key, value] of Object.entries(settings)) {
      // Validate setting key (prevent SQL injection and invalid keys)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        return res.status(400).json({ error: `Invalid setting key: ${key}` });
      }

      try {
        await db.runAsync(`
          INSERT OR REPLACE INTO settings (key, value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `, [key, value]);
        
        updatedSettings.push({ key, value });
      } catch (error) {
        console.error(`Failed to update setting ${key}:`, error);
        return res.status(500).json({ error: `Failed to update setting: ${key}` });
      }
    }

    // If SendGrid API key was updated, test the configuration
    if (settings.sendgrid_api_key) {
      try {
        const emailService = require('../services/emailService');
        await emailService.updateConfiguration();
        
        // Test the configuration
        const validation = await emailService.validateConfiguration();
        if (!validation.valid) {
          console.warn('SendGrid configuration validation failed:', validation.message);
        }
      } catch (error) {
        console.warn('Failed to update email service configuration:', error.message);
      }
    }

    res.json({ 
      message: 'Settings updated successfully',
      updatedSettings: updatedSettings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Update single setting
router.put('/:key', authMiddleware, requirePermission('manage_settings'), async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    // Validate setting key
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      return res.status(400).json({ error: 'Invalid setting key' });
    }

    await db.runAsync(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [key, value]);

    res.json({ 
      message: 'Setting updated successfully',
      key,
      value
    });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Test email configuration
router.post('/test-email', authMiddleware, requirePermission('manage_settings'), async (req, res) => {
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({ error: 'Test email address is required' });
    }

    const emailService = require('../services/emailService');
    
    // Update configuration from database
    await emailService.updateConfiguration();
    
    // Validate configuration
    const validation = await emailService.validateConfiguration();
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Email configuration is invalid',
        details: validation.message
      });
    }

    // Send test email
    const result = await emailService.sendTestEmail(testEmail);
    
    if (result.success) {
      res.json({ 
        message: 'Test email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to send test email',
        details: result.error
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Get email notification settings for specific user
router.get('/notifications/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user can access this (own settings or admin)
    if (parseInt(userId) !== req.user.id && !req.user.permissions.includes('manage_settings') && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // For now, return global settings. In future, can be per-user
    const settings = await db.allAsync(`
      SELECT key, value FROM settings 
      WHERE key LIKE '%notification%' OR key LIKE '%reminder%'
    `);
    
    const notificationSettings = {};
    settings.forEach(setting => {
      notificationSettings[setting.key] = setting.value === 'true';
    });

    res.json(notificationSettings);
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

module.exports = router;