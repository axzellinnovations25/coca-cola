require('dotenv').config();
const sessionService = require('./src/services/sessionService');

async function cleanupSessions() {
  console.log('🧹 Cleaning up expired sessions...\n');
  
  try {
    await sessionService.cleanupExpiredSessions();
    console.log('✅ Expired sessions cleaned up successfully');
  } catch (error) {
    console.error('❌ Error cleaning up sessions:', error);
  }
  
  console.log('\n🏁 Cleanup completed!');
}

// Run cleanup
cleanupSessions(); 