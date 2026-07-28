# Deployment

The test deployment target is Vercel using the native Next.js build:

```bash
npm run build
```

Vercel should detect Next.js and publish the generated `.next` output. Pin the
project to Node.js 22 and configure a descriptive `SEC_USER_AGENT` containing a
monitored contact address.

GitHub is the source of truth for deployments. Commits to `main` create
production deployments; non-production branches can be used for Vercel preview
links.

The previous Cloudflare-compatible build remains available as
`npm run build:sites`, but Cloudflare D1/R2 workspace routes are not exposed by
the real-record-only Vercel surface.
