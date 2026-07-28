# Known limitations

- Live SEC metadata refresh requires a compliant `SEC_USER_AGENT`; the product
  falls back to the checked-in verified snapshot when it is absent or the SEC
  feed is unavailable.
- Form ADV, IRS, Census, and BEA records in the test release are verified
  snapshots and provide context rather than person-level liquidity estimates.
- SEC-reported completed sales can establish reported gross proceeds, but no
  public filing proves a person's current bank balance, tax liability, private
  spending, or total deployable wealth.
- Form 144 proposed sales remain proposals and contribute nothing to completed
  proceeds unless a later filing reports a completed transaction.
- Adviser regulatory assets are firm-reported institutional measures, not
  personal or household wealth.
- Test registration is device-local. Accounts use salted browser-side hashes,
  have no email verification or password recovery, and do not work across
  devices. Do not reuse a real password or submit private information.
- The daily GitHub workflow refreshes and redeploys the checked-in public-data
  snapshot. Database-backed ingestion history, durable retries, and alerting
  remain future production work.
- Persistent accounts, roles, and account recovery require a managed identity
  integration.
