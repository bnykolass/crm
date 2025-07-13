const express = require('express');
const db = require('../database/db');
const { authMiddleware, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all projects
router.get('/', authMiddleware, requirePermission('manage_projects'), async (req, res) => {
  try {
    const projects = await db.allAsync(`
      SELECT p.*, c.name as company_name, u.first_name, u.last_name
      FROM projects p
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC
    `);

    // Get employee count for each project
    for (const project of projects) {
      const employeeCount = await db.getAsync(
        'SELECT COUNT(*) as count FROM project_employees WHERE project_id = ?',
        [project.id]
      );
      project.employee_count = employeeCount.count;
    }

    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check permissions
    if (!req.user.permissions.includes('manage_projects')) {
      // Check if user is assigned to this project
      const assignment = await db.getAsync(
        'SELECT * FROM project_employees WHERE project_id = ? AND user_id = ?',
        [id, req.user.id]
      );
      if (!assignment) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const project = await db.getAsync(`
      SELECT p.*, c.name as company_name
      FROM projects p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.id = ?
    `, [id]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get assigned employees
    const employees = await db.allAsync(`
      SELECT u.id, u.first_name, u.last_name, u.email, pe.assigned_at
      FROM project_employees pe
      JOIN users u ON pe.user_id = u.id
      WHERE pe.project_id = ?
    `, [id]);

    // Get tasks count
    const taskCount = await db.getAsync(
      'SELECT COUNT(*) as count FROM tasks WHERE project_id = ?',
      [id]
    );

    res.json({ 
      ...project, 
      employees,
      task_count: taskCount.count 
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create new project
router.post('/', authMiddleware, requirePermission('manage_projects'), async (req, res) => {
  try {
    const { name, description, companyId, startDate, endDate, budget, employeeIds = [] } = req.body;

    if (!name || !companyId) {
      return res.status(400).json({ error: 'Project name and company are required' });
    }

    const result = await db.runAsync(
      `INSERT INTO projects (name, description, company_id, start_date, end_date, budget, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, description || null, companyId, startDate || null, endDate || null, budget || null, req.user.id]
    );

    const projectId = result.lastID;

    // Assign employees to project
    if (employeeIds.length > 0) {
      for (const employeeId of employeeIds) {
        await db.runAsync(
          'INSERT INTO project_employees (project_id, user_id) VALUES (?, ?)',
          [projectId, employeeId]
        );
      }
    }

    res.status(201).json({ 
      id: projectId,
      message: 'Project created successfully' 
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', authMiddleware, requirePermission('manage_projects'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, companyId, startDate, endDate, budget, status, employeeIds } = req.body;

    if (!name || !companyId) {
      return res.status(400).json({ error: 'Project name and company are required' });
    }

    await db.runAsync(
      `UPDATE projects 
       SET name = ?, description = ?, company_id = ?, start_date = ?, end_date = ?, 
           budget = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, description || null, companyId, startDate || null, endDate || null, 
       budget || null, status || 'active', id]
    );

    // Update employee assignments if provided
    if (employeeIds !== undefined) {
      // Remove all existing assignments
      await db.runAsync('DELETE FROM project_employees WHERE project_id = ?', [id]);
      
      // Add new assignments
      for (const employeeId of employeeIds) {
        await db.runAsync(
          'INSERT INTO project_employees (project_id, user_id) VALUES (?, ?)',
          [id, employeeId]
        );
      }
    }

    res.json({ message: 'Project updated successfully' });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', authMiddleware, requirePermission('manage_projects'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if project has tasks
    const taskCount = await db.getAsync(
      'SELECT COUNT(*) as count FROM tasks WHERE project_id = ?',
      [id]
    );

    if (taskCount.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete project with existing tasks. Please delete tasks first.' 
      });
    }

    await db.runAsync('DELETE FROM projects WHERE id = ?', [id]);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Get companies for dropdown
router.get('/companies/list', authMiddleware, requirePermission('manage_projects'), async (req, res) => {
  try {
    const companies = await db.allAsync('SELECT id, name FROM companies ORDER BY name');
    res.json(companies);
  } catch (error) {
    console.error('Get companies list error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get employees for dropdown
router.get('/employees/list', authMiddleware, requirePermission('manage_projects'), async (req, res) => {
  try {
    const employees = await db.allAsync(
      'SELECT id, first_name, last_name, email FROM users WHERE role = ? AND is_active = true ORDER BY first_name',
      ['employee']
    );
    res.json(employees);
  } catch (error) {
    console.error('Get employees list error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

module.exports = router;