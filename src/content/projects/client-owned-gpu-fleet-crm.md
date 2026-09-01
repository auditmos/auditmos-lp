---
title: "Managing 720+ client-owned GPU servers"
slug: "client-owned-gpu-fleet-crm"
summary: "A company manages GPU compute servers on behalf of more than 120 owners, each of whom owns at least six of them."
client:
  sector: "Distributed GPU compute"
capabilities:
  - "software"
industry: "Renewable energy"
year: 2025
stack:
  - "TanStack Start"
  - "Hono"
  - "Cloudflare Workers"
  - "Drizzle ORM"
  - "Neon Postgres"
  - "Better Auth"
featured: true
order: 3
---

## TLDR

A company manages GPU compute servers on behalf of more than 120 owners, each of whom owns at least six of them. The servers are not in a data centre — each one stands at its owner's own location, running on the owner's own electricity and internet connection. The company was running that fleet from spreadsheets, a vendor web panel, and a phone, none of which the owners could see into. This project replaced them with one system that consolidates compute telemetry, per-server power measurement, and GPU marketplace earnings into a single view per owner, and that switches each server's workload on a schedule instead of by hand. It runs on Cloudflare Workers against a Postgres database of 45 tables, with three cron schedules doing the collection.

## Key facts

- **Scale:** more than 120 owners, each with at least six GPU servers — over 720 machines across 120+ separate physical locations
- **Ownership model:** the owner buys the hardware, hosts it themselves, and pays its electricity; the company manages it remotely
- **Data model:** 45 Postgres tables, 50 production migrations
- **Codebase:** 1,228 tracked files, of which 175 are test files
- **Collection cadence:** three scheduled jobs, running every 5 minutes, every 10 minutes, and hourly
- **Retention:** raw power samples ~31 days, hourly rollups 90 days, with lifetime counters that survive both
- **Build:** 675 commits by five contributors, February to August 2026
- **Modes per server:** three — crypto workload, internal AI compute, and GPU marketplace rental
- **Stack:** TanStack Start (SSR frontend) and Hono (REST API), both on Cloudflare Workers; Drizzle ORM; Neon Postgres; Better Auth

## What is a managed GPU compute fleet?

Someone buys a GPU compute server and keeps it in their own building, plugged into their own power and their own internet. A management company configures it, keeps it working, decides what it computes, and settles what it earns.

The owner is not a system administrator and never becomes one. They plug in two cables and, from then on, the machine is somebody else's operational responsibility.

**Quick answer:** This is not hosting. The hardware lives with the customer; only the management is centralised.

That inverts the usual constraint. The managing company has physical access to nothing, and the customer sits in the same room as the hardware without being able to tell what it is doing.

## What problem does it solve?

Before the CRM, the operation ran on three tools. Spreadsheets held who owned what and what they were owed. A vendor web panel showed the fleet. A phone handled everything the other two could not answer.

The failure is not that any one of them is bad. It is that a server's full state lives in none of them. Compute performance sits in one vendor's system, electricity draw sits in a smart meter at the owner's site, marketplace rental income sits in a third-party account, and ownership sits in a spreadsheet.

**Key fact:** answering *what did this server earn and cost last month* meant opening four things and doing arithmetic. At 120+ owners with six or more servers each, that is not an occasional task. It is the job.

The second problem belongs to the owner. The electricity is theirs and it is the largest running cost against whatever the machine earns. Without per-server measurement, nobody on either side can say whether a given machine is actually profitable.

| Question | Before | After |
|---|---|---|
| Is my server running? | Phone call to the operator | Owner opens their own link |
| How much of my power did it use? | Estimated from specifications | Measured per server, per minute |
| What is it working on? | Whatever it was last set to | Rotated on a schedule, per tag |
| What did it earn across roles? | Two vendor accounts, added by hand | One timeline, one settlement line per server |
| Who owns it? | A spreadsheet row | A database record the owner's view is built from |

## How does it work?

Three scheduled jobs pull from three different worlds on their own cadences, and everything lands in one Postgres schema keyed to an owner.

| Source | What it provides | How it arrives |
|---|---|---|
| Fleet management vendor | Per-server throughput, uptime, current workload, health | Polled by a health probe and a metrics collector |
| Smart plug at the owner's site | Instantaneous power draw per server, in watts | Sampled on a short interval, rolled up hourly and monthly |
| GPU marketplace | Rental status, occupancy, earnings per machine | Polled for status; earnings polled separately |

Raw samples are deliberately short-lived — roughly 31 days for power samples, 90 days for hourly rollups. **Key fact:** a separate persistent counter tracks lifetime consumption per server precisely because the samples it was derived from will be deleted, and because a meter that is replaced or reflashed starts counting from zero again.

The owner sees none of that machinery. They open a link and see their own servers, their own uptime, their own kilowatt-hours.

## Why does automated workload rotation matter?

Each server runs a configuration that determines what it computes and how. Changing it is a small action with real financial consequence, because which crypto workload is worth running moves constantly.

Doing it by hand across hundreds of machines does not scale, and it fails in a specific way: the servers that get switched are the ones somebody remembered. The rest keep running whatever they were set to last month, at whatever that is now worth.

The CRM models this as rotation profiles. A profile carries an interval in minutes and a scope of servers, expressed as tags rather than as a list of machine names — so a server joins a rotation by being tagged, not by being edited into a config.

