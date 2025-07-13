const express = require('express');
const db = require('../database/db');
const { authMiddleware, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all companies
router.get('/', authMiddleware, requirePermission('manage_companies'), async (req, res) => {
  try {
    const companies = await db.allAsync(`
      SELECT c.*, u.first_name, u.last_name
      FROM companies c
      LEFT JOIN users u ON c.created_by = u.id
      ORDER BY c.created_at DESC
    `);

    res.json(companies);
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get single company
router.get('/:id', authMiddleware, requirePermission('manage_companies'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const company = await db.getAsync(
      'SELECT * FROM companies WHERE id = ?',
      [id]
    );

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get projects for this company
    const projects = await db.allAsync(
      'SELECT * FROM projects WHERE company_id = ?',
      [id]
    );

    res.json({ ...company, projects });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Create new company
router.post('/', authMiddleware, requirePermission('manage_companies'), async (req, res) => {
  try {
    const { name, email, phone, address, taxId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const result = await db.runAsync(
      `INSERT INTO companies (name, email, phone, address, tax_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email || null, phone || null, address || null, taxId || null, req.user.id]
    );

    res.status(201).json({ 
      id: result.lastID,
      message: 'Company created successfully' 
    });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Update company
router.put('/:id', authMiddleware, requirePermission('manage_companies'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, taxId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    await db.runAsync(
      `UPDATE companies 
       SET name = ?, email = ?, phone = ?, address = ?, tax_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, email || null, phone || null, address || null, taxId || null, id]
    );

    res.json({ message: 'Company updated successfully' });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// Delete company
router.delete('/:id', authMiddleware, requirePermission('manage_companies'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if company has projects
    const projectCount = await db.getAsync(
      'SELECT COUNT(*) as count FROM projects WHERE company_id = ?',
      [id]
    );

    if (projectCount.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete company with existing projects. Please delete projects first.' 
      });
    }

    await db.runAsync('DELETE FROM companies WHERE id = ?', [id]);
    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

module.exports = router;