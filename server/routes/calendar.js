const express = require('express');
const db = require('../database/db');
const { authMiddleware, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get events for user (own events + events where user is participant)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { start, end, view } = req.query;
    
    let query = `
      SELECT DISTINCT e.*, u.first_name as created_by_first_name, u.last_name as created_by_last_name,
             CASE 
               WHEN e.created_by = ? THEN 'owner'
               ELSE 'participant'
             END as user_role
      FROM calendar_events e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN calendar_event_participants cep ON e.id = cep.event_id
      WHERE (e.created_by = ? OR cep.user_id = ?)
    `;
    let params = [req.user.id, req.user.id, req.user.id];

    // Filter by date range if provided
    if (start && end) {
      query += ` AND (
        (e.start_datetime >= ? AND e.start_datetime <= ?) OR
        (e.end_datetime >= ? AND e.end_datetime <= ?) OR
        (e.start_datetime <= ? AND e.end_datetime >= ?)
      )`;
      params.push(start, end, start, end, start, end);
    }

    query += ' ORDER BY e.start_datetime ASC';

    const events = await db.allAsync(query, params);

    // Get participants for each event
    for (const event of events) {
      const participants = await db.allAsync(`
        SELECT cep.*, u.first_name, u.last_name, u.email
        FROM calendar_event_participants cep
        JOIN users u ON cep.user_id = u.id
        WHERE cep.event_id = ?
      `, [event.id]);
      
      event.participants = participants;
    }

    res.json(events);
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// Get single event
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await db.getAsync(`
      SELECT e.*, u.first_name as created_by_first_name, u.last_name as created_by_last_name
      FROM calendar_events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = ?
    `, [id]);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user has access to this event
    const hasAccess = event.created_by === req.user.id || 
      await db.getAsync('SELECT id FROM calendar_event_participants WHERE event_id = ? AND user_id = ?', [id, req.user.id]);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get participants
    const participants = await db.allAsync(`
      SELECT cep.*, u.first_name, u.last_name, u.email
      FROM calendar_event_participants cep
      JOIN users u ON cep.user_id = u.id
      WHERE cep.event_id = ?
    `, [id]);

    event.participants = participants;

    res.json(event);
  } catch (error) {
    console.error('Get calendar event error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar event' });
  }
});

// Create new event
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      title,
      description,
      start_datetime,
      end_datetime,
      all_day,
      event_type,
      priority,
      color,
      location,
      participants
    } = req.body;

    if (!title || !start_datetime || !end_datetime) {
      return res.status(400).json({ error: 'Title, start time and end time are required' });
    }

    // Create event
    const result = await db.runAsync(
      `INSERT INTO calendar_events (title, description, start_datetime, end_datetime, all_day, event_type, priority, color, location, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || null,
        start_datetime,
        end_datetime,
        all_day || false,
        event_type || 'personal',
        priority || 'medium',
        color || '#1976d2',
        location || null,
        req.user.id
      ]
    );

    const eventId = result.lastID;

    // Add participants if provided
    if (participants && participants.length > 0) {
      for (const userId of participants) {
        if (userId !== req.user.id) { // Don't add creator as participant
          await db.runAsync(
            'INSERT OR IGNORE INTO calendar_event_participants (event_id, user_id) VALUES (?, ?)',
            [eventId, userId]
          );
        }
      }
    }

    res.status(201).json({ 
      id: eventId,
      message: 'Event created successfully' 
    });
  } catch (error) {
    console.error('Create calendar event error:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// Update event
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      start_datetime,
      end_datetime,
      all_day,
      event_type,
      priority,
      color,
      location
    } = req.body;

    // Check if user owns this event
    const event = await db.getAsync('SELECT created_by FROM calendar_events WHERE id = ?', [id]);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only event creator can modify this event' });
    }

    await db.runAsync(
      `UPDATE calendar_events 
       SET title = ?, description = ?, start_datetime = ?, end_datetime = ?, all_day = ?, 
           event_type = ?, priority = ?, color = ?, location = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title,
        description || null,
        start_datetime,
        end_datetime,
        all_day || false,
        event_type || 'personal',
        priority || 'medium',
        color || '#1976d2',
        location || null,
        id
      ]
    );

    res.json({ message: 'Event updated successfully' });
  } catch (error) {
    console.error('Update calendar event error:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

// Delete event
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user owns this event
    const event = await db.getAsync('SELECT created_by FROM calendar_events WHERE id = ?', [id]);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only event creator can delete this event' });
    }

    await db.runAsync('DELETE FROM calendar_events WHERE id = ?', [id]);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete calendar event error:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

// Get upcoming events count (for menu badge)
router.get('/upcoming/count', authMiddleware, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const count = await db.getAsync(`
      SELECT COUNT(DISTINCT e.id) as count
      FROM calendar_events e
      LEFT JOIN calendar_event_participants cep ON e.id = cep.event_id
      WHERE (e.created_by = ? OR cep.user_id = ?)
        AND e.start_datetime >= ?
        AND e.start_datetime <= ?
    `, [req.user.id, req.user.id, now, nextWeek]);

    res.json({ count: count.count || 0 });
  } catch (error) {
    console.error('Get upcoming events count error:', error);
    res.status(500).json({ error: 'Failed to get upcoming events count' });
  }
});

