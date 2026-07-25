# Deployment

The primary deployment target is OpenAI Sites with Cloudflare Workers-compatible ESM, D1, and R2. Production values are managed through Sites rather than committed environment files. The source build is `npm run build`; the worker entry is `worker/index.ts`.

For other container platforms, use Node 22+, run migrations before traffic, keep web and long-running worker processes separate, inject secrets, enforce production checks, and provide durable SQL and object storage. The current repository does not include a PostgreSQL compatibility layer.

