const fs = require('fs');
const path = require('path');
const db = require('./db');

const runMigration = async (migrationFile) => {
  try {
    console.log(`Running migration: ${migrationFile}`);
    
    const migrationPath = path.join(__dirname, 'migrations', migrationFile);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and filter out empty statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        await db.runAsync(statement);
        console.log(`✓ Executed: ${statement.substring(0, 50)}...`);
      }
    }
    
    console.log(`✅ Migration completed: ${migrationFile}`);
  } catch (error) {
    console.error(`❌ Migration failed: ${migrationFile}`, error);
    throw error;
  }
};

const runAllMigrations = async () => {
  try {
    console.log('Starting database migrations...');
    
    // Run the notifications migration
    await runMigration('add_notifications.sql');
    
    // Run the chat attachments migration
    await runMigration('add_chat_attachments.sql');
    
    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('Migration process failed:', error);
    process.exit(1);
  }
};

// Run migrations if this file is executed directly
if (require.main === module) {
  runAllMigrations();
}

module.exports = { runMigration, runAllMigrations };