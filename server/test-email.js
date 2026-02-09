require('dotenv').config();
const emailService = require('./src/services/emailService');

async function testEmailService() {
  try {
    console.log('🧪 Testing email service...');
    
    // Check SMTP configuration
    console.log('📧 SMTP Configuration:');
    console.log(`   Host: ${process.env.SMTP_HOST || 'NOT SET'}`);
    console.log(`   Port: ${process.env.SMTP_PORT || 'NOT SET'}`);
    console.log(`   Secure: ${process.env.SMTP_SECURE || 'NOT SET'}`);
    console.log(`   User: ${process.env.SMTP_USER || 'NOT SET'}`);
    console.log(`   From: ${process.env.SMTP_FROM || 'NOT SET'}`);
    
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('❌ SMTP configuration is incomplete!');
      console.log('🔧 Please set the following environment variables:');
      console.log('   - SMTP_HOST');
      console.log('   - SMTP_PORT');
      console.log('   - SMTP_SECURE');
      console.log('   - SMTP_USER');
      console.log('   - SMTP_PASS');
      console.log('   - SMTP_FROM');
      return;
    }
    
    // Test password reset email
    const testResetToken = 'test-token-123456789';
    const testEmail = 'test@example.com';
    const testFirstName = 'Test';
    
    console.log(`📧 Sending test password reset email to: ${testEmail}`);
    
    await emailService.sendPasswordResetEmail({
      to: testEmail,
      firstName: testFirstName,
      resetToken: testResetToken,
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('📋 Check your email inbox for the test message.');
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.error('Error details:', error);
    
    if (error.code === 'EAUTH') {
      console.log('🔧 Authentication failed. Please check your SMTP credentials.');
    } else if (error.code === 'ECONNECTION') {
      console.log('🔧 Connection failed. Please check your SMTP host and port.');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('🔧 Connection timeout. Please check your network connection.');
    }
  }
}

testEmailService(); 