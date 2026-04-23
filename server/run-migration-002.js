require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./src/db');

async function runMigration() {
  try {
    console.log('Running reserved_stock migration...');
    const migrationPath = path.join(__dirname, 'migrations', '002_add_reserved_stock.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSQL);
    console.log('Migration completed successfully!');
    console.log('reserved_stock column added to products table.');
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'reserved_stock'
    `);
    if (result.rows.length > 0) {
      console.log('Column verification successful!');
    } else {
      console.log('Column verification failed!');
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
