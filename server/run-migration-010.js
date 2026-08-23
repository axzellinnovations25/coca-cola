require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('./src/db');

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'migrations', '010_add_collection_review_marker.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSQL);
    console.log('Migration 010 completed: collection review markers added.');
  } catch (error) {
    console.error('Migration 010 failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
