const path = require('path');

require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const pool = require('../server/src/db');

async function main() {
  const [users, shops, products] = await Promise.all([
    pool.query("SELECT id, first_name, last_name, email, role FROM users WHERE role IN ('representative', 'admin', 'superadmin') ORDER BY role, first_name, last_name"),
    pool.query('SELECT id, name FROM shops ORDER BY name'),
    pool.query('SELECT id, name, stock, reserved_stock FROM products ORDER BY name'),
  ]);
  console.log('USERS');
  for (const row of users.rows) console.log(`${row.role}: ${row.first_name || ''} ${row.last_name || ''} <${row.email}> ${row.id}`);
  console.log('\nSHOPS');
  for (const row of shops.rows) console.log(row.name);
  console.log('\nPRODUCTS');
  for (const row of products.rows) console.log(`${row.name} | stock=${row.stock} reserved=${row.reserved_stock}`);
}

main()
  .catch(error => {
    console.error(error && (error.stack || error.message || String(error)));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
