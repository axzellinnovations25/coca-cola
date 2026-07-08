# admin-rep-daily-summary

Edge Function for an external admin app: daily sales (approved orders) and
daily collections (payments) per sales representative, filterable by date
range and optionally by rep.

## Deploy

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set ADMIN_REPORT_API_KEY=<generate-a-long-random-value>
supabase functions deploy admin-rep-daily-summary
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
the Supabase runtime — no need to set them yourself.

## Call it

```bash
curl "https://<project-ref>.supabase.co/functions/v1/admin-rep-daily-summary?start_date=2026-07-01&end_date=2026-07-07" \
  -H "x-admin-api-key: <the ADMIN_REPORT_API_KEY value>"
```

Optional query param: `sales_rep_id=<uuid>` to restrict to one rep.

## Response shape

```json
{
  "start_date": "2026-07-01",
  "end_date": "2026-07-07",
  "sales_rep_id": null,
  "reps": [{ "rep_id": "...", "rep_name": "...", "rep_email": "..." }],
  "rows": [
    {
      "rep_id": "...",
      "date": "2026-07-01",
      "orders_count": 3,
      "sales_total": 15000,
      "collections_count": 2,
      "collections_total": 9000,
      "rep_name": "...",
      "rep_email": "..."
    }
  ],
  "totals": {
    "orders_count": 3,
    "sales_total": 15000,
    "collections_count": 2,
    "collections_total": 9000
  }
}
```

`rows` only contains rep/date combinations with at least one order or
payment (sparse, not zero-filled for every rep × every day in range).

Notes:
- "Sales" = orders with `status = 'approved'` (matches the existing admin
  dashboard's revenue definition in `server/src/services/productService.js`).
- "Collections" = rows in `payments`.
- Date range is capped at 366 days per request.
- Auth is a static `x-admin-api-key` header check, independent of the main
  app's JWT auth — this function is meant to be called directly by the
  separate admin app, not proxied through the Express server.
