# Cloudflare Security & Protection Configuration Guide

To ensure maximum protection for **MOUZIKETNA**, prevent unauthorized international scraping, block VPNs/proxies attempting to bypass Tunisia geoblocking, and secure user accounts against credential stuffing and session hijacking, we recommend enabling the following Cloudflare security settings and features.

---

## 1. Geographic & IP Access Rules (Tunisia Geoblock)
- **WAF Country Firewall / Custom Rules**:
  - **Rule**: Allow requests only where `Country equals "Tunisia" (TN)` OR where IP belongs to trusted origin range.
  - **Action**: Block / Challenge (`Managed Challenge` or `JS Challenge`) for all other countries.
- **WAF Threat Intelligence**:
  - Enable **Block known threats** (Cloudflare Threat Score > 0).
  - Enable **Bot Management / Fight Bot Traffic**.

---

## 2. Anti-VPN & Anti-Proxy Shielding
- **Cloudflare ASN & Hosting Provider Filtering**:
  - Block requests originating from known Datacenter / Hosting / VPN / Tor ASN networks (e.g. DigitalOcean, AWS, OVH, Mullvad, NordVPN ASNs) unless explicitly whitelisted for internal maintenance.
- **WAF Expression Filter**:
  - Block requests containing spoofed proxy headers (`X-Forwarded-For`, `Via`, `X-Real-IP`) that do not match Cloudflare's trusted edge proxy hops.

---

## 3. Account Protection & Rate Limiting
- **WAF Rate Limiting Rules**:
  - **Login Route (`/api/login`, `/api/auth/login`)**: Limit to max **15 requests per 60 seconds per IP** to prevent brute-force and credential stuffing attacks.
  - **Playback Lease Claim (`/api/session/claim-playback`)**: Limit to max **120 requests per minute**.
- **Turnstile / Bot Challenge**:
  - Enable Cloudflare Turnstile on login and registration pages to block automated bot logins without annoying CAPTCHAs.

---

## 4. SSL/TLS & Encryption Settings
- **SSL/TLS Encryption Mode**: Set to **Full (Strict)** to ensure end-to-end TLS encryption with valid origin certificates.
- **Always Use HTTPS**: Enabled (forces all HTTP traffic to upgrade securely to HTTPS).
- **Minimum TLS Version**: TLS 1.2 (Recommend TLS 1.3 preferred).
- **HTTP/3 (QUIC)**: Enabled for ultra-fast, encrypted transport protocol performance across mobile and desktop devices.

---

## 5. Web Application Firewall (WAF) Managed Rules
- **Cloudflare Managed Ruleset**: Enabled with default block action.
- **OWASP Core Ruleset**: Enabled with Paranoia Level 1 to neutralize SQL injection, XSS, and remote code execution exploits.
