const express = require('express');
const db = require('../database/db');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');
const { createNotification } = require('./notifications');
const emailService = require('../services/emailService');

const router = express.Router();

// Get all tasks (with filtering)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { projectId, assignedTo, status } = req.query;
    let query = `
      SELECT t.*, p.name as project_name, c.name as company_name,
             u1.first_name as assigned_first_name, u1.last_name as assigned_last_name,
             u2.first_name as created_by_first_name, u2.last_name as created_by_last_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE 1=1
    `;
    let params = [];

    // Filter by user permissions
    if (!req.user.permissions.includes('manage_tasks') && req.user.role !== 'admin') {
      query += ' AND t.assigned_to = ?';
      params.push(req.user.id);
    }

    if (projectId) {
      query += ' AND t.project_id = ?';
      params.push(projectId);
    }

    if (assignedTo) {
      query += ' AND t.assigned_to = ?';
      params.push(assignedTo);
    }

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    query += ' ORDER BY t.created_at DESC';

    const tasks = await db.allAsync(query, params);

    // Get time tracking for each task
    for (const task of tasks) {
      const timeTracking = await db.getAsync(
        'SELECT SUM(duration) as total_time FROM timesheets WHERE task_id = ?',
        [task.id]
      );
      task.total_time = timeTracking.total_time || 0;
    }

    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get single task
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const task = await db.getAsync(`
      SELECT t.*, p.name as project_name, c.name as company_name,
             u1.first_name as assigned_first_name, u1.last_name as assigned_last_name,
             u2.first_name as created_by_first_name, u2.last_name as created_by_last_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.id = ?
    `, [id]);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check permissions
    if (!req.user.permissions.includes('manage_tasks') && 
        req.user.role !== 'admin' && 
        task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get comments for this task
    const comments = await db.allAsync(`
      SELECT tc.*, u.first_name, u.last_name
      FROM task_comments tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at ASC
    `, [id]);

    // Get timesheets for this task
    const timesheets = await db.allAsync(`
      SELECT ts.*, u.first_name, u.last_name
      FROM timesheets ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.task_id = ?
      ORDER BY ts.created_at DESC
    `, [id]);

    // Get attachments for this task
    const attachments = await db.allAsync(`
      SELECT a.*, u.first_name, u.last_name
      FROM attachments a
      JOIN users u ON a.uploaded_by = u.id
      WHERE a.task_id = ?
      ORDER BY a.created_at DESC
    `, [id]);

    res.json({ ...task, comments, timesheets, attachments });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Create new task
router.post('/', authMiddleware, requirePermission('manage_tasks'), async (req, res) => {
  try {
    const { title, description, projectId, assignedTo, teamId, priority, dueDate } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const result = await db.runAsync(
      `INSERT INTO tasks (title, description, project_id, assigned_to, team_id, priority, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, projectId || null, assignedTo || null, teamId || null,
       priority || 'medium', dueDate || null, req.user.id]
    );

    // Create notification and send email for assigned user
    if (assignedTo && assignedTo !== req.user.id) {
      try {
        // Create notification
        await createNotification(
          assignedTo,
          'task_assigned',
          `Nová úloha priradená: ${title}`,
          `Bola vám priradená nová úloha "${title}". Kliknite pre potvrdenie.`,
          result.lastID
        );

        // Send email notification
        const assignee = await db.getAsync('SELECT * FROM users WHERE id = ?', [assignedTo]);
        const assignedBy = await db.getAsync('SELECT * FROM users WHERE id = ?', [req.user.id]);
        const project = projectId ? await db.getAsync('SELECT name FROM projects WHERE id = ?', [projectId]) : null;
        
        if (assignee && assignedBy) {
          const taskWithProject = {
            id: result.lastID,
            title,
            description,
            priority: priority || 'medium',
            due_date: dueDate,
            project_name: project?.name
          };
          
          await emailService.sendTaskAssignmentEmail(taskWithProject, assignee, assignedBy);
        }
      } catch (notificationError) {
        console.error('Failed to create notification or send email:', notificationError);
        // Don't fail the task creation if notification fails
      }
    } else if (teamId) {
      // Handle team assignment - notify all team members
      try {
        const teamMembers = await db.allAsync(
          'SELECT user_id FROM team_members WHERE team_id = ?',
          [teamId]
        );
        
        for (const member of teamMembers) {
          if (member.user_id !== req.user.id) {
            await createNotification(
              member.user_id,
              'task_assigned',
              `Nová úloha pre tím: ${title}`,
              `Bola priradená nová úloha "${title}" vášmu tímu. Kliknite pre potvrdenie.`,
              result.lastID
            );
          }
        }
      } catch (teamError) {
        console.error('Team notification error:', teamError);
      }
    }

    res.status(201).json({ 
      id: result.lastID,
      message: 'Task created successfully' 
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, projectId, assignedTo, status, priority, dueDate } = req.body;

    // Check permissions
    const task = await db.getAsync('SELECT assigned_to FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const canManage = req.user.permissions.includes('manage_tasks') || req.user.role === 'admin';
    const canEdit = req.user.permissions.includes('edit_own_tasks') && task.assigned_to === req.user.id;

    if (!canManage && !canEdit) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    await db.runAsync(
      `UPDATE tasks 
       SET title = ?, description = ?, project_id = ?, assigned_to = ?, 
           status = ?, priority = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, description || null, projectId || null, assignedTo || null,
       status || 'pending', priority || 'medium', dueDate || null, id]
    );

    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', authMiddleware, requirePermission('manage_tasks'), async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Add comment to task
router.post('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    // Check if user can access this task
    const task = await db.getAsync('SELECT assigned_to FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const canAccess = req.user.permissions.includes('manage_tasks') || 
                     req.user.role === 'admin' || 
                     task.assigned_to === req.user.id;

    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.runAsync(
      'INSERT INTO task_comments (task_id, user_id, comment) VALUES (?, ?, ?)',
      [id, req.user.id, comment]
    );

    res.status(201).json({ message: 'Comment added successfully' });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get projects for dropdown
router.get('/projects/list', authMiddleware, async (req, res) => {
  try {
    let query = 'SELECT id, name FROM projects WHERE status = ? ORDER BY name';
    const params = ['active'];
    
    const projects = await db.allAsync(query, params);
    res.json(projects);
  } catch (error) {
    console.error('Get projects list error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get employees for dropdown
router.get('/employees/list', authMiddleware, async (req, res) => {
  try {
    const employees = await db.allAsync(
      'SELECT id, first_name, last_name, email FROM users WHERE is_active = true ORDER BY first_name'
    );
    res.json(employees);
  } catch (error) {
    console.error('Get employees list error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Update task status
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Check permissions
    const task = await db.getAsync('SELECT assigned_to FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const canManage = req.user.permissions.includes('manage_tasks') || req.user.role === 'admin';
    const canEdit = req.user.permissions.includes('edit_own_tasks') && task.assigned_to === req.user.id;

    if (!canManage && !canEdit) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await db.runAsync(
      'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    res.json({ message: 'Task status updated successfully' });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// Upload files to task
router.post('/:id/attachments', authMiddleware, upload.array('files', 5), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if task exists and user has access
    const task = await db.getAsync('SELECT assigned_to FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const canAccess = req.user.permissions.includes('manage_tasks') || 
                     req.user.role === 'admin' || 
                     task.assigned_to === req.user.id;

    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = [];
    
    for (const file of req.files) {
      const result = await db.runAsync(
        `INSERT INTO attachments (filename, original_name, mime_type, size, task_id, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [file.filename, file.originalname, file.mimetype, file.size, id, req.user.id]
      );
      
      uploadedFiles.push({
        id: result.lastID,
        filename: file.filename,
        original_name: file.originalname,
        mime_type: file.mimetype,
        size: file.size
      });
    }

    res.status(201).json({ 
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload files error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Download attachment
router.get('/attachments/:id/download', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const attachment = await db.getAsync(`
      SELECT a.*, t.assigned_to
      FROM attachments a
      JOIN tasks t ON a.task_id = t.id
      WHERE a.id = ?
    `, [id]);

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Check permissions
    const canAccess = req.user.permissions.includes('manage_tasks') || 
                     req.user.role === 'admin' || 
                     attachment.assigned_to === req.user.id;

    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = path.join(__dirname, '../uploads', attachment.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_name}"`);
    res.setHeader('Content-Type', attachment.mime_type);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

// Delete attachment
router.delete('/attachments/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const attachment = await db.getAsync(`
      SELECT a.*, t.assigned_to
      FROM attachments a
      JOIN tasks t ON a.task_id = t.id
      WHERE a.id = ?
    `, [id]);

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Check permissions - only uploader, task assignee, or admin can delete
    const canDelete = req.user.permissions.includes('manage_tasks') || 
                     req.user.role === 'admin' || 
                     attachment.uploaded_by === req.user.id ||
                     attachment.assigned_to === req.user.id;

    if (!canDelete) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete from database
    await db.runAsync('DELETE FROM attachments WHERE id = ?', [id]);
    
    // Delete file from disk
    const filePath = path.join(__dirname, '../uploads', attachment.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// Confirm task assignment (accept)
router.patch('/:id/confirm', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, message } = req.body; // action: 'accept' or 'reject'

    // Check if task exists and is assigned to current user
    const task = await db.getAsync(
      'SELECT t.*, u.first_name, u.last_name FROM tasks t LEFT JOIN users u ON t.created_by = u.id WHERE t.id = ? AND t.assigned_to = ?',
      [id, req.user.id]
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found or not assigned to you' });
    }

    if (task.confirmation_status !== 'pending') {
      return res.status(400).json({ error: 'Task has already been confirmed' });
    }

    const confirmationStatus = action === 'accept' ? 'accepted' : 'rejected';
    const taskStatus = action === 'accept' ? 'in_progress' : 'pending';

    // Update task confirmation
    await db.runAsync(
      `UPDATE tasks 
       SET confirmation_status = ?, confirmation_message = ?, confirmed_at = CURRENT_TIMESTAMP,
           status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [confirmationStatus, message || null, taskStatus, id]
    );

    // Create notification and send email for task creator
    if (task.created_by && task.created_by !== req.user.id) {
      try {
        const actionText = action === 'accept' ? 'potvrdil' : 'odmietol';
        
        // Create notification
        await createNotification(
          task.created_by,
          action === 'accept' ? 'task_confirmed' : 'task_rejected',
          `Úloha ${actionText}: ${task.title}`,
          `${req.user.first_name} ${req.user.last_name} ${actionText} úlohu "${task.title}".${message ? ` Správa: ${message}` : ''}`,
          id
        );

        // Send email notification
        const creator = await db.getAsync('SELECT * FROM users WHERE id = ?', [task.created_by]);
        const assignee = await db.getAsync('SELECT * FROM users WHERE id = ?', [req.user.id]);
        
        if (creator && assignee) {
          const taskWithCreator = {
            ...task,
            created_by_first_name: creator.first_name,
            created_by_last_name: creator.last_name,
            created_by_email: creator.email
          };
          
          await emailService.sendTaskConfirmationEmail(taskWithCreator, assignee, action, message);
        }
      } catch (notificationError) {
        console.error('Failed to create confirmation notification or send email:', notificationError);
      }
    }

    res.json({ 
      message: `Task ${action === 'accept' ? 'accepted' : 'rejected'} successfully`,
      confirmation_status: confirmationStatus
    });
  } catch (error) {
    console.error('Confirm task error:', error);
    res.status(500).json({ error: 'Failed to confirm task' });
  }
});

// Get tasks pending confirmation for current user
router.get('/pending-confirmation', authMiddleware, async (req, res) => {
  try {
    const pendingTasks = await db.allAsync(`
      SELECT t.*, p.name as project_name, c.name as company_name,
             u.first_name as created_by_first_name, u.last_name as created_by_last_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.assigned_to = ? AND t.confirmation_status = 'pending'
      ORDER BY t.created_at DESC
    `, [req.user.id]);

    res.json(pendingTasks);
  } catch (error) {
    console.error('Get pending confirmation tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch pending confirmation tasks' });
  }
});

module.exports = router;