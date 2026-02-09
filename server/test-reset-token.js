require('dotenv').config();
const pool = require('./src/db');
const { generateResetToken, generateResetTokenHash } = require('./src/utils/password');

async function testResetToken() {
  try {
    console.log('🧪 Testing password reset token functionality...');
    
    // First, let's check if there are any users in the database
    const usersResult = await pool.query('SELECT id, email, first_name FROM users LIMIT 5');
    console.log(`📋 Found ${usersResult.rows.length} users in database`);
    
    if (usersResult.rows.length === 0) {
      console.log('❌ No users found in database. Please create a user first.');
      return;
    }
    
    const testUser = usersResult.rows[0];
    console.log(`👤 Using test user: ${testUser.email} (${testUser.first_name})`);
    
    // Generate a test reset token
    const resetToken = generateResetToken();
    const resetTokenHash = generateResetTokenHash(resetToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    console.log(`🔑 Generated reset token: ${resetToken.substring(0, 10)}...`);
    console.log(`🔐 Token hash: ${resetTokenHash.substring(0, 10)}...`);
    
    // Insert the token into the database
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET token_hash = $2, expires_at = $3, created_at = now()',
      [testUser.id, resetTokenHash, expiresAt]
    );
    
    console.log('✅ Reset token stored in database');
    
    // Test token validation
    const validationResult = await pool.query(`
      SELECT prt.*, u.email 
      FROM password_reset_tokens prt 
      JOIN users u ON prt.user_id = u.id 
      WHERE prt.token_hash = $1 AND prt.expires_at > now() AND prt.used = false
    `, [resetTokenHash]);
    
    if (validationResult.rows.length > 0) {
      console.log('✅ Token validation successful!');
      console.log(`📧 Associated email: ${validationResult.rows[0].email}`);
      
      // Test the reset URL
      const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;
      console.log(`🔗 Reset URL: ${resetUrl}`);
      
    } else {
      console.log('❌ Token validation failed!');
    }
    
    // Clean up - remove the test token
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [testUser.id]);
    console.log('🧹 Test token cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

testResetToken(); 