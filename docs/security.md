# Security and threat model

Primary assets are source documents, estimates, user workflows, API keys, privacy materials, and audit records. Threats include cross-workspace access, key disclosure, unsafe uploads, injection, source spoofing, model tampering, log leakage, abusive search, and incomplete suppression.

Controls include server-side authorization boundaries, Zod validation, output encoding, hashed-key schema, rate-limit hooks, audit records, source hashes, publication thresholds, secure hosted bindings, file-type/size expectations, restricted-use acknowledgement, and suppression rules. Production should add managed WAF/rate limiting, malware scanning, SIWC access policy, secret rotation, and security monitoring.

