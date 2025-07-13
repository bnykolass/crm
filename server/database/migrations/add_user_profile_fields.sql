-- Pridanie profilových polí pre používateľov
ALTER TABLE users ADD COLUMN nickname TEXT;
ALTER TABLE users ADD COLUMN profile_photo TEXT;

-- Vytvorenie tabuľky pre skupinové chaty
CREATE TABLE IF NOT EXISTS chat_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Členovia skupinových chatov
CREATE TABLE IF NOT EXISTS chat_group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'member', -- member, admin
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Upraviť chat_messages tabuľku pre podporu skupinových správ
ALTER TABLE chat_messages ADD COLUMN group_id INTEGER;
ALTER TABLE chat_messages ADD FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE;

-- Pridať is_read flag pre správy (pre počítanie neprečítaných)
ALTER TABLE chat_messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE;

-- Indexy pre výkon
CREATE INDEX IF NOT EXISTS idx_chat_group_members_group_id ON chat_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_user_id ON chat_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON chat_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_read ON chat_messages(is_read);