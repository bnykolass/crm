-- Migration: Add notifications table and task confirmation fields
-- Date: 2025-01-01
-- Description: Add notification system and task confirmation functionality

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  task_id INTEGER,
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Add confirmation fields to tasks table (skip if already exist)
-- ALTER TABLE tasks ADD COLUMN confirmation_status TEXT DEFAULT 'pending';
-- ALTER TABLE tasks ADD COLUMN confirmation_message TEXT;  
-- ALTER TABLE tasks ADD COLUMN confirmed_at DATETIME;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_confirmation_status ON tasks(confirmation_status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);