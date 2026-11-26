# Grok wake

`grok-wake.gs` runs in Eugenio's Google account. Every ten minutes it checks whether to wake Grok's event-driven brain sync and call prep routine. It wakes on three things:

- New weekday mail (inbox or sent, skipping promotions, social, updates, forums, spam and trash). Mail is batched: at most one wake every 30 minutes, and only from 07:00 to 20:00 London time, Monday to Friday.
- An outside meeting (any guest whose address is not `@caladanworlds.com`) starting in 60 to 120 minutes.
- 30 to 60 minutes after an outside meeting ends, so Granola notes can be synced.

The file holds no webhook URL, key or token. Those live only in the Apps Script project's Script Properties.

## Install

1. At [script.google.com](https://script.google.com), create a project bound to the Google account that owns the mail and calendar, and paste in `grok-wake.gs`.
2. Open **Project Settings > Script Properties** and add:
   - `WEBHOOK_URL`: the routine's webhook URL.
   - `AUTH_HEADER`: the routine's authorization header, copied as given.
   - Optional fallback: `WEBHOOK_KEY`, and `KEY_HEADER` when the header is not named `Authorization`.
3. Run `setup()` once. It installs a time trigger that calls `check` every 10 minutes. Approve the Gmail, Calendar and external-request permissions Google asks for.
4. Run `testWake()` once. The execution log should say the test wake was accepted.

Do not commit the webhook URL, key or token. Put them only in Script Properties.
