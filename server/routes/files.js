const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../database/db');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Vytvorenie uploads adresára ak neexistuje
const uploadsDir = path.join(__dirname, '../uploads/files');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Multer konfigurácia pre upload súborov
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Povolené typy súborov
    const allowedTypes = /\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|mp4|avi|mov)$/i;
    const allowed = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (allowed) {
      cb(null, true);
    } else {
      cb(new Error('Nepodporovaný typ súboru'), false);
    }
  }
});

// Pomocná funkcia na kontrolu oprávnení k súboru
async function checkFilePermission(fileId, userId, action = 'read') {
  try {
    // Získaj info o súbore
    const file = await db.getAsync('SELECT * FROM files WHERE id = ?', [fileId]);
    if (!file) return false;

    // Vlastník má všetky oprávnenia
    if (file.uploaded_by === userId) return true;

    // Skontroluj explicitné oprávnenia
    const permission = await db.getAsync(`
      SELECT * FROM file_permissions 
      WHERE file_id = ? AND (
        (permission_type = 'user' AND target_id = ?) OR
        (permission_type = 'public') OR
        (permission_type = 'project' AND target_id IN (
          SELECT project_id FROM project_employees WHERE user_id = ?
        ))
      )
    `, [fileId, userId, userId]);

    if (!permission) return false;

    // Skontroluj konkrétne oprávnenie
    switch (action) {
      case 'read': return permission.can_read;
      case 'write': return permission.can_write;
      case 'delete': return permission.can_delete;
      default: return false;
    }
  } catch (error) {
    console.error('Error checking file permission:', error);
    return false;
  }
}

