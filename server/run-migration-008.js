require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('./src/db');

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'migrations', '008_add_immutable_returns_and_credit_notes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSQL);
    console.log('Migration 008 completed: immutable returns and credit notes added.');
  } catch (error) {
    console.error('Migration 008 failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
