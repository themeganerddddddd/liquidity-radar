# Liquidity Radar

Liquidity Radar is a real-public-record explorer for state economic and capital
signals. The public application displays attributable records from:

- SEC EDGAR current filings
- SEC Form ADV registered-adviser data
- IRS Form 990-PF filing indexes
- Census Business Formation Statistics
- BEA Regional Accounts

The deployed surface intentionally excludes fictional people, modeled
liquidity events, inferred bank balances, and unsupported personal-liquidity
estimates.

## Local development

Requires Node.js 22.

```bash
npm install
npm run dev:vercel
```

Open `http://localhost:3000`.

## Validation

```bash
npm run validate
npm run test:e2e
```

`npm run build` creates the native Next.js `.next` output expected by Vercel.
The legacy OpenAI Sites target remains available through
`npm run build:sites`.

## Public data

The checked-in verified snapshot is
`public/data/public-signals.json`. Refresh it from official publishers with:

```bash
SEC_USER_AGENT="Liquidity Radar monitored-contact@example.com" npm run data:sync-public
```

The public `/api/public-data` route refreshes current SEC filing metadata at
request time when `SEC_USER_AGENT` is configured and falls back to the verified
snapshot when the live feed is unavailable.

The larger Form ADV, IRS, Census, and BEA files are snapshot-backed in the test
release. Persistent scheduled updates require the planned production database
integration; a serverless function cannot permanently rewrite a bundled JSON
file.

## Vercel

Connect the GitHub repository to a Vercel project and configure:

```text
SEC_USER_AGENT=Liquidity Radar monitored-contact@example.com
```

No customer authentication is enabled in the public test release. Production
accounts, sessions, roles, and scheduled persistence should be added through a
managed identity provider and database before accepting user information.