// Upload súboru
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Žiadny súbor nebol vybraný' });
    }

    const { description, folderId, shareWith, shareType } = req.body;

    // Uloženie súboru do databázy
    const result = await db.runAsync(`
      INSERT INTO files (filename, original_name, mime_type, size, path, description, uploaded_by, folder_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.file.filename,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      req.file.path,
      description || null,
      req.user.id,
      folderId || null
    ]);

    const fileId = result.lastID;

    // Nastavenie oprávnení na zdieľanie
    if (shareWith && shareType) {
      await setFilePermissions(fileId, shareType, shareWith, req.user.id);
    }

    // Log aktivity
    await db.runAsync(`
      INSERT INTO file_activity (file_id, user_id, action)
      VALUES (?, ?, 'upload')
    `, [fileId, req.user.id]);

    res.status(201).json({
      id: fileId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      message: 'Súbor bol úspešne nahraný'
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Nepodarilo sa nahrať súbor: ' + error.message });
  }
});

// Pomocná funkcia na nastavenie oprávnení
async function setFilePermissions(fileId, shareType, shareWith, grantedBy) {
  try {
    switch (shareType) {
      case 'user':
        const userIds = Array.isArray(shareWith) ? shareWith : [shareWith];
        for (const userId of userIds) {
          await db.runAsync(`
            INSERT INTO file_permissions (file_id, permission_type, target_id, can_read, granted_by)
            VALUES (?, 'user', ?, true, ?)
          `, [fileId, userId, grantedBy]);
        }
        break;
        
      case 'project':
        const projectIds = Array.isArray(shareWith) ? shareWith : [shareWith];
        for (const projectId of projectIds) {
          await db.runAsync(`
            INSERT INTO file_permissions (file_id, permission_type, target_id, can_read, granted_by)
            VALUES (?, 'project', ?, true, ?)
          `, [fileId, projectId, grantedBy]);
        }
        break;
        
      case 'team':
        // Team = všetci používatelia v projekte
        await db.runAsync(`
          INSERT INTO file_permissions (file_id, permission_type, target_id, can_read, granted_by)
          VALUES (?, 'team', NULL, true, ?)
        `, [fileId, grantedBy]);
        break;
        
      case 'public':
        await db.runAsync(`
          INSERT INTO file_permissions (file_id, permission_type, target_id, can_read, granted_by)
          VALUES (?, 'public', NULL, true, ?)
        `, [fileId, grantedBy]);
        break;
    }
  } catch (error) {
    console.error('Error setting file permissions:', error);
  }
}

// Získanie zoznamu súborov
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { folderId } = req.query;
    
    // Získaj súbory kam má používateľ prístup
    const files = await db.allAsync(`
      SELECT DISTINCT f.*, u.first_name, u.last_name,
             GROUP_CONCAT(fp.permission_type) as permissions
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      LEFT JOIN file_permissions fp ON f.id = fp.file_id
      WHERE f.uploaded_by = ? OR f.id IN (
        SELECT file_id FROM file_permissions 
        WHERE (permission_type = 'user' AND target_id = ?) OR
              (permission_type = 'public') OR
              (permission_type = 'team') OR
              (permission_type = 'project' AND target_id IN (
                SELECT project_id FROM project_employees WHERE user_id = ?
              ))
      )
      ${folderId ? 'AND f.folder_id = ?' : 'AND f.folder_id IS NULL'}
      GROUP BY f.id
      ORDER BY f.created_at DESC
    `, folderId ? 
      [req.user.id, req.user.id, req.user.id, folderId] : 
      [req.user.id, req.user.id, req.user.id]
    );

    res.json(files);
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Nepodarilo sa načítať súbory' });
  }
});

// Stiahnutie súboru
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Skontroluj oprávnenia
    const hasPermission = await checkFilePermission(id, req.user.id, 'read');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Nemáte oprávnenie na stiahnutie tohto súboru' });
    }

    const file = await db.getAsync('SELECT * FROM files WHERE id = ?', [id]);
    if (!file) {
      return res.status(404).json({ error: 'Súbor nebol nájdený' });
    }

    // Log aktivity
    await db.runAsync(`
      INSERT INTO file_activity (file_id, user_id, action)
      VALUES (?, ?, 'download')
    `, [id, req.user.id]);

    // Odošli súbor
    res.download(file.path, file.original_name);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Nepodarilo sa stiahnuť súbor' });
  }
});

// Získanie info o súbore
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const hasPermission = await checkFilePermission(id, req.user.id, 'read');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Nemáte oprávnenie na zobrazenie tohto súboru' });
    }

    const file = await db.getAsync(`
      SELECT f.*, u.first_name, u.last_name,
             (SELECT COUNT(*) FROM file_activity WHERE file_id = f.id AND action = 'download') as download_count
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.id = ?
    `, [id]);

    if (!file) {
      return res.status(404).json({ error: 'Súbor nebol nájdený' });
    }

    // Získaj oprávnenia
    const permissions = await db.allAsync(`
      SELECT fp.*, u.first_name, u.last_name, p.name as project_name
      FROM file_permissions fp
      LEFT JOIN users u ON fp.target_id = u.id AND fp.permission_type = 'user'
      LEFT JOIN projects p ON fp.target_id = p.id AND fp.permission_type = 'project'
      WHERE fp.file_id = ?
    `, [id]);

    file.permissions = permissions;

    // Log view aktivity
    await db.runAsync(`
      INSERT INTO file_activity (file_id, user_id, action)
      VALUES (?, ?, 'view')
    `, [id, req.user.id]);

    res.json(file);
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ error: 'Nepodarilo sa načítať súbor' });
  }
});

// Vymazanie súboru
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const hasPermission = await checkFilePermission(id, req.user.id, 'delete');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Nemáte oprávnenie na vymazanie tohto súboru' });
    }

    const file = await db.getAsync('SELECT * FROM files WHERE id = ?', [id]);
    if (!file) {
      return res.status(404).json({ error: 'Súbor nebol nájdený' });
    }

    // Vymaž súbor z disku
    try {
      await fs.unlink(file.path);
    } catch (error) {
      console.error('Failed to delete file from disk:', error);
    }

    // Vymaž z databázy
    await db.runAsync('DELETE FROM files WHERE id = ?', [id]);

    res.json({ message: 'Súbor bol úspešne vymazaný' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Nepodarilo sa vymazať súbor' });
  }
});

// Aktualizácia oprávnení súboru
router.put('/:id/permissions', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { shareType, shareWith } = req.body;
    
    // Iba vlastník môže meniť oprávnenia
    const file = await db.getAsync('SELECT * FROM files WHERE id = ?', [id]);
    if (!file) {
      return res.status(404).json({ error: 'Súbor nebol nájdený' });
    }
    
    if (file.uploaded_by !== req.user.id) {
      return res.status(403).json({ error: 'Nemáte oprávnenie na zmenu oprávnení tohto súboru' });
    }

    // Vymaž existujúce oprávnenia
    await db.runAsync('DELETE FROM file_permissions WHERE file_id = ?', [id]);

    // Nastav nové oprávnenia
    if (shareType && shareWith) {
      await setFilePermissions(id, shareType, shareWith, req.user.id);
    }

    res.json({ message: 'Oprávnenia boli úspešne aktualizované' });
  } catch (error) {
    console.error('Update file permissions error:', error);
    res.status(500).json({ error: 'Nepodarilo sa aktualizovať oprávnenia' });
  }
});

// Získanie dostupných používateľov a projektov pre zdieľanie
router.get('/share/options', authMiddleware, async (req, res) => {
  try {
    const users = await db.allAsync(`
      SELECT id, first_name, last_name, email 
      FROM users 
      WHERE id != ? AND is_active = true
      ORDER BY first_name, last_name
    `, [req.user.id]);

    const projects = await db.allAsync(`
      SELECT DISTINCT p.id, p.name 
      FROM projects p
      JOIN project_employees pe ON p.id = pe.project_id
      WHERE pe.user_id = ? AND p.status = 'active'
      ORDER BY p.name
    `, [req.user.id]);

    res.json({ users, projects });
  } catch (error) {
    console.error('Get share options error:', error);
    res.status(500).json({ error: 'Nepodarilo sa načítať možnosti zdieľania' });
  }
});

module.exports = router;