**Quick answer:** Rotation is a scheduled cycle through a list of coins, applied per tag, with the current state read back from the fleet rather than assumed.

Two guards in the planner are what make it safe to run unattended. A server with only one coin in its rotation does not rotate. And if the next coin in the cycle is already what the server is running, no change is issued — which stops the system generating work that does nothing but churn the fleet.

Every change is written to an audit log. That is the part that matters when an owner asks why their machine switched.

## What happens when one server changes role?

This is the constraint that shaped the data model. A single physical box carries two disks: one for GPU marketplace rental, one for the crypto workload. Switching between them is a manual operation, done at the owner's request, and the machine effectively vanishes from one vendor's world and appears in the other.

So machine identity cannot be a foreign key to a single system. The same hardware is a marketplace machine one week and part of a compute farm the next, and both roles produce revenue belonging to the same owner.

**Key fact:** the schema resolves this by giving each server an explicit active mode — marketplace, crypto workload, or internal compute — and by constraining every settlement line to reference exactly one identity, farm or compute server, never both.

Without that constraint the naive model counts one machine's earnings twice. With it, a server that changes role produces one continuous timeline instead of two disconnected histories.

The same constraint carries a second case that arrived early: the first marketplace machine was bought jointly by two owners, who each need to see the same physical server under their own separate link.

## Why measure electricity at the owner's own meter?

Because it is the owner's bill. A smart plug at each site measures that server individually, samples become hourly rollups, rollups become monthly aggregates, and a rate specific to that owner turns kilowatt-hours into a currency figure.

**Quick answer:** the cost side of the machine comes from a meter reading at the owner's own supply, not from a specification sheet.

The owner sees the same summary the operator does — consumption over 7, 30 or 90 days, a daily average, a comparison against the previous period, and lifetime consumption since the server started work. Where there is not enough history to compare periods, the trend is hidden rather than shown as a misleading zero.

This is the number that makes the arrangement legible. Earnings alone say nothing when the electricity behind them is coming out of the owner's own supply.

## Steps: how it was built, in order

1. **Schema and seed first.** Owner, farm and server model established before any integration.
2. **API layer.** Typed endpoints over the schema, with validation shared between frontend and backend.
3. **Client CRUD and listing.** The operator's own view, replacing the ownership spreadsheet.
4. **Fleet vendor integration.** Read-only first: servers, throughput, uptime, health.
5. **Workload configuration, then tagging.** Manual switching before automated switching — tags made scoped rotation possible.
6. **Metrics history and caching.** Five consecutive rounds of work on dashboard read performance once real data volume arrived.
7. **Power monitoring.** Smart plug sampling, rollups, lifetime counters, then energy summaries in the owner's view.
8. **Marketplace compute.** Machine bindings, status snapshots, settlement lines, and the mode constraint above.
9. **Support tooling.** Tickets, notifications, a knowledge base, and AI-assisted suggestions drawn from ticket history.

The order is not incidental. Each stage produced something the operator used before the next one started, and every automation step came after its manual equivalent was already in place.

## FAQ

### How is this different from hosting?

In hosting, the provider holds the hardware and the customer holds a contract. Here it is reversed: the customer holds the hardware, in their own building, on their own electricity, and the provider holds the operational responsibility. That reversal is why an owner-facing view is not a nice-to-have — without it the owner has a machine in the next room and no idea what it is doing.

### Why not just use the fleet vendor's own dashboard?

Because it only knows about the fleet. It does not know who owns which server, how much of that owner's electricity the server drew, what it earned on a GPU marketplace, or what the owner is therefore owed. The vendor dashboard is one of the sources this system consolidates, not a replacement for it.

### How does the system measure power per server?

A smart plug at each site reports instantaneous draw, which is sampled on a short interval and aggregated upward. Per-server measurement is the point — the owner's household or business meter cannot separate the server from everything else on the same supply.

### Why keep a separate lifetime counter instead of summing the samples?

Because the samples are deleted. Raw power samples are retained around 31 days and hourly rollups 90 days, so any "since installation" figure computed from them would silently shrink over time. The counter is also written to tolerate a meter being replaced or reset, which otherwise makes a running total jump or fall.

### What happens when a server switches between crypto workload and marketplace rental?

It changes active mode, and the system tracks the same hardware across both roles rather than treating it as two machines. Every settlement line belongs to exactly one identity, which is what prevents one server's earnings from being counted twice.

### How do owners see their servers without a CRM login?

Through per-owner share links, which render the same summaries the internal panel shows, from shared components. Owners are not CRM users, so onboarding one does not mean provisioning an account and teaching someone a new tool.

### How long did this take to build?

675 commits across roughly six months, from February to August 2026, with five contributors. It was in production use during that period rather than after it — integrations were added to a system that was already running.

### What are the common mistakes when consolidating vendor telemetry?

Two recur. The first is modelling each vendor's identifier as the machine's identity, which breaks the moment one machine appears in two systems. The second is treating retention as somebody else's problem: raw telemetry is expensive to keep and cheap to lose, so anything an owner will ask about a year from now has to be aggregated before the source data expires.

### When should you not build something like this?

When the fleet is small enough that a spreadsheet is genuinely accurate, or when one vendor already covers every source of truth you need. This work was justified by consolidation across three independent systems, for 120+ owners, with no physical access to any of the hardware. At a tenth of that scale the integration cost is not repaid.

## Last updated

2026-08-10
