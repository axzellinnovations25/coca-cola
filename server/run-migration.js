require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./src/db');

async function runMigration() {
  try {
    console.log('🔧 Running password_reset_tokens table migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_create_password_reset_tokens.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('📋 password_reset_tokens table has been created.');
    
    // Verify the table was created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'password_reset_tokens'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Table verification successful!');
    } else {
      console.log('❌ Table verification failed!');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

runMigration(); 