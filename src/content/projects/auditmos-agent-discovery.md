---
title: "MCP Server and Agent Discovery"
slug: "auditmos-agent-discovery"
summary: "An MCP server, a published agent index, and DNSSEC-signed DNS-AID records on auditmos.com — built so the discovery records point at something that exists."
client:
  name: "Auditmos OÜ"
  url: "https://auditmos.com"
industry: "Professional services"
year: 2026
stack:
  - "Model Context Protocol"
  - "Cloudflare Workers"
  - "Astro"
  - "SVCB / DNSSEC"
featured: false
order: 3
links:
  - label: "Agent index"
    url: "https://auditmos.com/agents.json"
  - label: "Source"
    url: "https://github.com/auditmos/auditmos-lp"
---

Machine readers now arrive at company websites the way people once arrived from search. auditmos.com already answered them halfway: every page has a Markdown twin and `/llms.txt` indexes the lot. The missing half was a way for a program to *ask questions* rather than read pages, and a way to find that entry point without being told where it is.

## What was built

The work has three parts:

- **`POST /mcp`** — a Model Context Protocol server over Streamable HTTP, exposing the company profile, service lines, project history, and open-source repositories as read-only tools.
- **`/agents.json`** — the organization index.
- **`_agents.auditmos.com`** — SVCB records published per the DNS for AI Discovery draft, in a zone signed with DNSSEC so a validating resolver can authenticate what it reads.

## Why the server came before the records

The obvious move was to publish the DNS records — they are three API calls, and a scanner will mark the site compliant once they resolve. Auditmos did not do that, because at the time there was no agent behind them. A record at `_a2a._agents.auditmos.com` asserts an agent that answers; pointing one at a 404 is a claim the infrastructure cannot back. So the server was built first, deployed, and verified against the specification, and only then did the records go up. The order cost a day and is the entire point: a discovery record is a promise, and DNSSEC signs it.

## Four defects the audit turned up

Auditing the site against the specifications turned up four defects in the existing property:

- Tailwind's automatic source detection was scanning TypeScript and minting real CSS utilities from ordinary code tokens — `.filter(`, `static`, `table` — shipping dead bytes on every page.
- The site declared `/about` canonical in its metadata while the edge redirected away from it, so every internal link cost a round trip.
- Two sitemaps were being generated with identical contents, one of which nothing referenced.
- The discovery headers had no test proving their targets existed.

All four are fixed, and each is now covered by a build test that fails rather than drifts.

## Check it without asking

Everything here is checkable without asking:

```
curl -X POST https://auditmos.com/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

dig SVCB _index._agents.auditmos.com
```

That is the same standard the audit reports are held to. The reason this case study exists is that a company selling delivery which survives scrutiny should be the first thing scrutinised.
