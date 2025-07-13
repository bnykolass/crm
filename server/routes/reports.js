const express = require('express');
const db = require('../database/db');
const { authMiddleware, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Time tracking report
router.get('/time-tracking', authMiddleware, requirePermission('view_reports'), async (req, res) => {
  try {
    const { startDate, endDate, userId, projectId } = req.query;
    
    // Get aggregated task data
    let aggregateQuery = `
      SELECT 
        t.id as task_id,
        t.title as task_title,
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

    if (startDate) {
      aggregateQuery += ' AND DATE(ts.start_time) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      aggregateQuery += ' AND DATE(ts.start_time) <= ?';
      params.push(endDate);
    }

    if (userId) {
      aggregateQuery += ' AND ts.user_id = ?';
      params.push(userId);
    }

    if (projectId) {
      aggregateQuery += ' AND t.project_id = ?';
      params.push(projectId);
    }

    aggregateQuery += ' GROUP BY t.id, t.title, p.name, c.name, u.first_name, u.last_name, u.hourly_rate ORDER BY last_entry DESC';

    const aggregatedTasks = await db.allAsync(aggregateQuery, params);

    // Get detailed timesheets for each task
    for (const task of aggregatedTasks) {
      let detailQuery = `
        SELECT 
          ts.id,
          ts.start_time,
          ts.end_time,
          ts.duration,
          ts.description
        FROM timesheets ts
        WHERE ts.task_id = ? AND ts.duration IS NOT NULL
      `;
      let detailParams = [task.task_id];

      if (startDate) {
        detailQuery += ' AND DATE(ts.start_time) >= ?';
        detailParams.push(startDate);
      }

      if (endDate) {
        detailQuery += ' AND DATE(ts.start_time) <= ?';
        detailParams.push(endDate);
      }

      detailQuery += ' ORDER BY ts.start_time DESC';

      task.timesheet_details = await db.allAsync(detailQuery, detailParams);
    }

    // Calculate totals
    const totalMinutes = aggregatedTasks.reduce((sum, task) => sum + (task.total_duration || 0), 0);
    const totalCost = aggregatedTasks.reduce((sum, task) => sum + (task.total_cost || 0), 0);
    const totalEntries = aggregatedTasks.reduce((sum, task) => sum + (task.entry_count || 0), 0);

    res.json({
      aggregatedTasks,
      summary: {
        totalHours: Math.round(totalMinutes / 60 * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalEntries: totalEntries,
        totalTasks: aggregatedTasks.length
      }
    });
  } catch (error) {
    console.error('Time tracking report error:', error);
    res.status(500).json({ error: 'Failed to generate time tracking report' });
  }
});

// Project progress report
router.get('/project-progress', authMiddleware, requirePermission('view_reports'), async (req, res) => {
  try {
    const projects = await db.allAsync(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.start_date,
        p.end_date,
        p.status,
        c.name as company_name,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
        COALESCE(SUM(ts.duration), 0) as total_minutes,
        COALESCE(SUM((ts.duration / 60.0) * u.hourly_rate), 0) as total_cost
      FROM projects p
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN tasks t ON p.id = t.project_id
      LEFT JOIN timesheets ts ON t.id = ts.task_id
      LEFT JOIN users u ON ts.user_id = u.id
      WHERE p.status = 'active'
      GROUP BY p.id, p.name, p.description, p.start_date, p.end_date, p.status, c.name
      ORDER BY p.name
    `);

    // Calculate progress percentage for each project
    const projectsWithProgress = projects.map(project => ({
      ...project,
      progress: project.total_tasks > 0 
        ? Math.round((project.completed_tasks / project.total_tasks) * 100)
        : 0,
      total_hours: Math.round(project.total_minutes / 60 * 100) / 100
    }));

    res.json(projectsWithProgress);
  } catch (error) {
    console.error('Project progress report error:', error);
    res.status(500).json({ error: 'Failed to generate project progress report' });
  }
});

