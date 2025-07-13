const express = require('express');
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // Get basic counts
    const usersCount = await db.getAsync('SELECT COUNT(*) as count FROM users WHERE is_active = true');
    const companiesCount = await db.getAsync('SELECT COUNT(*) as count FROM companies WHERE is_active = true');
    const projectsCount = await db.getAsync('SELECT COUNT(*) as count FROM projects WHERE status = ?', ['active']);
    const activeTasksCount = await db.getAsync('SELECT COUNT(*) as count FROM tasks WHERE status IN (?, ?)', ['pending', 'in_progress']);
    
    // Get current month hours
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM format
    const monthlyHours = await db.getAsync(`
      SELECT COALESCE(SUM(duration), 0) as total_minutes 
      FROM timesheets 
      WHERE DATE(start_time) LIKE ?
    `, [`${currentMonth}%`]);
    
    // Calculate monthly revenue (sum of timesheet costs for current month)
    const monthlyRevenue = await db.getAsync(`
      SELECT COALESCE(SUM((ts.duration / 60.0) * u.hourly_rate), 0) as revenue
      FROM timesheets ts
      JOIN users u ON ts.user_id = u.id
      WHERE DATE(ts.start_time) LIKE ? AND ts.duration IS NOT NULL
    `, [`${currentMonth}%`]);

    res.json({
      users: usersCount.count,
      companies: companiesCount.count,
      projects: projectsCount.count,
      activeTasks: activeTasksCount.count,
      monthlyHours: Math.round(monthlyHours.total_minutes / 60),
      monthlyRevenue: monthlyRevenue.revenue || 0
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get recent activities
router.get('/activities', authMiddleware, async (req, res) => {
  try {
    const activities = [];
    
    // Recent tasks
    const recentTasks = await db.allAsync(`
      SELECT t.title, t.created_at, t.status, 
             u1.first_name as created_by_first, u1.last_name as created_by_last,
             u2.first_name as assigned_first, u2.last_name as assigned_last
      FROM tasks t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      ORDER BY t.created_at DESC
      LIMIT 5
    `);

    recentTasks.forEach(task => {
      activities.push({
        type: 'task',
        title: task.title,
        description: `Nová úloha vytvorená`,
        user: `${task.created_by_first} ${task.created_by_last}`,
        timestamp: task.created_at,
        status: task.status
      });
    });

    // Recent timesheets
    const recentTimesheets = await db.allAsync(`
      SELECT ts.duration, ts.created_at, t.title as task_title,
             u.first_name, u.last_name
      FROM timesheets ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN users u ON ts.user_id = u.id
      WHERE ts.duration IS NOT NULL
      ORDER BY ts.created_at DESC
      LIMIT 5
    `);

    recentTimesheets.forEach(timesheet => {
      const hours = Math.floor(timesheet.duration / 60);
      const minutes = timesheet.duration % 60;
      activities.push({
        type: 'timesheet',
        title: timesheet.task_title,
        description: `Pridaný čas: ${hours}h ${minutes}m`,
        user: `${timesheet.first_name} ${timesheet.last_name}`,
        timestamp: timesheet.created_at,
        status: 'completed'
      });
    });

    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json(activities.slice(0, 10));
  } catch (error) {
    console.error('Get dashboard activities error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard activities' });
  }
});

// Get upcoming deadlines
router.get('/deadlines', authMiddleware, async (req, res) => {
  try {
    const upcomingDeadlines = await db.allAsync(`
      SELECT t.id, t.title, t.due_date, t.status, t.priority,
             p.name as project_name,
             u.first_name, u.last_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.due_date IS NOT NULL 
        AND t.status NOT IN ('completed', 'cancelled')
        AND DATE(t.due_date) >= DATE('now')
        AND DATE(t.due_date) <= DATE('now', '+7 days')
      ORDER BY t.due_date ASC
      LIMIT 10
    `);

    res.json(upcomingDeadlines);
  } catch (error) {
    console.error('Get upcoming deadlines error:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming deadlines' });
  }
});

module.exports = router;