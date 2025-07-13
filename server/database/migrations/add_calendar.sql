-- Vytvorenie calendar_events tabuľky
CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,
  event_type TEXT DEFAULT 'personal', -- personal, meeting, deadline, task
  priority TEXT DEFAULT 'medium', -- low, medium, high
  color TEXT DEFAULT '#1976d2',
  location TEXT,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabuľka pre zdieľanie eventov s inými používateľmi
CREATE TABLE IF NOT EXISTS calendar_event_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  response TEXT DEFAULT 'pending', -- pending, accepted, declined
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id),
  FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Pripomienky pre eventy
CREATE TABLE IF NOT EXISTS calendar_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  remind_before_minutes INTEGER NOT NULL DEFAULT 15, -- 15 minút pred eventom
  reminded BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexy pre výkon
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_datetime ON calendar_events(start_datetime, end_datetime);
CREATE INDEX IF NOT EXISTS idx_calendar_participants_event ON calendar_event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_participants_user ON calendar_event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_reminders_event ON calendar_reminders(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_reminders_user ON calendar_reminders(user_id);