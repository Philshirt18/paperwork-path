# Submission checklist — Relate by Neo4j Hackathon

Deadline: **11 December 2026, 6 PM PST** (12 December, 3 AM CET).
Ticked items are done in the repository. Unticked items need you.

## Code and repository

- [x] MIT license in [LICENSE](../LICENSE), `"license": "MIT"` in package.json
- [x] Relate version pinned exactly (`1.3.0`) and named in the README
- [x] README lists Relate capabilities used, third-party tools, AI tools used
- [x] Relate / Neo4j names used only to identify the database; non-endorsement note in the README
- [x] No secrets: `.env*` ignored by git, `.env.example` committed, no key in the history
      (check: `git log -p | grep -i "sk-ant"` prints nothing)
- [x] No real personal data; Lena is labelled fictional in the app and docs
- [x] Disclaimer in the app: "Simplified guide, not legal advice. Rules vary by province, check the linked source."
- [x] Tests: `npm test` (42), `npm run test:e2e` (6)
- [ ] Optional: put your name in [LICENSE](../LICENSE) instead of "Paperwork Path contributors"
- [ ] Create the public GitHub repository and push:

  ```bash
  gh repo create paperwork-path --public --source=. --push
  ```

- [ ] Add the topics:

  ```bash
  gh repo edit --add-topic relate --add-topic relate-neo4j-hackathon
  ```

## Deploy

- [ ] Import the repository on Vercel (Next.js, default settings)
- [ ] Add environment variables in Vercel: `ANTHROPIC_API_KEY`; optional `AGENT_DAILY_BUDGET_USD`, `AGENT_CALLS_PER_IP`
- [ ] Set a monthly spend limit on that API key in the Anthropic Console (the real hard cap)
- [ ] Open the live site on a phone and a laptop: tour, circles, what if, why can't I, assistant compare
- [ ] Ask "How much does the NIE cost?" on the live site: the graph side should say the graph has no answer

## Video (2 minutes or less)

- [ ] Record from [video-script.md](video-script.md) on the live site
- [ ] Upload (YouTube or Vimeo, public or unlisted)
- [ ] Add `NEXT_PUBLIC_DEMO_VIDEO_URL` in Vercel and redeploy (the assistant's "switched off" and "budget used" messages then link to it)

## Fill in the links

- [ ] README line "Live demo · Video": replace both placeholders with the real links
- [ ] Commit and push

## Before you press submit

- [ ] Work through [manual-check.md](manual-check.md) (3 unverified steps, 3 practice links), or leave them marked as they are
- [ ] Optional: install the Relate CLI and try the MCP setup in [mcp.md](mcp.md); then change its "Status" note
- [ ] Fresh clone works:

  ```bash
  git clone https://github.com/<you>/paperwork-path && cd paperwork-path && npm install && npm test && npm run dev
  ```

- [ ] Submission form: repository URL, live URL, video URL, short description

## Short description (for the form)

> Paperwork Path turns Spanish residence paperwork for EU citizens into a
> graph in Relate, running in the browser. It finds the circles where every step
> waits for another (with the official way out), answers "what if this falls
> through?" and "why can't I?" with one Cypher query each, and shows the query
> and official sources behind every answer. A small Claude model can answer
> plain-English questions, but only through six fixed graph tools that run on
> the user's own plan, and a side-by-side switch shows the same model without
> the graph.
