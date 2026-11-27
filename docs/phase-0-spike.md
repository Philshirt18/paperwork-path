# Phase 0 — Relate spike report

Date: 2026-11-27. Relate version pinned: **`@relate/relate-wasm` 1.3.0** (browser) and
**`@relate/relate` 1.3.0** (Node, native), both released 2026-11-25.

How to rerun: `npm run spike` (Node, same WASM build) or `npm run dev` and open `/spike` (browser).

## Result: 18 / 18 checks pass, in Node and in the browser

| Feature we need | Works? | Notes |
|---|---|---|
| WASM build runs in the browser (Next.js 15, webpack) | Yes | ~0.8 s to load the 7 MB `.wasm` and run all tests locally. The `.wasm` is copied to `public/relate/` on `npm install`. |
| Production build (`next build`) | Yes | Page is static; no server needed for the graph. |
| List property on a relationship (`profiles: ['autonomo']`, and `[]`) | Yes | **Graph model stays as planned.** |
| `$profile IN r.profiles`, `size(r.profiles) = 0` | Yes | "Empty list = applies to everyone" works. |
| Variable-length paths `*1..8` | Yes | |
| `relationships(path)` + `all()` predicate | Yes | Used to keep only paths valid for the user's profile. |
| List comprehension, pattern comprehension | Yes | |
| Cycle query `(s)-[:REQUIRES*2..6]->(s)` | Yes | Finds the rental → NIE → padrón loop (once per station in it; we de-duplicate). |
| Cycle + `WORKAROUND_FOR` way out | Yes | |
| `NOT EXISTS { … }` subquery ("Do this now") | Yes | |
| Reverse traversal ("What if") | Yes | |
| `shortestPath` | Yes | |
| `MERGE` writes (mark a step done) | Yes | |
| Export the graph and re-import it in the browser | Yes, via our own code | See below. |
| Write a real `.rl` file (Node client) and reopen it | Yes | 24 KB file for the test graph. |
| `relate serve --mcp` | **Not tested yet** | Needs the Relate CLI; installing it was blocked by my permission settings. You run one command (below). |

## Things we learned that change the plan

1. **Paths can pass through the same station twice.** Cypher only forbids repeating a
   *relationship*. So "RETA → NIE" also returns a longer path that goes round the circle and comes
   back to NIE. Correct behaviour, but for **"Why can't I"** we will use `shortestPath` (or keep the
   shortest path per missing step) so the chain is readable.
2. **The browser build has no "save to file" or "load from file" function.** Its only durable
   storage is OPFS (browser-private storage, worker only). Proposal for **"Download / upload my plan"**:
   - Download = a **`.cypher` file**: a Relate/openCypher script of `CREATE` statements that rebuilds
     the user's graph. We generate it with two Cypher queries (all nodes, all relationships).
     Tested: export → load into a fresh database → identical counts and list properties.
   - Upload = run that script with Relate's `executeScript`.
   - It is plain text, so a judge can open it and read their own graph, and the same file loads
     into a `.rl` file with the Node client for `relate serve`.
   - A true `.rl` download is not possible from the browser in 1.3.0. I'd say so honestly in the README.
   - Browser auto-save via OPFS: possible (needs a Web Worker). Only if time allows in Phase 3.
3. **No explicit transactions in the browser** (`BEGIN` is a syntax error). Not a problem: each
   action is one statement.
4. Errors come back inside the result (`error` field), not as exceptions. Our query layer will turn
   them into proper errors so every UI error state is designed.

## MCP — what you need to run once

The Relate CLI is installed with the official script (it verifies a signature before installing):

```bash
curl -sSfL https://relatedb.ai/install.sh | bash
```

Then the Relate skill for Claude Code (makes me better at Relate in later phases):

```bash
~/.local/bin/relate skill install --agent claude-code
```

After that I can test `relate serve --mcp stdio --database <path>/paperwork-path.rl --read-only`
in Phase 5. Documented Claude Desktop config (from relatedb.ai, to be verified):

```json
{
  "mcpServers": {
    "paperwork-path": {
      "command": "relate",
      "args": ["serve", "--mcp", "stdio", "--database", "/absolute/path/paperwork-path.rl", "--read-only"]
    }
  }
}
```

## Sources

- https://relatedb.ai/docs/reference/api/wasm/ (browser API, "not in this build" list)
- https://relatedb.ai/docs/get-started/node.md (Node client)
- https://relatedb.ai/docs/guides/agents/connect-over-mcp.md (MCP)
- https://relatedb.ai/docs/guides/agents/install-the-skill.md (agent skill)
- https://relatedb.ai/docs/reference/cypher/differences-from-neo4j.md (limitations)
