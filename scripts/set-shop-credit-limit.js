const path = require('path');

require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const pool = require('../server/src/db');

const SHOP_NAME = process.argv[2];
const LIMIT = Number(process.argv[3]);

function normalize(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  if (!SHOP_NAME || !Number.isFinite(LIMIT) || LIMIT <= 0) {
    throw new Error('Usage: node scripts/set-shop-credit-limit.js "SHOP NAME" 100000');
  }

  const shopsRes = await pool.query(
    `SELECT id, name, max_bill_amount, max_active_bills
     FROM shops
     WHERE replace(upper(name), 'FRUITS', 'FRUIT') = replace(upper($1), 'FRUITS', 'FRUIT')
        OR regexp_replace(upper(name), '[^A-Z0-9]+', ' ', 'g') = regexp_replace(upper($1), '[^A-Z0-9]+', ' ', 'g')
     ORDER BY name`,
    [SHOP_NAME]
  );

  const exactMatches = shopsRes.rows.filter(shop => normalize(shop.name).replace(/\bFRUITS\b/g, 'FRUIT') === normalize(SHOP_NAME).replace(/\bFRUITS\b/g, 'FRUIT'));
  if (exactMatches.length !== 1) {
    console.log(JSON.stringify({ requested: SHOP_NAME, matches: shopsRes.rows }, null, 2));
    throw new Error(`Expected exactly one matching shop, found ${exactMatches.length}`);
  }

  const shop = exactMatches[0];
  const updated = await pool.query(
    'UPDATE shops SET max_bill_amount = $1, updated_at = now() WHERE id = $2 RETURNING id, name, max_bill_amount, max_active_bills',
    [LIMIT, shop.id]
  );

  console.log(JSON.stringify({
    before: shop,
    after: updated.rows[0],
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error && (error.stack || error.message || String(error)));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