// User productivity report
router.get('/user-productivity', authMiddleware, requirePermission('view_reports'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.hourly_rate,
        COUNT(DISTINCT ts.id) as timesheet_entries,
        COALESCE(SUM(ts.duration), 0) as total_minutes,
        COALESCE(SUM((ts.duration / 60.0) * u.hourly_rate), 0) as total_revenue,
        COUNT(DISTINCT t.id) as assigned_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
      FROM users u
      LEFT JOIN timesheets ts ON u.id = ts.user_id
      LEFT JOIN tasks t ON u.id = t.assigned_to
      WHERE u.is_active = true
    `;
    let params = [];

    if (startDate) {
      query += ' AND (ts.start_time IS NULL OR DATE(ts.start_time) >= ?)';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND (ts.start_time IS NULL OR DATE(ts.start_time) <= ?)';
      params.push(endDate);
    }

    query += ' GROUP BY u.id, u.first_name, u.last_name, u.email, u.hourly_rate ORDER BY total_minutes DESC';

    const users = await db.allAsync(query, params);

    const usersWithStats = users.map(user => ({
      ...user,
      total_hours: Math.round(user.total_minutes / 60 * 100) / 100,
      avg_hours_per_day: user.timesheet_entries > 0 
        ? Math.round((user.total_minutes / 60) / user.timesheet_entries * 100) / 100
        : 0,
      completion_rate: user.assigned_tasks > 0
        ? Math.round((user.completed_tasks / user.assigned_tasks) * 100)
        : 0
    }));

    res.json(usersWithStats);
  } catch (error) {
    console.error('User productivity report error:', error);
    res.status(500).json({ error: 'Failed to generate user productivity report' });
  }
});

// Financial summary report
router.get('/financial-summary', authMiddleware, requirePermission('view_reports'), async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month } = req.query;
    
    // Monthly revenue for the year
    const monthlyRevenue = await db.allAsync(`
      SELECT 
        strftime('%m', ts.start_time) as month,
        COALESCE(SUM((ts.duration / 60.0) * u.hourly_rate), 0) as revenue,
        COALESCE(SUM(ts.duration), 0) as total_minutes
      FROM timesheets ts
      JOIN users u ON ts.user_id = u.id
      WHERE strftime('%Y', ts.start_time) = ? AND ts.duration IS NOT NULL
      GROUP BY strftime('%m', ts.start_time)
      ORDER BY month
    `, [year.toString()]);

    // Project costs
    const projectCosts = await db.allAsync(`
      SELECT 
        p.name as project_name,
        c.name as company_name,
        COALESCE(SUM((ts.duration / 60.0) * u.hourly_rate), 0) as total_cost,
        COALESCE(SUM(ts.duration), 0) as total_minutes
      FROM projects p
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN tasks t ON p.id = t.project_id
      LEFT JOIN timesheets ts ON t.id = ts.task_id
      LEFT JOIN users u ON ts.user_id = u.id
      WHERE ts.duration IS NOT NULL
      ${month ? `AND strftime('%Y-%m', ts.start_time) = ?` : `AND strftime('%Y', ts.start_time) = ?`}
      GROUP BY p.id, p.name, c.name
      HAVING total_cost > 0
      ORDER BY total_cost DESC
    `, [month ? `${year}-${month.toString().padStart(2, '0')}` : year.toString()]);

    // Fill missing months with 0
    const fullMonthlyRevenue = [];
    for (let i = 1; i <= 12; i++) {
      const monthStr = i.toString().padStart(2, '0');
      const existing = monthlyRevenue.find(m => m.month === monthStr);
      fullMonthlyRevenue.push({
        month: monthStr,
        revenue: existing ? existing.revenue : 0,
        total_hours: existing ? Math.round(existing.total_minutes / 60 * 100) / 100 : 0
      });
    }

    const totalYearRevenue = fullMonthlyRevenue.reduce((sum, m) => sum + m.revenue, 0);
    const totalYearHours = fullMonthlyRevenue.reduce((sum, m) => sum + m.total_hours, 0);

    res.json({
      year,
      monthlyRevenue: fullMonthlyRevenue,
      projectCosts: projectCosts.map(p => ({
        ...p,
        total_hours: Math.round(p.total_minutes / 60 * 100) / 100
      })),
      summary: {
        totalRevenue: Math.round(totalYearRevenue * 100) / 100,
        totalHours: Math.round(totalYearHours * 100) / 100,
        avgHourlyRate: totalYearHours > 0 
          ? Math.round((totalYearRevenue / totalYearHours) * 100) / 100 
          : 0
      }
    });
  } catch (error) {
    console.error('Financial summary report error:', error);
    res.status(500).json({ error: 'Failed to generate financial summary report' });
  }
});

// Get users for filter dropdown
router.get('/users/list', authMiddleware, requirePermission('view_reports'), async (req, res) => {
  try {
    const users = await db.allAsync(
      'SELECT id, first_name, last_name FROM users WHERE is_active = true ORDER BY first_name'
    );
    res.json(users);
  } catch (error) {
    console.error('Get users list error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get projects for filter dropdown
router.get('/projects/list', authMiddleware, requirePermission('view_reports'), async (req, res) => {
  try {
    const projects = await db.allAsync(
      'SELECT id, name FROM projects WHERE status = ? ORDER BY name',
      ['active']
    );
    res.json(projects);
  } catch (error) {
    console.error('Get projects list error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Detailed user report
router.get('/user/:userId', authMiddleware, requirePermission('view_reports'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    // User basic info
    const user = await db.getAsync(
      'SELECT id, first_name, last_name, email, hourly_rate, role FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // User aggregated timesheets by task
    let aggregateQuery = `
      SELECT 
        t.id as task_id,
        t.title as task_title,
        t.status as task_status,
        p.name as project_name,
        c.name as company_name,
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
      WHERE ts.user_id = ? AND ts.duration IS NOT NULL
    `;
    let params = [userId];

    if (startDate) {
      aggregateQuery += ' AND DATE(ts.start_time) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      aggregateQuery += ' AND DATE(ts.start_time) <= ?';
      params.push(endDate);
    }

    aggregateQuery += ' GROUP BY t.id, t.title, t.status, p.name, c.name ORDER BY last_entry DESC';
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
          (ts.duration / 60.0) * u.hourly_rate as cost
        FROM timesheets ts
        JOIN users u ON ts.user_id = u.id
        WHERE ts.task_id = ? AND ts.user_id = ? AND ts.duration IS NOT NULL
      `;
      let detailParams = [taskTimesheet.task_id, userId];

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

    // User tasks
    let taskQuery = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date,
        t.created_at,
        p.name as project_name,
        c.name as company_name,
        COALESCE(SUM(ts.duration), 0) as total_minutes
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN timesheets ts ON t.id = ts.task_id
      WHERE t.assigned_to = ?
    `;
    let taskParams = [userId];

    if (startDate) {
      taskQuery += ' AND DATE(t.created_at) >= ?';
      taskParams.push(startDate);
    }
    if (endDate) {
      taskQuery += ' AND DATE(t.created_at) <= ?';
      taskParams.push(endDate);
    }

    taskQuery += ' GROUP BY t.id ORDER BY t.created_at DESC';
    const tasks = await db.allAsync(taskQuery, taskParams);

    // Calculate summary
    const totalMinutes = aggregatedTimesheets.reduce((sum, ts) => sum + (ts.total_duration || 0), 0);
    const totalCost = aggregatedTimesheets.reduce((sum, ts) => sum + (ts.total_cost || 0), 0);
    const totalTimesheetEntries = aggregatedTimesheets.reduce((sum, ts) => sum + (ts.entry_count || 0), 0);
    const completedTasks = tasks.filter(t => t.status === 'completed').length;

    res.json({
      user,
      aggregatedTimesheets,
      tasks,
      summary: {
        totalHours: Math.round(totalMinutes / 60 * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalTimesheets: totalTimesheetEntries,
        totalTasksWithTime: aggregatedTimesheets.length,
        totalTasks: tasks.length,
        completedTasks,
        completionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0
      }
    });
  } catch (error) {
    console.error('User report error:', error);
    res.status(500).json({ error: 'Failed to generate user report' });
  }
});

// Detailed project report
router.get('/project/:projectId', authMiddleware, requirePermission('view_reports'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Project basic info
    const project = await db.getAsync(`
      SELECT p.*, c.name as company_name 
      FROM projects p 
      LEFT JOIN companies c ON p.company_id = c.id 
      WHERE p.id = ?
    `, [projectId]);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Project tasks with timesheets
    let taskQuery = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date,
        t.created_at,
        u.first_name,
        u.last_name,
        COALESCE(SUM(ts.duration), 0) as total_minutes,
        COALESCE(SUM((ts.duration / 60.0) * u.hourly_rate), 0) as total_cost
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN timesheets ts ON t.id = ts.task_id
      WHERE t.project_id = ?
    `;
    let params = [projectId];

    if (startDate) {
      taskQuery += ' AND DATE(t.created_at) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      taskQuery += ' AND DATE(t.created_at) <= ?';
      params.push(endDate);
    }

    taskQuery += ' GROUP BY t.id ORDER BY t.created_at DESC';
    const tasks = await db.allAsync(taskQuery, params);

    // Project team members
    const teamMembers = await db.allAsync(`
      SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.hourly_rate,
             COALESCE(SUM(ts.duration), 0) as total_minutes,
             COALESCE(SUM((ts.duration / 60.0) * u.hourly_rate), 0) as total_cost
      FROM users u
      JOIN tasks t ON u.id = t.assigned_to
      LEFT JOIN timesheets ts ON t.id = ts.task_id
      WHERE t.project_id = ?
      GROUP BY u.id
      ORDER BY total_minutes DESC
    `, [projectId]);

    // Calculate summary
    const totalMinutes = tasks.reduce((sum, task) => sum + (task.total_minutes || 0), 0);
    const totalCost = tasks.reduce((sum, task) => sum + (task.total_cost || 0), 0);
    const completedTasks = tasks.filter(t => t.status === 'completed').length;

    res.json({
      project,
      tasks,
      teamMembers,
      summary: {
        totalHours: Math.round(totalMinutes / 60 * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalTasks: tasks.length,
        completedTasks,
        inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
        pendingTasks: tasks.filter(t => t.status === 'pending').length,
        progress: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Project report error:', error);
    res.status(500).json({ error: 'Failed to generate project report' });
  }
});

// Company report
router.get('/company/:companyId', authMiddleware, requirePermission('view_reports'), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Company basic info
    const company = await db.getAsync('SELECT * FROM companies WHERE id = ?', [companyId]);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Company projects
    const projects = await db.allAsync(`
      SELECT p.*, 
             COUNT(t.id) as total_tasks,
             COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
             COALESCE(SUM(ts.duration), 0) as total_minutes,
             COALESCE(SUM((ts.duration / 60.0) * u.hourly_rate), 0) as total_cost
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      LEFT JOIN timesheets ts ON t.id = ts.task_id
      LEFT JOIN users u ON ts.user_id = u.id
      WHERE p.company_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [companyId]);

    // Calculate summary
    const totalMinutes = projects.reduce((sum, proj) => sum + (proj.total_minutes || 0), 0);
    const totalCost = projects.reduce((sum, proj) => sum + (proj.total_cost || 0), 0);
    const totalTasks = projects.reduce((sum, proj) => sum + (proj.total_tasks || 0), 0);
    const completedTasks = projects.reduce((sum, proj) => sum + (proj.completed_tasks || 0), 0);

    res.json({
      company,
      projects,
      summary: {
        totalHours: Math.round(totalMinutes / 60 * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'active').length,
        totalTasks,
        completedTasks,
        overallProgress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Company report error:', error);
    res.status(500).json({ error: 'Failed to generate company report' });
  }
});

// Get companies for filter dropdown
router.get('/companies/list', authMiddleware, requirePermission('view_reports'), async (req, res) => {
  try {
    const companies = await db.allAsync(
      'SELECT id, name FROM companies ORDER BY name'
    );
    res.json(companies);
  } catch (error) {
    console.error('Get companies list error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

module.exports = router;