const express = require('express');
const db = require('../database/db');
const { authMiddleware, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all teams
router.get('/', authMiddleware, async (req, res) => {
  try {
    const teams = await db.allAsync(`
      SELECT t.*, u.first_name as created_by_first_name, u.last_name as created_by_last_name,
             COUNT(tm.user_id) as member_count
      FROM teams t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN team_members tm ON t.id = tm.team_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    
    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get single team with members
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const team = await db.getAsync(`
      SELECT t.*, u.first_name as created_by_first_name, u.last_name as created_by_last_name
      FROM teams t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `, [id]);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get team members
    const members = await db.allAsync(`
      SELECT tm.*, u.first_name, u.last_name, u.email, u.role as user_role
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY tm.role DESC, u.first_name
    `, [id]);

    res.json({ ...team, members });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Create new team
router.post('/', authMiddleware, requirePermission('manage_users'), async (req, res) => {
  try {
    const { name, description, memberIds = [] } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    // Create team
    const result = await db.runAsync(
      'INSERT INTO teams (name, description, created_by) VALUES (?, ?, ?)',
      [name, description || null, req.user.id]
    );

    const teamId = result.lastID;

    // Add members
    if (memberIds.length > 0) {
      for (const userId of memberIds) {
        await db.runAsync(
          'INSERT INTO team_members (team_id, user_id) VALUES (?, ?)',
          [teamId, userId]
        );
      }
    }

    res.status(201).json({ id: teamId, message: 'Team created successfully' });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Update team
router.put('/:id', authMiddleware, requirePermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    await db.runAsync(
      'UPDATE teams SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description || null, id]
    );

    res.json({ message: 'Team updated successfully' });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete team
router.delete('/:id', authMiddleware, requirePermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;

    await db.runAsync('DELETE FROM teams WHERE id = ?', [id]);
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Add member to team
router.post('/:id/members', authMiddleware, requirePermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role = 'member' } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    await db.runAsync(
      'INSERT OR REPLACE INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)',
      [id, userId, role]
    );

    res.json({ message: 'Member added to team successfully' });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ error: 'Failed to add member to team' });
  }
});

// Remove member from team
router.delete('/:id/members/:userId', authMiddleware, requirePermission('manage_users'), async (req, res) => {
  try {
    const { id, userId } = req.params;

    await db.runAsync('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [id, userId]);
    res.json({ message: 'Member removed from team successfully' });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: 'Failed to remove member from team' });
  }
});

// Get teams for dropdown (simple list)
router.get('/list/simple', authMiddleware, async (req, res) => {
  try {
    const teams = await db.allAsync(`
      SELECT id, name
      FROM teams
      ORDER BY name
    `);
    
    res.json(teams);
  } catch (error) {
    console.error('Get teams list error:', error);
    res.status(500).json({ error: 'Failed to fetch teams list' });
  }
});

module.exports = router;