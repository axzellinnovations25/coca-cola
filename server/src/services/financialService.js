const ORDER_FINANCIALS_CTES = `
  payment_totals AS (
    SELECT order_id, COALESCE(SUM(amount::numeric), 0) AS collected
    FROM payments
    GROUP BY order_id
  ),
  out_of_date_credit_totals AS (
    SELECT od.order_id, COALESCE(SUM(odi.line_total::numeric), 0) * 0.4 AS credit
    FROM out_of_date od
    JOIN out_of_date_items odi ON odi.out_of_date_id = od.id
    GROUP BY od.order_id
  ),
  return_credit_totals AS (
    SELECT order_id, COALESCE(SUM(amount::numeric), 0) AS credit
    FROM credit_notes
    WHERE status = 'approved'
    GROUP BY order_id
  ),
  customer_credit_resolution_totals AS (
    SELECT order_id, COALESCE(SUM(amount::numeric), 0) AS resolved
    FROM customer_credit_resolutions
    GROUP BY order_id
  ),
  order_financials AS (
    SELECT
      o.id AS order_id,
      o.shop_id,
      o.sales_rep_id,
      o.status,
      o.total::numeric AS gross_total,
      COALESCE(pt.collected, 0) AS collected,
      COALESCE(odct.credit, 0) AS out_of_date_credit,
      COALESCE(rct.credit, 0) AS return_credit,
      COALESCE(odct.credit, 0) + COALESCE(rct.credit, 0) AS approved_credit,
      GREATEST(o.total::numeric - COALESCE(odct.credit, 0) - COALESCE(rct.credit, 0), 0) AS net_collectible,
      GREATEST(o.total::numeric - COALESCE(odct.credit, 0) - COALESCE(rct.credit, 0) - COALESCE(pt.collected, 0), 0) AS outstanding,
      GREATEST(COALESCE(pt.collected, 0) - GREATEST(o.total::numeric - COALESCE(odct.credit, 0) - COALESCE(rct.credit, 0), 0), 0) AS gross_customer_credit,
      COALESCE(ccrt.resolved, 0) AS resolved_customer_credit,
      GREATEST(
        COALESCE(pt.collected, 0)
          - GREATEST(o.total::numeric - COALESCE(odct.credit, 0) - COALESCE(rct.credit, 0), 0)
          - COALESCE(ccrt.resolved, 0),
        0
      ) AS customer_credit
    FROM orders o
    LEFT JOIN payment_totals pt ON pt.order_id = o.id
    LEFT JOIN out_of_date_credit_totals odct ON odct.order_id = o.id
    LEFT JOIN return_credit_totals rct ON rct.order_id = o.id
    LEFT JOIN customer_credit_resolution_totals ccrt ON ccrt.order_id = o.id
  )`;

async function getOrderFinancials(orderId, executor) {
  const result = await executor.query(`
    WITH ${ORDER_FINANCIALS_CTES}
    SELECT * FROM order_financials WHERE order_id = $1
  `, [orderId]);
  return result.rows[0] || null;
}

async function getShopCreditSummary(shopId, executor, excludedPendingOrderId = null) {
  const result = await executor.query(`
    WITH ${ORDER_FINANCIALS_CTES}
    SELECT
      s.max_bill_amount::numeric AS credit_limit,
      s.max_active_bills,
      COALESCE(SUM(of.outstanding) FILTER (WHERE of.status = 'approved'), 0) AS collectible_outstanding,
      COALESCE(SUM(of.gross_total) FILTER (
        WHERE of.status = 'pending' AND ($2::text IS NULL OR of.order_id <> $2::text)
      ), 0) AS pending_order_value,
      COUNT(*) FILTER (
        WHERE (of.status = 'approved' AND of.outstanding > 0)
           OR (of.status = 'pending' AND ($2::text IS NULL OR of.order_id <> $2::text))
      ) AS active_bills
    FROM shops s
    LEFT JOIN order_financials of ON of.shop_id = s.id
    WHERE s.id = $1
    GROUP BY s.id, s.max_bill_amount, s.max_active_bills
  `, [shopId, excludedPendingOrderId]);

  if (!result.rows.length) return null;
  const row = result.rows[0];
  const collectibleOutstanding = Number(row.collectible_outstanding || 0);
  const pendingOrderValue = Number(row.pending_order_value || 0);
  const creditLimit = Number(row.credit_limit || 0);
  const creditUsed = collectibleOutstanding + pendingOrderValue;
  return {
    credit_limit: creditLimit,
    max_active_bills: Number(row.max_active_bills || 0),
    collectible_outstanding: collectibleOutstanding,
    pending_order_value: pendingOrderValue,
    credit_used: creditUsed,
    available_credit: Math.max(creditLimit - creditUsed, 0),
    active_bills: Number(row.active_bills || 0),
  };
}

module.exports = {
  ORDER_FINANCIALS_CTES,
  getOrderFinancials,
  getShopCreditSummary,
};
