require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./src/db');

async function runMigration() {
  try {
    console.log('Running out_of_date tables migration...');

    const migrationPath = path.join(__dirname, 'migrations', '003_create_out_of_date.sql');
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

