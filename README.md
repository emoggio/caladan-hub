# Caladan hub: control room

A read-only web page for the two founders, over the Caladan brain (a Supabase database; no data lives in this repository).

Bots and other AIs read two files, both once per session:
- **[GROK.md](GROK.md)**: the reference. How to reach the brain, the data model, what to do on each trigger, the health check, and which fields each chart on the page reads.
- **[GROK-PLAYBOOK.md](GROK-PLAYBOOK.md)**: judgement. When and where to look, meeting prep, staying quiet unless it helps, and dated lessons any bot may append.

Page code: `index.html`, `js/` (one file per panel; `charts.js` draws the charts, `map3d.js` the 3D map), `css/`.

When you change any file in `js/` or `css/`, raise the `?v=` number on every link in `index.html` (one find-and-replace), so browsers fetch the new files instead of mixing old and new.

## Keeping it right (so no clean-up pass is ever needed)

Every change ends with the docs and the page agreeing. Check these before each commit:

1. **One home per fact.** GROK.md holds facts (API, fields, status words, routines, what each panel reads). GROK-PLAYBOOK.md holds judgement and dated lessons. This README holds how the page is built. If something belongs in another file, link to it; never copy it, because copies drift apart.
2. **Code and doc change together.** If a change alters which fields a panel reads, a status word, a panel or tab name, or what the map shows, update GROK.md section 6 (or section 3) in the same commit. A status word or field Grok writes is never added in one place only.
3. **Never two versions of a doc.** When a doc stops being true, move it to `../archive/` with a first line saying what replaced it, and add a row to `../archive/README.md`. Do not leave it beside the current ones, and do not delete it.
4. **Lessons graduate.** A playbook lesson that has become a rule moves into the right section of GROK.md or the playbook, and its lesson line says "moved to …". Keep GROK.md under about 200 lines and the playbook under about 80: bots read both every session, and every line costs tokens.
5. **Design tokens keep their meaning.** Colours live as tokens in `css/base.css`. Before changing what a token looks like, search where it is used (`grep -rn -- "--name" css js`). Data and links use the blue `--s1`, founders `--eug` and `--alex`, and status `--good`, `--warn` and `--bad`. Never reuse a token for something else: add a new one.
6. **Check the real thing.** Open the page with live-shaped data at desktop and phone sizes, in light and dark, and open the 2D and 3D map. The console must show no errors. Then raise `?v=` (above).
7. **Grok reports drift; people fix it.** Grok cannot edit this repository. When a founder or Grok finds GROK.md saying something the brain or page does not do, the fix is a change to this repository, made with rules 1 to 6.
