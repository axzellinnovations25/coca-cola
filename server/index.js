require('dotenv').config();

// Configure DNS to use Google DNS (which we confirmed works)
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const cors = require('cors');
const clientRouter = require('./src/routes/client');
const sessionRouter = require('./src/routes/session');
const pool = require('./src/db');
const sessionService = require('./src/services/sessionService');

const app = express();
const port = process.env.PORT || 3001;

const allowedOriginPatterns = [
  /^http:\/\/localhost(?::\d+)?$/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
  /^http:\/\/0\.0\.0\.0(?::\d+)?$/,
  /^http:\/\/172\.\d+\.\d+\.\d+(?::\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.netlify\.app$/i,
  /^https:\/\/[a-z0-9-]+\.netlify\.com$/i,
];

const allowedOrigins = new Set([
  'https://sbdistribution.store',
  'https://www.sbdistribution.store',
  process.env.FRONTEND_URL,
].filter(Boolean));

// CORS configuration
const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.has(origin) || allowedOriginPatterns.some((pattern) => pattern.test(origin))) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

// Test DB connection on startup with retry logic
function testDatabaseConnection(retries = 3, delay = 2000) {
  console.log(`🔌 Testing AWS RDS connection (attempt ${4 - retries}/3)...`);
  
  pool.query('SELECT NOW(), version()', (err, res) => {
    if (err) {
      console.error('❌ Error connecting to Supabase:', err.message);
      console.error('Error code:', err.code);
      
      if (retries > 1) {
        console.log(`⏳ Retrying in ${delay/1000} seconds...`);
        setTimeout(() => testDatabaseConnection(retries - 1, delay), delay);
      } else {
        console.error('❌ Failed to connect to Supabase after 3 attempts');
        console.log('🔧 Please check your Supabase instance status and connection pooler configuration');
      }
    } else {
      console.log('✅ Connected to Supabase successfully!');
      console.log('   Server time:', res.rows[0].now);
      console.log('   PostgreSQL version:', res.rows[0].version);
    }
  });
}

// Automated session cleanup function
async function runSessionCleanup() {
  try {
    console.log('🧹 Running automated session cleanup...');
    await sessionService.cleanupExpiredSessions();
    console.log('✅ Session cleanup completed successfully');
  } catch (error) {
    console.error('❌ Session cleanup error:', error);
  }
}

// Schedule session cleanup to run every hour
function scheduleSessionCleanup() {
  const ONE_HOUR = 8 * 60 * 60 * 1000; // 1 hour in milliseconds
  
  // Run cleanup immediately on startup
  runSessionCleanup();
  
  // Then schedule it to run every hour
  setInterval(runSessionCleanup, ONE_HOUR);
  
  console.log('⏰ Session cleanup scheduled to run every hour');
}

// Start the server first, then test database connection
app.use(cors(corsOptions));
app.use(express.json());
app.use('/api/:client', clientRouter);
app.use('/api/session', sessionRouter);

// Test route
app.get('/', (req, res) => {
  res.send('Express server is running and connected to AWS RDS!');
});

app.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
  console.log('🔌 Testing database connection...');
  
  // Test database connection after server starts
  setTimeout(() => {
    testDatabaseConnection();
  }, 1000);

  // Schedule session cleanup
  scheduleSessionCleanup();
}); 
