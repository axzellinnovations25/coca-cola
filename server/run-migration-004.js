require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./src/db');

async function runMigration() {
  try {
    console.log('Running order_items id migration...');

    const migrationPath = path.join(__dirname, 'migrations', '004_add_order_item_id.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSQL);

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

runMigration();

