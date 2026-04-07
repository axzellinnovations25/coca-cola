const dns = require('dns');
const app = require('./app');
const pool = require('./src/db');
const sessionService = require('./src/services/sessionService');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const port = process.env.PORT || 3001;

function testDatabaseConnection(retries = 3, delay = 2000) {
  console.log(`Testing AWS RDS connection (attempt ${4 - retries}/3)...`);

  pool.query('SELECT NOW(), version()', (err, res) => {
    if (err) {
      console.error('Error connecting to Supabase:', err.message);
      console.error('Error code:', err.code);

      if (retries > 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        setTimeout(() => testDatabaseConnection(retries - 1, delay), delay);
      } else {
        console.error('Failed to connect to Supabase after 3 attempts');
        console.log('Check your Supabase instance status and connection pooler configuration');
      }
    } else {
      console.log('Connected to Supabase successfully');
      console.log('Server time:', res.rows[0].now);
      console.log('PostgreSQL version:', res.rows[0].version);
    }
  });
}

async function runSessionCleanup() {
  try {
    console.log('Running automated session cleanup...');
    await sessionService.cleanupExpiredSessions();
    console.log('Session cleanup completed successfully');
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
}

function scheduleSessionCleanup() {
  const EIGHT_HOURS = 8 * 60 * 60 * 1000;

  runSessionCleanup();
  setInterval(runSessionCleanup, EIGHT_HOURS);

  console.log('Session cleanup scheduled to run every 8 hours');
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log('Testing database connection...');

  setTimeout(() => {
    testDatabaseConnection();
  }, 1000);

  scheduleSessionCleanup();
});
