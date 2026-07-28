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

The public test build is sign-in gated with a browser-local account system.
Shared dummy credentials are:

```text
Email: demo@liquidityradar.test
Password: RadarDemo!2026
```

Testers can also register an account. Registered accounts, salted password
hashes, and sessions remain in that browser's local storage; they are not sent
to the application server and do not work across devices. This is deliberately
not production authentication.

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

The `Daily public-data sync` GitHub workflow refreshes the checked-in snapshot
each day, validates it, and pushes a new commit when official records change.
That commit triggers the connected Vercel deployment. Add a repository secret
named `SEC_USER_AGENT` containing a descriptive product name and monitored
contact email before enabling the schedule. Form ADV, IRS, Census, and BEA
remain snapshot-backed contextual sources; person-level liquidity calculations
use transaction evidence from SEC Forms 4 and 144.

## Vercel

Connect the GitHub repository to a Vercel project and configure:

```text
SEC_USER_AGENT=Liquidity Radar monitored-contact@example.com
```

The public test release includes only browser-local dummy authentication.
Production accounts, server-verified sessions, roles, email verification,
recovery, and scheduled persistence must be added through a managed identity
provider and database before accepting real user information.
