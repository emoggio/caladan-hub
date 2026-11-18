# Caladan hub: control room

A read-only web page for the two founders, over the Caladan brain (a Supabase database; no data lives in this repository).

Bots and other AIs read two files, both once per session:
- **[GROK.md](GROK.md)**: the reference. How to reach the brain, the data model, what to do on each trigger, the health check, and which fields each chart on the page reads.
- **[GROK-PLAYBOOK.md](GROK-PLAYBOOK.md)**: judgement. When and where to look, meeting prep, staying quiet unless it helps, and dated lessons any bot may append.

Page code: `index.html`, `js/` (one file per panel; `charts.js` draws the charts, `map3d.js` the 3D map), `css/`.

When you change any file in `js/` or `css/`, raise the `?v=` number on every link in `index.html` (one find-and-replace), so browsers fetch the new files instead of mixing old and new.
