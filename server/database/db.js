const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require('util');

const dbPath = path.join(__dirname, 'crm.db');

const db = new sqlite3.Database(dbPath);

// Promisify database methods for async/await with proper this context
db.runAsync = function(...args) {
  return new Promise((resolve, reject) => {
    db.run(...args, function(error) {
      if (error) {
        reject(error);
      } else {
        resolve(this); // this contains lastID and changes
      }
    });
  });
};
db.getAsync = promisify(db.get.bind(db));
db.allAsync = promisify(db.all.bind(db));

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

module.exports = db;