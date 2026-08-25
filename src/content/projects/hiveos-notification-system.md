---
title: "How we cut a mining fleet's alert noise down to 85 Telegram messages a day"
slug: "hiveos-notification-system"
summary: "The HiveOS Notification System watches around a hundred crypto-mining farms and forwards what matters to Telegram, one thread per farm."
client:
  sector: "Crypto mining infrastructure"
industry: "Cryptocurrency mining"
year: 2026
stack:
  - "Cloudflare Workers"
  - "Durable Objects"
  - "Hono"
  - "Drizzle ORM"
  - "Neon Postgres"
  - "TypeScript"
featured: false
order: 1
---

## TLDR

The HiveOS Notification System watches around a hundred crypto-mining farms and forwards what
matters to Telegram, one thread per farm. It exists because the mining OS's own notifications
are noisy, offer few filter options and almost no customisation — so the one person
responsible for monitoring got everything at once, and learned about the real failures by
phone. Four stages now sit between the alert source and the chat: dedup by event ID, a
content cooldown, a restart counter, and a GPU temperature state machine. On Monday 24 August
2026 the poller found an open alert on 71,449 farm-polls and sent 85 messages. Auditmos built
it and has run it in production since March 2026.

## Key facts

- **Live since March 2026.** 27 tagged releases (v1.0.0 → v1.15.2) in five months, 109
  commits, two developers.
- **Polls every 60 seconds** from a single Cloudflare Durable Object alarm. Measured
  throughput is about 47 cycles an hour — roughly 75 seconds once the work in each cycle is
  counted.
- **Fleet:** built for around 100 farms. About 66 carry an actionable message in a given
  cycle.
- **Volume, 18–24 August 2026:** 769 Telegram messages. Mean 110 a day, median 97, and 86 a
  day if you drop one Friday spike of 254. Weekends run 30–40% below weekdays.
- **Funnel, 24 August 2026:** 71,449 farm-polls carrying an open alert, 85 status changes
  detected, 35 restart events suppressed, 6 consolidated bursts, 1 GPU temperature alert →
  85 messages sent.
- **Reliability, same day:** 315 HiveOS API poll errors, 0 dispatch failures.
- **Concentration:** one farm produced about 26% of the week's messages. A tail of 28 or more
  farms got one or two all week.
- **Tests:** 318 cases across 40 files.

## What is the HiveOS Notification System?

It is an alert router with opinions. HiveOS is the operating system the mining rigs run, and
it exposes an API listing every message a farm's workers have produced — GPU errors, driver
crashes, reboots, recoveries. The service polls that API for every farm the operator owns,
decides which messages a human should actually see, and posts the survivors into a Telegram
group.

Each farm gets its own forum topic in that group, created the first time it has something to
report. Alerts from one farm never land in another farm's thread. When the problem is fixed,
an operator types `/done` in the thread and the topic closes; the next alert from that farm
opens a fresh one.

> **Quick answer:** it sits between the mining OS and the chat app, and its job is throwing
> alerts away.

## What problem does it solve?

The operator runs roughly a hundred farms. Hardware at that scale complains constantly, and
the built-in notifications faithfully relay all of it. There are few filter options and next
to no customisation, so the person watching the fleet received every reboot, every transient
warning, and the same open alert repeated on every cycle.

What that produces is not vigilance. It is a channel nobody can read. The genuinely important
failures still arrived by phone, from the client, after the fact — which is the definition of
a monitoring system that has stopped working.

> **Key fact:** the problem was never missing alerts. It was that every alert looked the same
> as the noise around it.

## How does it work?

A single Durable Object holds an alarm that fires every 60 seconds. Each cycle it loads the
farm list, polls HiveOS for new worker messages, and separately polls worker status to catch
transitions the message feed does not report — a rig going offline, coming back, or rebooting.
Farms are polled 20 at a time to stay inside the Worker's CPU budget.

Messages typed `info` are dropped immediately; only `danger`, `warning` and `success` continue.
Unknown types are logged and skipped rather than guessed at. What survives goes through the
filter chain, then to Telegram.

> **Quick answer:** one farm's failed poll never stops the cycle, which is why 315 HiveOS API
> errors in a day produced zero missed dispatches.

Transient failures — 429 and 5xx — retry four times with exponential backoff from one second,
capped at 30, honouring `Retry-After` when the API sends one.

## What does each filter actually remove?

| Stage | What it drops | Measured, 24 Aug 2026 |
|---|---|---|
| Event dedup | Any announcement ID already recorded. HiveOS keeps returning an open alert on every poll, so this stage absorbs almost all of the 71,449 | the bulk of the volume |
| Content cooldown | The same worker plus the same message text seen inside the cooldown window (default 60 minutes) | folded into the above |
| Watchdog filter | Single reboots. Restarts are counted per worker in a rolling window; below the threshold nothing is sent | 35 suppressed, 6 bursts fired |
| GPU temperature | Readings that cross a threshold once, or flap across it | 1 alert |

The watchdog stage is the one worth understanding. A rig that reboots once is not news. A rig
that reboots three times in two hours is the most useful alert in the system, and it deserves
one message, not three. So restarts are held, counted, and released as a single consolidated
burst the moment they cross the threshold — with the suppressed events written to the database
either way, so nothing is silently lost.

> **Key fact:** 35 restart events on Monday became 6 messages.

## Why is GPU temperature the hardest signal here?

