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

app.get('/privacy-policy', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RepRoute Privacy Policy</title>
  <style>
    body {
      margin: 0;
      background: #f8fafc;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.6;
    }
    main {
      max-width: 860px;
      margin: 0 auto;
      padding: 40px 20px 56px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 32px;
      line-height: 1.2;
    }
    h2 {
      margin: 32px 0 10px;
      font-size: 20px;
    }
    p, li {
      font-size: 15px;
    }
    ul {
      padding-left: 22px;
    }
    .meta {
      color: #4b5563;
      margin-top: 0;
    }
    .panel {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 22px;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <main>
    <h1>Privacy Policy</h1>
    <p class="meta">Effective date: April 30, 2026</p>

    <div class="panel">
      <p>
        This Privacy Policy applies to RepRoute, a mobile application for sales representatives to manage assigned shops,
        orders, collections, receipts, and related field operations. The app package name is com.thushanth.motionreprep.
      </p>
      <p>
        Developer: Axzell / Thushanth. For privacy questions or deletion requests, use the developer contact email shown
        on the RepRoute Google Play listing or contact the administrator that provided your RepRoute account.
      </p>
    </div>

    <h2>Information We Collect</h2>
    <p>RepRoute may collect, access, or process the following information when you use the app:</p>
    <ul>
      <li>Account information, such as your name, email address, role, and assigned sales representative profile.</li>
      <li>Authentication information, such as access tokens, refresh tokens, and session identifiers used to keep you signed in.</li>
      <li>Business operation data, such as assigned shops, shop names, addresses, phone numbers, orders, products, payments, collections, returns, and receipt details.</li>
      <li>Bluetooth printer information, such as paired printer names and MAC addresses, when you choose to scan for or save a receipt printer.</li>
      <li>Basic device and technical information needed to operate, secure, and troubleshoot the app and backend service.</li>
    </ul>

    <h2>Bluetooth and Location Permission</h2>
    <p>
      RepRoute uses Bluetooth permissions to find paired receipt printers and print order or payment receipts. On some Android
      versions, Android requires location permission before Bluetooth scanning can work. RepRoute uses this permission only to
      discover nearby paired Bluetooth printers. RepRoute does not use this permission to track your physical location.
    </p>

    <h2>How We Use Information</h2>
    <p>We use information to:</p>
    <ul>
      <li>Sign users in and maintain secure sessions.</li>
      <li>Show assigned shops, orders, collections, outstanding balances, and related sales workflow data.</li>
      <li>Create, update, approve, reject, and view orders and payments according to user permissions.</li>
      <li>Print receipts through paired Bluetooth printers.</li>
      <li>Protect the service, prevent unauthorized access, troubleshoot errors, and improve reliability.</li>
    </ul>

    <h2>Sharing of Information</h2>
    <p>
      RepRoute sends app data to the backend service that powers the sales management system. Data may be stored or processed
      by hosting, database, authentication, and infrastructure providers used to operate the service. We do not sell personal
      information. We may disclose information if required by law, to protect the service, or to enforce applicable rights and
      obligations.
    </p>

    <h2>Local Storage</h2>
    <p>
      RepRoute stores session tokens and the selected Bluetooth printer identifier on the device. This storage is used to keep
      you signed in and to remember your chosen printer. You can clear this information by logging out, clearing app storage,
      or uninstalling the app.
    </p>

    <h2>Security</h2>
    <p>
      We use reasonable technical and organizational measures to protect information, including authenticated API requests and
      session management. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.
    </p>

    <h2>Data Retention and Deletion</h2>
    <p>
      Business records are retained for as long as needed to provide the service, support audits, comply with legal obligations,
      resolve disputes, and maintain business records. Account and deletion requests can be submitted through the developer
      contact email shown on the Google Play listing or through your organization administrator.
    </p>

    <h2>Children</h2>
    <p>
      RepRoute is intended for authorized business users and is not directed to children.
    </p>

    <h2>Changes to This Policy</h2>
    <p>
      We may update this Privacy Policy when the app, service, or legal requirements change. Updates will be posted on this page
      with a revised effective date.
    </p>
  </main>
</body>
</html>`);
});

app.get('/', (req, res) => {
  res.send('Express server is running and connected to AWS RDS!');
});

module.exports = app;