// Get week view events
router.get('/week/:date', authMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    const startDate = new Date(date);
    
    // Get start of week (Monday)
    const startOfWeek = new Date(startDate);
    startOfWeek.setDate(startDate.getDate() - startDate.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Get end of week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const events = await db.allAsync(`
      SELECT DISTINCT e.*, u.first_name as created_by_first_name, u.last_name as created_by_last_name,
             (u.first_name || ' ' || u.last_name) as creator_name
      FROM calendar_events e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN calendar_event_participants cep ON e.id = cep.event_id
      WHERE (e.created_by = ? OR cep.user_id = ?)
        AND (
          (e.start_datetime >= ? AND e.start_datetime <= ?) OR
          (e.end_datetime >= ? AND e.end_datetime <= ?) OR
          (e.start_datetime <= ? AND e.end_datetime >= ?)
        )
      ORDER BY e.start_datetime ASC
    `, [req.user.id, req.user.id, startOfWeek.toISOString(), endOfWeek.toISOString(),
        startOfWeek.toISOString(), endOfWeek.toISOString(),
        startOfWeek.toISOString(), endOfWeek.toISOString()]);

    res.json({
      events,
      weekStart: startOfWeek.toISOString(),
      weekEnd: endOfWeek.toISOString()
    });
  } catch (error) {
    console.error('Get week events error:', error);
    res.status(500).json({ error: 'Failed to fetch week events' });
  }
});

// Get events by date range (for month view)
router.get('/range/:start/:end', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.params;
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const events = await db.allAsync(`
      SELECT DISTINCT e.*, u.first_name as created_by_first_name, u.last_name as created_by_last_name,
             (u.first_name || ' ' || u.last_name) as creator_name
      FROM calendar_events e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN calendar_event_participants cep ON e.id = cep.event_id
      WHERE (e.created_by = ? OR cep.user_id = ?)
        AND (
          (e.start_datetime >= ? AND e.start_datetime <= ?) OR
          (e.end_datetime >= ? AND e.end_datetime <= ?) OR
          (e.start_datetime <= ? AND e.end_datetime >= ?)
        )
      ORDER BY e.start_datetime ASC
    `, [req.user.id, req.user.id, startDate.toISOString(), endDate.toISOString(),
        startDate.toISOString(), endDate.toISOString(),
        startDate.toISOString(), endDate.toISOString()]);

    res.json({
      events,
      rangeStart: startDate.toISOString(),
      rangeEnd: endDate.toISOString()
    });
  } catch (error) {
    console.error('Get range events error:', error);
    res.status(500).json({ error: 'Failed to fetch range events' });
  }
});

module.exports = router;