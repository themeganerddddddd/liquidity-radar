# Known limitations

- Live SEC metadata refresh requires a compliant `SEC_USER_AGENT`; the product
  falls back to the checked-in verified snapshot when it is absent or the SEC
  feed is unavailable.
- Form ADV, IRS, Census, and BEA records in the test release are verified
  snapshots. They do not yet write daily updates to persistent storage.
- Public filing metadata does not prove transaction completion, cash proceeds,
  beneficial ownership, or deployable personal wealth.
- Form 144 reports proposed activity. Form 4 and ownership schedules may
  describe non-cash or non-sale changes.
- Adviser regulatory assets are firm-reported institutional measures, not
  personal or household wealth.
- Customer authentication is not enabled in the public test release. Do not
  submit private or confidential information.
- Persistent accounts, roles, scheduled ingestion, monitoring, and retry
  handling require the planned production database and identity integration.
