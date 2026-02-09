// Use Supabase for database configuration
const databaseConfig = {
  host: process.env.SUPABASE_DB_HOST,
  port: parseInt(process.env.SUPABASE_DB_PORT || '5432'),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,

  ssl: {
    rejectUnauthorized: false, // required for both Supabase and AWS RDS
  },

  max: 20, // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

module.exports = databaseConfig;
