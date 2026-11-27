# Demo video script (1:55)

Target: under 2:00. Screen recording of the live app at 1440 × 900, browser
zoom 100 %, with voice-over. Every word below is spoken; actions are in
_italics_. About 140 words per minute.

## Before recording

- [ ] Use the deployed app with `ANTHROPIC_API_KEY` set (the assistant segment needs it).
- [ ] Fresh browser profile or clear site data, so the tour starts and Lena is shown.
- [ ] Rehearse the two assistant questions once, so you know they work. Keep the take where the answer is short.
- [ ] Hide bookmarks bar and notifications. Cursor highlight on.
- [ ] Have Claude Desktop open with the MCP server connected, for the last shot (optional; cut it if not set up).

## Script

### 0:00 – 0:12 · Hook

_Page loads. The tour card appears over Lena's map. Don't click yet._

> Moving to Spain as an EU citizen means a dozen offices, and every one wants
> a document from another. Every bureaucracy is a graph. So we made it one.

### 0:12 – 0:35 · The circle

_Click **Next** is not needed: the tour already shows Circle 1. Point at the
terracotta loop on the map, then at the drawer text._

> This is Lena, a freelance designer from Berlin. She's stuck in a circle. Her
> residence certificate needs her tax registration. The tax registration needs
> her NIE number. And the NIE comes with the certificate. That's not folklore:
> every link here comes from an official page.

_Point at "The documented way out" box._

> The graph also finds the way out the rules themselves allow: the NIE number on
> its own, form EX-15.

### 0:35 – 0:52 · What if

_Click **Next** in the tour (What if… the certificate falls through). The map
lights up six stations in terracotta._

> What if her certificate is refused? One query follows every requirement
> backwards. Six steps are stuck, and each one shows the chain behind it.

### 0:52 – 1:05 · Why can't I, and How we know

_Click **Next** (Why can't I register as self-employed). Then open **How we
know** in the drawer; let the Cypher be visible for two seconds._

> Why can't she register as self-employed? The shortest chain, official rules
> first. And every answer shows how we know: the exact Cypher, run on Relate,
> right here in the browser, plus the official sources.

### 1:05 – 1:40 · The assistant, with and without the graph

_Skip the rest of the tour. Scroll to **Ask in your own words**. Switch on
**Compare side by side**. Click the suggestion "Why can't I register as
self-employed yet?"._

> You can also just ask. Same small Claude model on both sides, same prompt,
> same question. On the right it has the graph.

_Wait for both answers. Point at the left answer, then at the right answer
and its tool calls (whyCant, findCircles), the path and a source link._

> On the left, an answer from memory, with nothing to check it against. On the right, it calls
> fixed graph tools, in your browser, on your own plan. It finds the circle and
> names the way out, with sources. It can't write its own queries, so it can't
> make things up.

_Click the suggestion "How much does the NIE cost?" (compare still on)._

> And when the graph has no answer, it says so.

### 1:40 – 1:55 · Close

_Click **Start fresh** → **Employee**. The map redraws with the employee line.
Then (optional) cut to Claude Desktop answering a question over MCP._

> Start your own plan in one click. It stays in your browser. And the same graph
> runs over MCP with Relate's own server. Paperwork Path: every bureaucracy is a
> graph, and now you can see yours.

_End card, 2 seconds: "Paperwork Path · built on Relate · MIT · github link"._

## If you need to cut time

1. Drop the "How much does the NIE cost?" moment (saves 6 s).
2. Drop the MCP shot (saves 5 s).
3. Shorten "Why can't I" to the How we know panel only (saves 6 s).

Never cut: the circle, What if, the side-by-side.

## Notes

- Don't claim fees, waiting times or deadlines in the voice-over: the app
  deliberately has none.
- Say "Simplified guide, not legal advice" only if there is time; it is on
  screen throughout anyway.
- Lena is fictional; say so if you add any personal detail about her.
