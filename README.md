# checkout-api

A minimal Node.js service that simulates a high-traffic e-commerce checkout endpoint, designed to be used as the **target application** for [CoralOps](https://github.com/Rituraj-07/CoralOps) demos and integration testing.

This service does two real things:

1. **Reads a LaunchDarkly feature flag** (`checkout-v2-enabled`) every 2 seconds to route users between the v1 and v2 checkout code paths.
2. **Reports real crashes to Sentry** when the v2 code path throws an unhandled exception.

It is intentionally kept minimal — the point is not the checkout logic itself, but what happens downstream in CoralOps when this app starts crashing.

---

## How it fits into CoralOps

```
checkout-api (this repo)
       │
       ├── reads  ──▶ LaunchDarkly (flag: checkout-v2-enabled)
       └── fires  ──▶ Sentry (real crash exceptions)
                           │
                           ▼
                     CoralOps backend
                (Coral SQL JOIN across GitHub +
                 PagerDuty + Sentry + LaunchDarkly
                 + Statuspage in one query)
                           │
                           ▼
                  Risk score · AI summary
                  Slack alert · Flag rollback
```

When this service starts crashing, CoralOps detects the Sentry error spike, correlates it with any recently merged GitHub PR, checks for active PagerDuty incidents, and issues a risk verdict — all from a single Coral SQL JOIN.

---

## Prerequisites

- Node.js v20+
- A [LaunchDarkly](https://launchdarkly.com) account with a boolean flag named `checkout-v2-enabled`
- A [Sentry](https://sentry.io) project named `checkout-api` (Node.js platform)

---

## Setup

```bash
git clone https://github.com/<your-username>/checkout-api.git
cd checkout-api

npm install

cp .env.example .env
```

Edit `.env` with your credentials:

```env
LAUNCHDARKLY_SDK_KEY=sdk-...   # Server-side SDK key from LaunchDarkly
SENTRY_DSN=https://...         # DSN from your checkout-api Sentry project
```

---

## Running

```bash
node index.js
```

While the `checkout-v2-enabled` flag is **OFF**, the app runs cleanly:

```
⏳ Connecting to LaunchDarkly...
✅ Connected to LaunchDarkly! Server is running and handling traffic...

✅ [Routing] user_231 sent to v1 Checkout. Transaction successful.
✅ [Routing] user_847 sent to v1 Checkout. Transaction successful.
```

When the flag is turned **ON** in LaunchDarkly (with the buggy v2 code committed), the app crashes on every request and fires real exceptions to Sentry:

```
🛑 [Routing] user_456 sent to v2 Checkout...
💥 CRASH DETECTED: Cannot read properties of undefined (reading 'connect')
   -> Real error payload dispatched to Sentry API.
```

---

## Triggering the CoralOps BLOCK verdict

To produce a full **BLOCK** verdict in CoralOps with all signals firing:

1. **GitHub signal** — Create a branch, introduce the bug in `checkout.js` (uncomment the `dbConnection.connect()` line), add 200+ lines to inflate the diff, then open and merge a Pull Request.
2. **Sentry signal** — Turn the `checkout-v2-enabled` flag ON in LaunchDarkly and run this app. Fatal crashes will appear in your Sentry project within seconds.
3. **PagerDuty signal** — The Sentry→PagerDuty integration auto-fires a high-urgency incident after ~3+ crashes, or create one manually titled `High CPU Usage in checkout-api`.

Then in CoralOps, run an evaluation with:
- **Flag Key:** `checkout-v2-enabled`
- **Service Key:** `checkout-api`

CoralOps executes a single Coral SQL JOIN across all five platforms and returns a BLOCK verdict with a full evidence breakdown and AI-generated summary.

---

## The bug

The v2 checkout code path contains a deliberately broken DB connection:

```js
// checkout.js — v2Checkout()
const dbConnection = undefined;
dbConnection.connect(); // ← TypeError: Cannot read properties of undefined
```

This is commented out in the repository (the safe version is pushed to `main`). During a demo, you introduce this bug in a feature branch PR to give CoralOps a real GitHub signal to detect.

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `LAUNCHDARKLY_SDK_KEY` | Server-side SDK key (starts with `sdk-`). Found in LaunchDarkly → Account Settings → Projects → SDK keys. |
| `SENTRY_DSN` | Full DSN URL for your `checkout-api` Sentry project. Found in Sentry → Project Settings → Client Keys. |

---

## Part of CoralOps

This repository is the **target service** companion to [CoralOps](https://github.com/Rituraj-07/CoralOps) — an autonomous release intelligence platform that catches bad feature flag rollouts before they reach users.
