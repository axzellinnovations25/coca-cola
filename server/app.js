require('dotenv').config();

const dns = require('dns');
const express = require('express');
const cors = require('cors');
const clientRouter = require('./src/routes/client');
const sessionRouter = require('./src/routes/session');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();

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
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/api/:client', clientRouter);
app.use('/api/session', sessionRouter);

app.get('/', (req, res) => {
  res.send('Express server is running and connected to AWS RDS!');
});

module.exports = app;
