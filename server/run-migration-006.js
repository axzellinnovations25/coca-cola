require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('./src/db');

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'migrations', '006_add_order_request_fingerprint.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSQL);
    console.log('Migration 006 completed: order retry deduplication is ready.');
  } catch (error) {
    console.error('Migration 006 failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
