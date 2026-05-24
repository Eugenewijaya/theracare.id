# TheraCare API migration to Vercel

This repo is ready to run the API as a dedicated Vercel project while keeping
the existing local/Railway start command available as a fallback.

## Vercel project

- Project name: `theracare-api`
- Repository: `Eugenewijaya/theracare.id`
- Branch: `main`
- Root directory: `apps/server`
- Build command: `npm run build`
- Production API URL: `https://api.theracare.id` or the temporary Vercel URL
- Function region: `sin1` to keep API close to the Neon Southeast Asia region

## Required production environment variables

Use the values currently configured in Railway, but set them in Vercel Project
Settings instead of committing secrets to the repo.

- `DATABASE_URL`: Neon pooled production connection string
- Fallbacks are also supported if Vercel/Neon injects a different key:
  `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, or
  `DATABASE_URL_UNPOOLED`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`: production API origin, for example `https://api.theracare.id`
- `CORS_ORIGIN`: comma-separated dashboard and microapp production origins
- `PORTAL_RESET_PASSWORD`
- `BLOB_READ_WRITE_TOKEN` or one of the supported storage fallback groups
- `EMAIL_ENABLED=false` until email sending is intentionally enabled
- `ADMIN_APP_URL`, `THERAPIST_APP_URL`, `PARENT_APP_URL`

## Cutover checklist

1. Deploy the API project on Vercel with Railway still active.
2. Verify `GET /api/health` on the Vercel API URL.
3. Verify `GET /api/health/db` returns `database: "ok"` before testing login.
4. Set each dashboard project's `VITE_API_URL` to `<api-origin>/api`.
5. Redeploy admin, therapist, parent, and related microapps.
6. Verify login, schedule, reports, leave requests, branding upload, and notifications.
7. Keep Railway available until one normal operating cycle is stable.
