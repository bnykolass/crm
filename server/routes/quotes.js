const express = require('express');
const db = require('../database/db');
const { authMiddleware, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all quotes
router.get('/', authMiddleware, requirePermission('manage_quotes'), async (req, res) => {
  try {
    const quotes = await db.allAsync(`
      SELECT q.*, c.name as company_name, p.name as project_name,
             u1.first_name as created_by_first_name, u1.last_name as created_by_last_name,
             u2.first_name as reviewed_by_first_name, u2.last_name as reviewed_by_last_name
      FROM quotes q
      LEFT JOIN companies c ON q.company_id = c.id
      LEFT JOIN projects p ON q.project_id = p.id
      LEFT JOIN users u1 ON q.created_by = u1.id
      LEFT JOIN users u2 ON q.reviewed_by = u2.id
      ORDER BY q.created_at DESC
    `);

    res.json(quotes);
  } catch (error) {
    console.error('Get quotes error:', error);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// Get single quote
router.get('/:id', authMiddleware, requirePermission('manage_quotes'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const quote = await db.getAsync(`
      SELECT q.*, c.name as company_name, p.name as project_name
      FROM quotes q
      LEFT JOIN companies c ON q.company_id = c.id
      LEFT JOIN projects p ON q.project_id = p.id
      WHERE q.id = ?
    `, [id]);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Get comments for this quote
    const comments = await db.allAsync(`
      SELECT qc.*, u.first_name, u.last_name
      FROM quote_comments qc
      JOIN users u ON qc.user_id = u.id
      WHERE qc.quote_id = ?
      ORDER BY qc.created_at ASC
    `, [id]);

    res.json({ ...quote, comments });
  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// Create new quote
router.post('/', authMiddleware, requirePermission('manage_quotes'), async (req, res) => {
  try {
    const { title, content, companyId, projectId, totalAmount, validUntil } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Quote title is required' });
    }

    const result = await db.runAsync(
      `INSERT INTO quotes (title, content, company_id, project_id, total_amount, valid_until, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, content || null, companyId || null, projectId || null, 
       totalAmount || null, validUntil || null, req.user.id]
    );

    res.status(201).json({ 
      id: result.lastID,
      message: 'Quote created successfully' 
    });
  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({ error: 'Failed to create quote' });
  }
});

// Update quote
router.put('/:id', authMiddleware, requirePermission('manage_quotes'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, companyId, projectId, totalAmount, validUntil, status } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Quote title is required' });
    }

    await db.runAsync(
      `UPDATE quotes 
       SET title = ?, content = ?, company_id = ?, project_id = ?, 
           total_amount = ?, valid_until = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, content || null, companyId || null, projectId || null, 
       totalAmount || null, validUntil || null, status || 'draft', id]
    );

    res.json({ message: 'Quote updated successfully' });
  } catch (error) {
    console.error('Update quote error:', error);
    res.status(500).json({ error: 'Failed to update quote' });
  }
});

// Delete quote
router.delete('/:id', authMiddleware, requirePermission('manage_quotes'), async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM quotes WHERE id = ?', [id]);
    res.json({ message: 'Quote deleted successfully' });
  } catch (error) {
    console.error('Delete quote error:', error);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
});

// Send quote for review
router.post('/:id/send-for-review', authMiddleware, requirePermission('manage_quotes'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerId } = req.body;

    if (!reviewerId) {
      return res.status(400).json({ error: 'Reviewer is required' });
    }

    await db.runAsync(
      `UPDATE quotes 
       SET status = 'pending_review', reviewed_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reviewerId, id]
    );

    res.json({ message: 'Quote sent for review successfully' });
  } catch (error) {
    console.error('Send quote for review error:', error);
    res.status(500).json({ error: 'Failed to send quote for review' });
  }
});

// Add comment to quote
router.post('/:id/comments', authMiddleware, requirePermission('manage_quotes'), async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    await db.runAsync(
      'INSERT INTO quote_comments (quote_id, user_id, comment) VALUES (?, ?, ?)',
      [id, req.user.id, comment]
    );

    res.status(201).json({ message: 'Comment added successfully' });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get companies for dropdown
router.get('/companies/list', authMiddleware, requirePermission('manage_quotes'), async (req, res) => {
  try {
    const companies = await db.allAsync('SELECT id, name FROM companies ORDER BY name');
    res.json(companies);
  } catch (error) {
    console.error('Get companies list error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get projects for dropdown
router.get('/projects/list', authMiddleware, requirePermission('manage_quotes'), async (req, res) => {
  try {
    const { companyId } = req.query;
    let query = 'SELECT id, name FROM projects';
    let params = [];
    
    if (companyId) {
      query += ' WHERE company_id = ?';
      params.push(companyId);
    }
    
    query += ' ORDER BY name';
    
    const projects = await db.allAsync(query, params);
    res.json(projects);
  } catch (error) {
    console.error('Get projects list error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get users for reviewer dropdown
router.get('/reviewers/list', authMiddleware, requirePermission('manage_quotes'), async (req, res) => {
  try {
    const reviewers = await db.allAsync(
      'SELECT id, first_name, last_name, email FROM users WHERE is_active = true ORDER BY first_name'
    );
    res.json(reviewers);
  } catch (error) {
    console.error('Get reviewers list error:', error);
    res.status(500).json({ error: 'Failed to fetch reviewers' });
  }
});

module.exports = router;