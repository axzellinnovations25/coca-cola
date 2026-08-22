require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('./src/db');

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'migrations', '009_add_custom_out_of_date_credit.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSQL);
    console.log('Migration 009 completed: custom out-of-date credits added.');
  } catch (error) {
    console.error('Migration 009 failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
