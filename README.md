# Linkpedia

News aggregator for US, UK, Ireland and Australia.

## Deploy

1. Push this repo to GitHub
2. Import into Vercel
3. Add environment variables in Vercel dashboard:
   - `SUPABASE_URL` = https://piyqmziuyjctisakigeq.supabase.co
   - `SUPABASE_SERVICE_KEY` = your service role key (from Supabase → Settings → API)
   - `CRON_SECRET` = any random string you choose
4. Deploy
5. Test RSS fetch: `curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://linkpedia.com/api/fetch-news`

## Stack
- Frontend: Vanilla HTML/CSS/JS
- Backend: Vercel Serverless Functions
- Database: Supabase (Postgres)
- News: RSS feeds, refreshed every 30 minutes via Vercel Cron
