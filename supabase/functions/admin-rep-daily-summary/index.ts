// Supabase Edge Function: admin-rep-daily-summary
//
// Returns daily sales (approved orders) and daily collections (payments) per
// sales representative, for an external admin app. Meant to be called
// directly (not through the Express server).
//
// Auth: static API key via `x-admin-api-key` header, checked against the
// ADMIN_REPORT_API_KEY secret. Set it with:
//   supabase secrets set ADMIN_REPORT_API_KEY=<some-long-random-value>
//
// Request:  GET /admin-rep-daily-summary?start_date=2026-07-01&end_date=2026-07-07&sales_rep_id=<uuid>
//   start_date, end_date: required, YYYY-MM-DD, inclusive. Max 366-day span.
//   sales_rep_id: optional, restrict to a single rep.
//
// Response: { start_date, end_date, sales_rep_id, reps: [...], rows: [...], totals: {...} }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function dateKey(iso: string) {
  return iso.slice(0, 10); // created_at is timestamptz; take the date part in UTC
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const adminApiKey = Deno.env.get("ADMIN_REPORT_API_KEY");
  const providedKey = req.headers.get("x-admin-api-key");
  if (!adminApiKey || providedKey !== adminApiKey) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const startDate = url.searchParams.get("start_date");
  const endDate = url.searchParams.get("end_date");
  const salesRepId = url.searchParams.get("sales_rep_id");

  if (!startDate || !endDate || !DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return jsonResponse({ error: "start_date and end_date are required, in YYYY-MM-DD format" }, 400);
  }
  if (startDate > endDate) {
    return jsonResponse({ error: "start_date must not be after end_date" }, 400);
  }
  const spanDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000;
  if (spanDays > MAX_RANGE_DAYS) {
    return jsonResponse({ error: `date range too large (max ${MAX_RANGE_DAYS} days)` }, 400);
  }

  const rangeStart = `${startDate}T00:00:00.000Z`;
  const rangeEndExclusive = new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() + 86_400_000).toISOString();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let repsQuery = supabase
    .from("users")
    .select("id, first_name, last_name, email")
    .eq("role", "representative");
  if (salesRepId) repsQuery = repsQuery.eq("id", salesRepId);

  let ordersQuery = supabase
    .from("orders")
    .select("sales_rep_id, total, created_at")
    .eq("status", "approved")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEndExclusive);
  if (salesRepId) ordersQuery = ordersQuery.eq("sales_rep_id", salesRepId);

  let paymentsQuery = supabase
    .from("payments")
    .select("sales_rep_id, amount, created_at")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEndExclusive);
  if (salesRepId) paymentsQuery = paymentsQuery.eq("sales_rep_id", salesRepId);

  const [repsRes, ordersRes, paymentsRes] = await Promise.all([repsQuery, ordersQuery, paymentsQuery]);

  if (repsRes.error) return jsonResponse({ error: repsRes.error.message }, 500);
  if (ordersRes.error) return jsonResponse({ error: ordersRes.error.message }, 500);
  if (paymentsRes.error) return jsonResponse({ error: paymentsRes.error.message }, 500);

  const repsById = new Map(
    repsRes.data.map((r) => [
      r.id,
      { rep_id: r.id, rep_name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(), rep_email: r.email },
    ]),
  );

  type RowAgg = {
    rep_id: string;
    date: string;
    orders_count: number;
    sales_total: number;
    collections_count: number;
    collections_total: number;
  };
  const rowsByKey = new Map<string, RowAgg>();

  function getRow(repId: string, date: string): RowAgg {
    const key = `${repId}|${date}`;
    let row = rowsByKey.get(key);
    if (!row) {
      row = { rep_id: repId, date, orders_count: 0, sales_total: 0, collections_count: 0, collections_total: 0 };
      rowsByKey.set(key, row);
    }
    return row;
  }

  for (const o of ordersRes.data) {
    if (!o.sales_rep_id) continue;
    const row = getRow(o.sales_rep_id, dateKey(o.created_at));
    row.orders_count += 1;
    row.sales_total += Number(o.total || 0);
  }
  for (const p of paymentsRes.data) {
    if (!p.sales_rep_id) continue;
    const row = getRow(p.sales_rep_id, dateKey(p.created_at));
    row.collections_count += 1;
    row.collections_total += Number(p.amount || 0);
  }

  const rows = Array.from(rowsByKey.values())
    .map((row) => ({
      ...row,
      rep_name: repsById.get(row.rep_id)?.rep_name ?? null,
      rep_email: repsById.get(row.rep_id)?.rep_email ?? null,
    }))
    .sort((a, b) => (a.date === b.date ? a.rep_id.localeCompare(b.rep_id) : a.date.localeCompare(b.date)));

  const totals = rows.reduce(
    (acc, row) => {
      acc.orders_count += row.orders_count;
      acc.sales_total += row.sales_total;
      acc.collections_count += row.collections_count;
      acc.collections_total += row.collections_total;
      return acc;
    },
    { orders_count: 0, sales_total: 0, collections_count: 0, collections_total: 0 },
  );

  return jsonResponse({
    start_date: startDate,
    end_date: endDate,
    sales_rep_id: salesRepId ?? null,
    reps: Array.from(repsById.values()),
    rows,
    totals,
  });
});
