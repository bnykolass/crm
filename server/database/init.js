const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'crm.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create tables
const createTables = () => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      hourly_rate DECIMAL(10,2),
      role TEXT NOT NULL DEFAULT 'employee',
      is_active BOOLEAN DEFAULT true,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Permissions table
  db.run(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User permissions junction table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      user_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, permission_id),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
    )
  `);

  // Companies table
  db.run(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      tax_id TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  // Projects table
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      company_id INTEGER NOT NULL,
      start_date DATE,
      end_date DATE,
      status TEXT DEFAULT 'active',
      budget DECIMAL(10,2),
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  // Project employees junction table
  db.run(`
    CREATE TABLE IF NOT EXISTS project_employees (
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Tasks table
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      project_id INTEGER,
      assigned_to INTEGER,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      due_date DATETIME,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (assigned_to) REFERENCES users (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  // Timesheets table
  db.run(`
    CREATE TABLE IF NOT EXISTS timesheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      start_time DATETIME,
      end_time DATETIME,
      duration INTEGER,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Quotes table
  db.run(`
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      project_id INTEGER,
      title TEXT NOT NULL,
      content TEXT,
      total_amount DECIMAL(10,2),
      status TEXT DEFAULT 'draft',
      valid_until DATE,
      created_by INTEGER NOT NULL,
      reviewed_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies (id),
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (created_by) REFERENCES users (id),
      FOREIGN KEY (reviewed_by) REFERENCES users (id)
    )
  `);

  // Quote comments table
  db.run(`
    CREATE TABLE IF NOT EXISTS quote_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Task comments table
  db.run(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Attachments table
  db.run(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER,
      task_id INTEGER,
      quote_id INTEGER,
      uploaded_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
      FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users (id)
    )
  `);

  // Chat messages table
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER,
      group_id INTEGER,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users (id)
    )
  `);

  // Chat groups table
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  // Chat group members table
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_group_members (
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES chat_groups (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Files table (rozšírená verzia attachments pre komplexný file sharing)
  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER,
      path TEXT NOT NULL,
      description TEXT,
      uploaded_by INTEGER NOT NULL,
      folder_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users (id),
      FOREIGN KEY (folder_id) REFERENCES folders (id)
    )
  `);

  // Folders table
  db.run(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES folders (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  // File permissions table
  db.run(`
    CREATE TABLE IF NOT EXISTS file_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      permission_type TEXT NOT NULL CHECK (permission_type IN ('user', 'project', 'team', 'public')),
      target_id INTEGER, -- user_id, project_id alebo NULL pre public
      can_read BOOLEAN DEFAULT true,
      can_write BOOLEAN DEFAULT false,
      can_delete BOOLEAN DEFAULT false,
      granted_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
      FOREIGN KEY (granted_by) REFERENCES users (id)
    )
  `);

  // File downloads/views log
  db.run(`
    CREATE TABLE IF NOT EXISTS file_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('view', 'download', 'share')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);
};

// Seed initial data
const seedData = async () => {
  // Create default admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  
  db.run(`
    INSERT OR IGNORE INTO users (email, password, first_name, last_name, role)
    VALUES (?, ?, ?, ?, ?)
  `, ['admin@crm.sk', adminPassword, 'Admin', 'User', 'admin']);

  // Create default permissions
  const permissions = [
    { name: 'manage_users', description: 'Can create, edit, delete users' },
    { name: 'manage_companies', description: 'Can manage companies' },
    { name: 'manage_projects', description: 'Can manage projects' },
    { name: 'manage_tasks', description: 'Can manage all tasks' },
    { name: 'manage_quotes', description: 'Can manage quotes' },
    { name: 'view_reports', description: 'Can view reports' },
    { name: 'manage_settings', description: 'Can manage system settings' },
    { name: 'edit_own_tasks', description: 'Can edit own tasks' },
    { name: 'add_timesheets', description: 'Can add timesheets' },
    { name: 'use_chat', description: 'Can use chat' },
    { name: 'use_files', description: 'Can upload and manage files' }
  ];

  permissions.forEach(perm => {
    db.run(`
      INSERT OR IGNORE INTO permissions (name, description)
      VALUES (?, ?)
    `, [perm.name, perm.description]);
  });

  // Give admin all permissions
  db.run(`
    INSERT OR IGNORE INTO user_permissions (user_id, permission_id)
    SELECT 1, id FROM permissions
  `);

  // Create default settings
  const defaultSettings = [
    { key: 'sendgrid_api_key', value: '' },
    { key: 'sendgrid_from_email', value: 'noreply@crm.sk' },
    { key: 'sendgrid_from_name', value: 'CRM System' },
    { key: 'email_notifications_enabled', value: 'false' },
    { key: 'task_assignment_notifications', value: 'true' },
    { key: 'task_comment_notifications', value: 'true' },
    { key: 'task_reminder_notifications', value: 'true' },
    { key: 'company_name', value: 'Vaša spoločnosť' },
    { key: 'company_address', value: '' },
    { key: 'company_phone', value: '' },
    { key: 'company_email', value: 'info@crm.sk' },
    { key: 'default_hourly_rate', value: '25.00' },
    { key: 'currency', value: 'EUR' },
    { key: 'timezone', value: 'Europe/Bratislava' },
    { key: 'date_format', value: 'DD.MM.YYYY' },
    { key: 'auto_task_reminders', value: 'true' },
    { key: 'reminder_hours_before', value: '24' }
  ];

  defaultSettings.forEach(setting => {
    db.run(`
      INSERT OR IGNORE INTO settings (key, value)
      VALUES (?, ?)
    `, [setting.key, setting.value]);
  });

  console.log('Database initialized with seed data');
};

// Initialize database
createTables();
setTimeout(seedData, 1000); // Wait for tables to be created

module.exports = db;