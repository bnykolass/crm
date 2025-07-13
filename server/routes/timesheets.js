const express = require('express');
const db = require('../database/db');
const { authMiddleware, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all timesheets (with filtering) - aggregated by task
router.get('/', authMiddleware, requirePermission('add_timesheets'), async (req, res) => {
  try {
    const { taskId, userId, startDate, endDate } = req.query;
    
    // Get aggregated timesheet data by task
    let aggregateQuery = `
      SELECT 
        t.id as task_id,
        t.title as task_title,
        t.status as task_status,
        p.name as project_name,
        c.name as company_name,
        u.first_name,
        u.last_name,
        u.hourly_rate,
        COUNT(ts.id) as entry_count,
        SUM(ts.duration) as total_duration,
        SUM((ts.duration / 60.0) * u.hourly_rate) as total_cost,
        MIN(ts.start_time) as first_entry,
        MAX(ts.start_time) as last_entry
      FROM tasks t
      JOIN timesheets ts ON t.id = ts.task_id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN companies c ON p.company_id = c.id
      JOIN users u ON ts.user_id = u.id
      WHERE ts.duration IS NOT NULL
    `;
    let params = [];

    // Non-admin users can only see their own timesheets unless they have manage permissions
    if (!req.user.permissions.includes('manage_tasks') && req.user.role !== 'admin') {
      aggregateQuery += ' AND ts.user_id = ?';
      params.push(req.user.id);
    }

    if (taskId) {
      aggregateQuery += ' AND ts.task_id = ?';
      params.push(taskId);
    }

    if (userId) {
      aggregateQuery += ' AND ts.user_id = ?';
      params.push(userId);
    }

    if (startDate) {
      aggregateQuery += ' AND DATE(ts.start_time) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      aggregateQuery += ' AND DATE(ts.start_time) <= ?';
      params.push(endDate);
    }

    aggregateQuery += ' GROUP BY t.id, t.title, t.status, p.name, c.name, u.first_name, u.last_name, u.hourly_rate ORDER BY last_entry DESC';

    const aggregatedTimesheets = await db.allAsync(aggregateQuery, params);

    // Get detailed timesheets for each task
    for (const taskTimesheet of aggregatedTimesheets) {
      let detailQuery = `
        SELECT 
          ts.id,
          ts.start_time,
          ts.end_time,
          ts.duration,
          ts.description,
          ts.created_at,
          (ts.duration / 60.0) * u.hourly_rate as cost
        FROM timesheets ts
        JOIN users u ON ts.user_id = u.id
        WHERE ts.task_id = ? AND ts.duration IS NOT NULL
      `;
      let detailParams = [taskTimesheet.task_id];

      // Apply same user filter for details
      if (!req.user.permissions.includes('manage_tasks') && req.user.role !== 'admin') {
        detailQuery += ' AND ts.user_id = ?';
        detailParams.push(req.user.id);
      }

      if (userId) {
        detailQuery += ' AND ts.user_id = ?';
        detailParams.push(userId);
      }

      if (startDate) {
        detailQuery += ' AND DATE(ts.start_time) >= ?';
        detailParams.push(startDate);
      }

      if (endDate) {
        detailQuery += ' AND DATE(ts.start_time) <= ?';
        detailParams.push(endDate);
      }

      detailQuery += ' ORDER BY ts.start_time DESC';
      taskTimesheet.timesheet_details = await db.allAsync(detailQuery, detailParams);
    }

    res.json(aggregatedTimesheets);
  } catch (error) {
    console.error('Get timesheets error:', error);
    res.status(500).json({ error: 'Failed to fetch timesheets' });
  }
});

// Get single timesheet
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const timesheet = await db.getAsync(`
      SELECT ts.*, t.title as task_title, p.name as project_name,
             u.first_name, u.last_name, u.hourly_rate
      FROM timesheets ts
      JOIN tasks t ON ts.task_id = t.id
      LEFT JOIN projects p ON t.project_id = p.id
      JOIN users u ON ts.user_id = u.id
      WHERE ts.id = ?
    `, [id]);

    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    // Check permissions
    if (timesheet.user_id !== req.user.id && 
        !req.user.permissions.includes('manage_tasks') && 
        req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    timesheet.cost = timesheet.duration && timesheet.hourly_rate 
      ? (timesheet.duration / 60) * timesheet.hourly_rate 
      : 0;

    res.json(timesheet);
  } catch (error) {
    console.error('Get timesheet error:', error);
    res.status(500).json({ error: 'Failed to fetch timesheet' });
  }
});

// Start time tracking
router.post('/start', authMiddleware, requirePermission('add_timesheets'), async (req, res) => {
  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    // Check if task exists and user has access
    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.assigned_to !== req.user.id && 
        !req.user.permissions.includes('manage_tasks') && 
        req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only track time for your assigned tasks' });
    }

    // Check if there's already an active timesheet for this user
    const activeTimesheet = await db.getAsync(
      'SELECT id FROM timesheets WHERE user_id = ? AND end_time IS NULL',
      [req.user.id]
    );

    if (activeTimesheet) {
      return res.status(400).json({ error: 'You already have an active time tracking session' });
    }

    const result = await db.runAsync(
      'INSERT INTO timesheets (task_id, user_id, start_time) VALUES (?, ?, ?)',
      [taskId, req.user.id, new Date().toISOString()]
    );

    res.status(201).json({ 
      id: result.lastID,
      message: 'Time tracking started successfully' 
    });
  } catch (error) {
    console.error('Start time tracking error:', error);
    res.status(500).json({ error: 'Failed to start time tracking' });
  }
});

