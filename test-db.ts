import Database from 'better-sqlite3';
const db = new Database(':memory:');
console.log('Database created');
const row = db.prepare('SELECT 1 as one').get();
console.log('Query result:', row);
