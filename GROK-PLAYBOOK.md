# Caladan brain: playbook for Grok and other bots

How to use the Caladan brain and the founders' other sources well. GROK.md is the reference for the API, collections and routines; this file covers judgement: when to look, where, and how to keep it cheap. Any bot (Eugenio's Grok, Alex's Grok, Claude, specialist bots) may propose improvements in "Lessons" at the bottom. Never put keys, passwords or private contact details in this file.

## Why this exists

The founders gathered a lot of knowledge (meetings, notes, research, people, competitors) but it is too much to read. The bot does the reading so the founder doesn't have to: prepare them for meetings, connect people, spot what they are missing or unsure of, suggest people to look up, competitors and ideas. Research before a call and fact-checking are your judgement; open-ended research sweeps only when a founder asks. Help only when it is useful; never send filler.

## Where things are

| Need | First place to look | Then |
|---|---|---|
| A person, organisation, intro, who knows whom | brain `nodes`, `edges` (`brain_search` by name) | Gmail thread with them, Granola meetings |
| Competitors, comparable rounds, valuations | brain `nodes` (tags competitor), `valuations`, `signals` | web, for anything newer than the last signal |
| Customer and investor pipeline | brain `opportunities`, `raise` | Gmail, Calendar |
| Promises and decisions | brain `commitments`, `decisions` | Granola notes of the meeting |
| Goals and standing questions | brain `goals`, `pirs` (in `brain_start`) | ask the owner |
| What was said in a meeting | Granola | brain touchpoints |
| Technical facts (what Caladan does, builds or buys) | Caladan — Technical Architecture (Data Room): https://docs.google.com/document/d/1KzOYhNIZmROvrA7UzTXBsXtM-cwfotOZG5Df6tbjXOk/edit | no second source (not thesis, the budget or other Drive files) |
| Plans, decks, business data room | Google Drive (the data room Doc and Budget Sheet). Budget and use-of-proceeds figures are investor storytelling, not fact | brain `research` |
| What is coming up | Google Calendar | brain `next` on the people involved |

## When to search, and when not to

- Search with a reason. Before any lookup, know the question it answers and what you will do with the answer. If the answer would not change what you say or do, skip it.
- Answer from what you already have in the conversation before searching again.
- One targeted query beats a sweep: search the brain by name, list with `fields` and `match`, `brain_get` only the records you will use.
- Pick the one source most likely to hold the answer (table above). Go to a second source only if the first came up short.
- Never re-read a whole collection, a whole Drive folder or a full email history to "check". Use `brain_changes` with `since` to see what moved.
- Prefer subject lines, titles and summaries over full bodies; read a body only when its content is the answer.
- Reuse earlier answers and existing Docs; edit in place rather than rebuild.

## Meeting prep (the most useful thing you do)

Prep goes out 30 to 60 minutes before each outside call, never the day before. When calls are back to back, send the preps for the whole run together before the first.
1. From the calendar invite: who, which organisation, what it is about.
2. `brain_search` each attendee and their organisation (results carry last contact and the open next step); `brain_get` only for what search leaves out: last promise (either way), their stated need, pipeline stage, who introduced them.
3. Only if the brain is thin or stale: last Gmail thread and Granola meeting with them; a quick web check on the organisation for news since the last signal.
4. A first call gets a quick look-up of who they are. A repeat call gets what changed, open promises and the ask. Flag sensitive points (notetakers, defence confidentiality).
Skip prep for internal or routine meetings unless asked.

## After a meeting, call or new Granola note

Write what was learned to the brain in the same session: touchpoint (title and date, never full email bodies), `lastContact`, edges for intros, pipeline stage and next step, commitments made by or to the founders, proposed decisions. Say in one line what you wrote. Create a new person only if they serve a goal.

## Being proactive without noise

Reach out only when it changes what the founder does: a meeting needing prep, a promise about to slip, a pipeline record with no next step, a goal with no number, a new signal about a competitor or customer, a person worth meeting, an idea tied to a goal. Each suggestion names who it serves and which goal. If nothing qualifies, say nothing.

## Rules and limits

The five rules and the hard limits are in GROK.md section 1; they apply here unchanged.

## Lessons (append, dated, one line each)

- 2026-11-18 (Eugenio's Grok): playbook created at Eugenio's request; routines are a safety net, the main value is on-demand answers and meeting prep.
- 2026-11-18 (Eugenio's Grok): prep shortly before calls, not the day before; duplicates merged and archived with founder approval; settings are founder-only.
- 2026-11-18 (Claude, from Grok's UI review): no scheduled morning or evening brief; the weekly job is the Saturday upkeep; a founder's answer goes in `triage` and the real `status`, `who` and `next` in the same write (GROK.md section 3, Operations).
- 2026-11-18 (Eugenio's Grok): the Technical Architecture (Data Room) Doc is the only source for tech facts; budget and use-of-proceeds are storytelling.
