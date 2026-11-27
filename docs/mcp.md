# Paperwork Path over MCP

The same graph the app runs in your browser can be served to any MCP host
(Claude Desktop, Claude Code, Cursor and others) with Relate's own MCP server.
Your assistant can then ask the graph directly: its schema, the circles, the
chains of requirements.

## 1. Build the graph file

```bash
npm run mcp:build
```

This writes `mcp/paperwork-path.rl` (about 50 KB, ignored by git). It contains
the 14 official steps, the 3 profiles, every requirement with its source, the
way out, and the fictional demo traveller Lena. The script uses Relate's native
Node client (`@relate/relate@1.3.0`) and the same seed and queries as the
browser app, and checks that the four core questions give the same answers.

## 2. Install the Relate CLI

```bash
curl -sSfL https://relatedb.ai/install.sh | bash
```

## 3. Connect a host

All hosts start the same command (verified against relate 1.3.0, from
[Connect over MCP](https://relatedb.ai/docs/guides/agents/connect-over-mcp.md)):

```bash
relate serve --mcp stdio --database /absolute/path/to/mcp/paperwork-path.rl --read-only
```

**Claude Code**, from the project folder:

```bash
claude mcp add paperwork-path -- relate serve --mcp stdio --database ./mcp/paperwork-path.rl --read-only
```

**Claude Desktop**: add this to `claude_desktop_config.json`
(macOS: `~/Library/Application Support/Claude/`), with your absolute path, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "paperwork-path": {
      "command": "relate",
      "args": ["serve", "--mcp", "stdio", "--database", "/absolute/path/to/mcp/paperwork-path.rl", "--read-only"]
    }
  }
}
```

With `--read-only` the server offers two tools, `get_schema` and `read_cypher`,
and refuses writes. Nothing in the file can be changed through MCP.

## 4. Try it

Ask your assistant, for example:

- "Use the paperwork-path graph. Which requirement loops exist for the autonomo profile, and what is the way out?"
- "What has Lena done, and which steps can she start now?"
- "Show me the official source for every requirement of the EU registration certificate."

The circle detector as one query you can paste into `read_cypher`. It keeps
only simple loops (no station twice) and lists each loop once, starting from
its alphabetically first station:

```cypher
MATCH loop = (s:Step)-[:REQUIRES*2..8]->(s)
WHERE all(r IN relationships(loop) WHERE size(r.profiles) = 0 OR 'autonomo' IN r.profiles)
WITH s, loop, nodes(loop)[1..] AS ns
WHERE all(i IN range(0, size(ns) - 2) WHERE NOT ns[i] IN ns[i + 1..])
  AND all(n IN ns WHERE s.id <= n.id)
RETURN [n IN nodes(loop) | n.shortName] AS circle,
       [r IN relationships(loop) | r.basis] AS basis
```

Result: the official loop (EU registration certificate needs the tax
registration, which needs the NIE that comes with the certificate) and the
common-practice loop through the town hall and proof of address.

## How this differs from the assistant in the app

| | In the app | Over MCP |
|---|---|---|
| What the model can do | Pick one of six fixed tools, ids from a closed list | Write any read-only Cypher |
| Whose data | Your own plan, in your browser | The shared seed file and Lena |
| Who it is for | Anyone, no setup | Developers and curious judges |

The app keeps the model on rails because its users are not graph experts. Over
MCP the person at the keyboard is, so the graph is opened up, read-only.

## Status

The `.rl` file is built and checked by `npm run mcp:build`. The `relate serve`
step follows the official docs, but in development it has not yet been run end
to end, because the CLI was not installed on the build machine.
