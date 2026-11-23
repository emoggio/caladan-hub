# Caladan hub: control room

A web page for the two founders, mostly for looking (the few changes it allows are listed in GROK.md section 6),, over the Caladan brain (a Supabase database; no data lives in this repository).

Bots and other AIs read two files, both once per session:
- **[GROK.md](GROK.md)**: the reference. How to reach the brain, the data model, what to do on each trigger, the health check, and which fields each chart on the page reads.
- **[GROK-PLAYBOOK.md](GROK-PLAYBOOK.md)**: judgement. When and where to look, meeting prep, staying quiet unless it helps, and dated lessons any bot may append.

Page code: `index.html`, `js/` (one file per panel; `charts.js` draws the charts, `map3d.js` the 3D map), `css/`.

When you change any file in `js/` or `css/`, raise the `?v=` number on every link in `index.html` (one find-and-replace), so browsers fetch the new files instead of mixing old and new.

## Keeping it right (so no clean-up pass is ever needed)

Every change ends with the docs and the page agreeing. Check these before each commit:

1. **One home per fact.** GROK.md holds facts (API, fields, status words, routines, what each panel reads). GROK-PLAYBOOK.md holds judgement and dated lessons. This README holds how the page is built. If something belongs in another file, link to it; never copy it, because copies drift apart.
2. **Code and doc change together.** If a change alters which fields a panel reads, a status word, a panel or tab name, or what the map shows, update GROK.md section 6 (or section 3) in the same commit. A status word or field Grok writes is never added in one place only. The rules for what needs doing live twice, on purpose: in the page (`js/backlog.js`, `confirm.js`, `pipes.js`, `goals.js`, `systems.js`) and in the database function `brain_todo` (`../supabase/patch-3.sql`), so Grok gets them in one call. Change one, change the other, and rerun `../supabase/test/` to compare them.
3. **Never two versions of a doc.** When a doc stops being true, move it to `../archive/` with a first line saying what replaced it, and add a row to `../archive/README.md`. Do not leave it beside the current ones, and do not delete it.
4. **Lessons graduate.** A playbook lesson that has become a rule moves into the right section of GROK.md or the playbook, and its lesson line says "moved to …". Keep GROK.md under about 200 lines and the playbook under about 80: bots read both every session, and every line costs tokens.
5. **Design tokens keep their meaning.** Colours live as tokens in `css/base.css`. Before changing what a token looks like, search where it is used (`grep -rn -- "--name" css js`). Data and links use the blue `--s1`, founders `--eug` and `--alex`, and status `--good`, `--warn` and `--bad`. Never reuse a token for something else: add a new one.
6. **Check the real thing.** Open the page with live-shaped data at desktop and phone sizes, in light and dark, and open the 2D and 3D map. The console must show no errors. Then raise `?v=` (above).
7. **Design follows the design rules below.** Any change to how the page looks or moves (HTML, CSS, JS that draws) is checked against "Design rules" before it is committed, by people and by any AI assistant editing this repository.
8. **Grok reports drift; people fix it.** Grok cannot edit this repository. When a founder or Grok finds GROK.md saying something the brain or page does not do, the fix is a change to this repository, made with rules 1 to 7.

## Design rules (keep the page consistent as it grows)

Every visual change follows these, so the page never needs a redesign pass. When a rule and a request disagree, the founder decides and this section is updated in the same commit.

**References, and what each one is for.** Check the relevant one before designing a new piece:
- [Unslop](https://github.com/heydamir/unslop) (CC BY 4.0, by @heydamir): the rulebook for look and feel. Audit new UI against its signs list (`skills/unslop/references/signs.md`) and its numbers (`references/tokens.md`).
- [bklit.com](https://bklit.com) and [kokonutui.com](https://kokonutui.com): how charts, KPI tiles and cards should look (calm grids, rounded bar ends, tabular figures, number + change + comparison, legend-as-list, status day-strips). They are React libraries: copy the pattern in plain SVG/CSS, never add React.
- [motion.dev](https://motion.dev) and [animejs.com](https://animejs.com): which motion patterns are worth having. Plain CSS and the browser's `el.animate()` come first; add a library only if a pattern cannot be done in a few lines, pinned to an exact version.

**Fixed by the founders (Unslop does not override these):**
- Colours stay bright and vivid in both themes (dark mode is never duller than light). Founder colours `--eug` gold and `--alex` violet mean whose relationship it is.
- The brand gradient belongs to the mark, the master status strip and things that are Caladan itself (our ask, the best route). Never on ordinary buttons or controls.

**Look:**
- Colour only where it means something: data, a founder, or a status. Status colours (`--good`, `--warn`, `--bad`) appear only when a threshold is really crossed, always with a word or a shape too, never colour alone, and are never reused as a chart series.
- No new hue-to-hue gradients, glows, coloured shadows, emoji, or decorative visuals. Depth comes from surface steps and hairlines.
- Type: use the size tokens in `css/base.css`, weights 400 to 600, sentence case (the map's territory names are the one uppercase exception), tabular figures on every number.
- Spacing on the 4px scale (`--sp-*`); equal things get equal padding. Radius by size: tags 6, controls and tiles 10, cards 16, sheets 20; bars and dots fully round.
- Charts: muted solid grid, one leading colour, values readable without hovering, a tooltip on hover. Pick the form by the data's job: trend = line, comparison = bars, share = one segmented bar, goal = progress bar with a target or pace mark. Show a change only against a stated comparison ("vs last week"), and only when the data really has the history.

**Motion:**
- One easing (`--ease`) and three durations: about 150ms for hover and press, about 220ms for small things appearing or leaving, about 420ms for sheets and values changing. Animate only `transform` and `opacity`, never width, height or position.
- `H.render()` rebuilds the page on every refresh, so never put an entrance animation on panels, rows or charts: it would replay every minute. Motion explains a change (a number or bar that moved, a sheet opening or closing, the map moving to a new view) and is skipped under `prefers-reduced-motion`.
- No loops, except a live status dot and the loading shimmer.

**Before committing a visual change:** compare it with the references above, then do rule 6 (light and dark, desktop and phone, no console errors).
