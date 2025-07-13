-- Add attachment fields to chat_messages table
ALTER TABLE chat_messages ADD COLUMN attachment_path TEXT;
ALTER TABLE chat_messages ADD COLUMN attachment_name TEXT;
ALTER TABLE chat_messages ADD COLUMN attachment_type TEXT;

-- Update message column to allow NULL (since attachment-only messages won't have text)
-- Note: SQLite doesn't support modifying column constraints, so we'll leave it as is
-- and handle NULL messages in the application logic