Everything else in the pipeline is an event: HiveOS decides something happened, we decide
whether to forward it. Temperature is not an event. It is a number sampled once a cycle, and a
bare threshold check on a sampled number breaks in two directions at once.

A rig sitting at 65.1 °C against a 65 °C threshold alerts on every poll, forever. A rig
oscillating between 65.0 and 64.9 crosses the line in both directions all day. A cooldown fixes
neither, because a cooldown suppresses repeats and this is not a repeat — it is a value
wobbling across a boundary.

So each GPU metric carries its own small state machine, keyed by farm, worker, GPU and metric.
It alerts only after two consecutive readings at or above the threshold, and cannot alert again
until the GPU has cooled past `threshold − hysteresis`. Two samples costs about a minute of
delay, which for a temperature is nothing, and it removes every spike caused by a workload
change rather than a cooling problem.

The readings cost no extra API calls. The status poll already fetches every worker to detect
online and offline transitions, and the GPU telemetry rides back in the same response.

## What can an operator change without a deploy?

Every threshold lives in Postgres and is readable and writable over the API behind bearer auth.
Nothing here requires shipping code.

| Setting | Default | Range |
|---|---|---|
| `cooldown_minutes` | 60 | 0–1440 |
| `watchdog_filtering_enabled` | off | on/off |
| `watchdog_window_minutes` | 120 | 1–1440 |
| `watchdog_threshold` | 3 | 1–100 |
| `gpu_temp_alerts_enabled` | off | on/off |
| `gpu_core_temp_threshold` | 65 °C | 30–120 |
| `gpu_mem_temp_threshold` | 75 °C | 30–120 |
| `gpu_temp_hysteresis` | 5 °C | 1–30 |
| `topic_close_mode` | close | close/delete |

> **Key fact:** both filtering features ship disabled. A new deployment starts by relaying
> everything, and the operator turns on suppression once they have seen what their own fleet
> actually produces.

## Steps: how a HiveOS alert becomes a Telegram message

1. The Durable Object alarm fires. The farm list loads from Postgres, deduplicated — a farm
   shared by several clients is polled once, not once per client.
2. Worker messages are fetched per farm, 20 farms at a time, using the last timestamp stored
   per farm so each poll asks only for what is new.
3. Worker status is fetched in the same pass. Online, offline and reboot transitions become
   messages; GPU telemetry goes to the temperature filter.
4. `info` messages are dropped. Unknown types are logged and skipped.
5. Announcement IDs already in the database are removed, then anything matching a recent
   worker-plus-text pair inside the cooldown window.
6. Restart events are counted and held. Everything else passes straight through.
7. Survivors are grouped by farm and by message text, the farm's topic is found or created,
   and the messages are sent 200 ms apart with severity icon, client name, worker name,
   timestamp and a direct link to that worker in HiveOS.

## FAQ

### What is the HiveOS Notification System?

A Cloudflare Worker that polls the HiveOS API for a fleet of mining farms, filters the alerts,
and posts what is left into a Telegram group with one thread per farm. It was built for a
single operator running around a hundred farms and has been in production since March 2026.

### Why not just use the notifications HiveOS already sends?

Because they are unfiltered. The operator's complaint was noise volume, a short list of filter
options, and almost no customisation — so the useful alerts were buried in reboots and repeats.
This system adds the layer that decides what a human should be woken for.

### How quickly does an alert reach Telegram?

The alarm fires every 60 seconds, and measured throughput is about 47 cycles an hour, so worst
case is a little over a minute. GPU temperature alerts wait for a second confirming reading and
therefore take about a minute longer.

### What happens when the HiveOS API fails?

Each farm is polled independently, so one failure does not affect the others. Rate limits and
server errors retry four times with exponential backoff, capped at 30 seconds and honouring
`Retry-After`. On 24 August the system logged 315 poll errors and still delivered every message
it decided to send.

### Why does each farm get its own Telegram topic?

Because a hundred farms in one flat channel is the noise problem again, one layer up. A topic
per farm means the history of a single farm's failures reads as a single conversation, and
`/done` clears it when the issue is resolved.

### What stops the same alert being sent twice?

Two independent mechanisms. Every announcement ID that reaches dispatch is written to Postgres
and never processed again, and a content cooldown suppresses the same worker plus the same
message text for a configurable window, 60 minutes by default.

### Why do temperature alerts need two readings and a hysteresis band?

Because temperature is sampled rather than reported. One reading above a threshold might be a
workload spike; two consecutive readings is a trend. The hysteresis band stops a GPU parked
near the limit from alerting every time it wobbles across it.

### How long did it take to build?

The first commit landed on 24 March 2026 and ten tagged releases followed the next day, so the
core path — poll, dedup, dispatch to a Telegram topic — came together quickly. The remaining
five months, 109 commits and 17 more releases went almost entirely into filtering and
resilience.

### When is this the wrong approach?

When the fleet is small enough that the built-in notifications are readable, this is
overhead you do not need. Polling also puts a floor under latency: if you need sub-second
alerting, a polling loop on a one-minute alarm is the wrong shape and you want a push
integration instead.

### What was the hardest part?

Not the alerting — the suppression. Deciding what not to send requires state, and state that
survives restarts, per farm and per worker and per GPU. The pipeline that delivers messages is
straightforward; the four stages that throw them away are where the 318 tests live.

## Last updated

2026-08-25