// Stop time tracking
router.post('/stop', authMiddleware, requirePermission('add_timesheets'), async (req, res) => {
  try {
    const { description } = req.body;

    // Find active timesheet for this user
    const activeTimesheet = await db.getAsync(
      'SELECT * FROM timesheets WHERE user_id = ? AND end_time IS NULL',
      [req.user.id]
    );

    if (!activeTimesheet) {
      return res.status(400).json({ error: 'No active time tracking session found' });
    }

    const endTime = new Date();
    const startTime = new Date(activeTimesheet.start_time);
    const duration = Math.round((endTime - startTime) / (1000 * 60)); // duration in minutes

    await db.runAsync(
      `UPDATE timesheets 
       SET end_time = ?, duration = ?, description = ?
       WHERE id = ?`,
      [endTime.toISOString(), duration, description || null, activeTimesheet.id]
    );

    res.json({ 
      message: 'Time tracking stopped successfully',
      duration: duration
    });
  } catch (error) {
    console.error('Stop time tracking error:', error);
    res.status(500).json({ error: 'Failed to stop time tracking' });
  }
});

// Add manual timesheet entry
router.post('/', authMiddleware, requirePermission('add_timesheets'), async (req, res) => {
  try {
    const { taskId, duration, description, workDate } = req.body;

    if (!taskId || !duration) {
      return res.status(400).json({ error: 'Task ID and duration are required' });
    }

    // Check if task exists and user has access
    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.assigned_to !== req.user.id && 
        !req.user.permissions.includes('manage_tasks') && 
        req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only add timesheets for your assigned tasks' });
    }

    const date = workDate ? new Date(workDate) : new Date();
    const startTime = new Date(date);
    const endTime = new Date(date.getTime() + (duration * 60 * 1000));

    const result = await db.runAsync(
      `INSERT INTO timesheets (task_id, user_id, start_time, end_time, duration, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [taskId, req.user.id, startTime.toISOString(), endTime.toISOString(), 
       duration, description || null]
    );

    res.status(201).json({ 
      id: result.lastID,
      message: 'Timesheet entry added successfully' 
    });
  } catch (error) {
    console.error('Add timesheet error:', error);
    res.status(500).json({ error: 'Failed to add timesheet entry' });
  }
});

// Update timesheet
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { duration, description } = req.body;

    // Check if timesheet exists and user has access
    const timesheet = await db.getAsync('SELECT user_id FROM timesheets WHERE id = ?', [id]);
    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    if (timesheet.user_id !== req.user.id && 
        !req.user.permissions.includes('manage_tasks') && 
        req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.runAsync(
      'UPDATE timesheets SET duration = ?, description = ? WHERE id = ?',
      [duration, description || null, id]
    );

    res.json({ message: 'Timesheet updated successfully' });
  } catch (error) {
    console.error('Update timesheet error:', error);
    res.status(500).json({ error: 'Failed to update timesheet' });
  }
});

// Delete timesheet
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if timesheet exists and user has access
    const timesheet = await db.getAsync('SELECT user_id FROM timesheets WHERE id = ?', [id]);
    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    if (timesheet.user_id !== req.user.id && 
        !req.user.permissions.includes('manage_tasks') && 
        req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.runAsync('DELETE FROM timesheets WHERE id = ?', [id]);
    res.json({ message: 'Timesheet deleted successfully' });
  } catch (error) {
    console.error('Delete timesheet error:', error);
    res.status(500).json({ error: 'Failed to delete timesheet' });
  }
});

// Get active timesheet for current user
router.get('/active/current', authMiddleware, requirePermission('add_timesheets'), async (req, res) => {
  try {
    const activeTimesheet = await db.getAsync(`
      SELECT ts.*, t.title as task_title, p.name as project_name
      FROM timesheets ts
      JOIN tasks t ON ts.task_id = t.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE ts.user_id = ? AND ts.end_time IS NULL
    `, [req.user.id]);

    if (activeTimesheet) {
      // Calculate current duration
      const startTime = new Date(activeTimesheet.start_time);
      const currentTime = new Date();
      activeTimesheet.current_duration = Math.round((currentTime - startTime) / (1000 * 60));
    }

    res.json(activeTimesheet || null);
  } catch (error) {
    console.error('Get active timesheet error:', error);
    res.status(500).json({ error: 'Failed to fetch active timesheet' });
  }
});

// Get tasks for timesheet dropdown
router.get('/tasks/list', authMiddleware, requirePermission('add_timesheets'), async (req, res) => {
  try {
    let query = `
      SELECT t.id, t.title, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.status != 'cancelled'
    `;
    let params = [];

    // Non-admin users can only see their assigned tasks
    if (!req.user.permissions.includes('manage_tasks') && req.user.role !== 'admin') {
      query += ' AND t.assigned_to = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY t.title';

    const tasks = await db.allAsync(query, params);
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks list error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

module.exports = router;