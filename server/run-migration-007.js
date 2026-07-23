require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('./src/db');

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'migrations', '007_add_units_per_case.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSQL);
    console.log('Migration 007 completed: products.units_per_case added and backfilled.');
  } catch (error) {
    console.error('Migration 007 failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
