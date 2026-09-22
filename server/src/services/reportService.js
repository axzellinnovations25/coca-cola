const pool = require('../db');
const { ORDER_FINANCIALS_CTES } = require('./financialService');

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

async function getRepwiseOutstandingBills() {
  const result = await pool.query(`
    WITH ${ORDER_FINANCIALS_CTES}
    SELECT
      u.id AS rep_id,
      u.first_name AS rep_first_name,
      u.last_name AS rep_last_name,
      u.email AS rep_email,
      s.id AS shop_id,
      s.name AS shop_name,
      o.id AS order_id,
      o.created_at AS bill_date,
      CASE
        WHEN o.request_fingerprint LIKE 'legacy:%'
          THEN NULLIF(SUBSTRING(o.request_fingerprint FROM 8), '')
        ELSE NULL
      END AS invoice_number,
      of.gross_total,
      of.collected,
      of.outstanding
    FROM users u
    JOIN shops s ON s.sales_rep_id = u.id
    JOIN orders o ON o.shop_id = s.id
    JOIN order_financials of ON of.order_id = o.id
    WHERE u.role = 'representative'
      AND o.status = 'approved'
      AND of.outstanding > 0
    ORDER BY u.first_name, u.last_name, s.name, o.created_at, o.id
  `);

  const reps = new Map();
  for (const row of result.rows) {
    if (!reps.has(row.rep_id)) {
      reps.set(row.rep_id, {
        rep_id: row.rep_id,
        rep_name: `${row.rep_first_name || ''} ${row.rep_last_name || ''}`.trim() || 'Unknown Representative',
        rep_email: row.rep_email || '',
        shops: new Map(),
      });
    }
    const rep = reps.get(row.rep_id);
    if (!rep.shops.has(row.shop_id)) {
      rep.shops.set(row.shop_id, {
        shop_id: row.shop_id,
        shop_name: row.shop_name || 'Unnamed Shop',
        bills: [],
      });
    }
    rep.shops.get(row.shop_id).bills.push({
      order_id: row.order_id,
      invoice_number: row.invoice_number || row.order_id,
      bill_date: row.bill_date,
      total: Number(row.gross_total || 0),
      paid: Number(row.collected || 0),
      outstanding: Number(row.outstanding || 0),
    });
  }

  return Array.from(reps.values()).map(rep => ({
    ...rep,
    shops: Array.from(rep.shops.values()),
  }));
}

module.exports = {
  getRepwiseShopLimits,
  getRepwiseOutstandingBills,
};
