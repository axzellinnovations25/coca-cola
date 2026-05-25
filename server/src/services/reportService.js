const pool = require('../db');

async function getRepwiseShopLimits() {
  const result = await pool.query(`
    SELECT
      u.id as rep_id,
      u.first_name as rep_first_name,
      u.last_name as rep_last_name,
      u.email as rep_email,
      s.id as shop_id,
      s.name as shop_name,
      s.max_bill_amount,
      s.max_active_bills
    FROM users u
    LEFT JOIN shops s ON s.sales_rep_id = u.id
    WHERE u.role = 'representative'
    ORDER BY u.first_name ASC, u.last_name ASC, s.name ASC
  `);

  const repMap = new Map();

  for (const row of result.rows) {
    const repId = row.rep_id;
    if (!repMap.has(repId)) {
      repMap.set(repId, {
        rep_id: repId,
        rep_first_name: row.rep_first_name,
        rep_last_name: row.rep_last_name,
        rep_email: row.rep_email,
        shops: [],
      });
    }

    if (row.shop_id) {
      repMap.get(repId).shops.push({
        shop_id: row.shop_id,
        shop_name: row.shop_name,
        max_bill_amount: row.max_bill_amount == null ? null : Number(row.max_bill_amount),
        max_active_bills: row.max_active_bills == null ? null : Number(row.max_active_bills),
      });
    }
  }

  return Array.from(repMap.values());
}

module.exports = {
  getRepwiseShopLimits,
};

