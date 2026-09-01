---
title: "wizytowka.link: we published 3,867 free business pages and nobody wanted one"
slug: "wizytowka-link"
summary: "wizytowka.link found Polish local businesses that have a Google Maps listing but no website, generated a page for each one with an AI model, and published it for free."
provenance: "internal-r-and-d"
capabilities:
  - "software"
  - "applied-r-and-d"
industry: "Lead generation, local SMB"
year: 2026
stack:
  - "Astro 5"
  - "Cloudflare Workers"
  - "D1"
  - "R2"
  - "KV"
  - "SerpAPI"
featured: false
order: 4
---

## TLDR

wizytowka.link found Polish local businesses that have a Google Maps listing but no
website, generated a page for each one with an AI model, and published it for free. Instead
of printing the owner's phone number, each page carried an AI assistant, so a visitor's
interest became a logged event rather than an invisible phone call. The machine worked:
3,867 live pages across 18 categories, 60,540 scheduled jobs, no human in the loop. Over 76
days those pages drew 3,641 browser-like visits, 13 chat sessions — 10 of them our own
testing on the day the feature shipped — and not one message from anyone outside the
project. We switched it off in August 2026.

## Key facts

- **Live pages published:** 3,867, across 18 business categories
- **Businesses scraped from Google Maps:** 14,040 — of which 9,086 already had a website and 1,082 had no phone number
- **Qualified as leads:** 3,872, or 28% of everything the scraper returned
- **Localities searched:** 127 of the 54,472 in the Polish TERYT register
- **SerpAPI calls spent:** 3,215 across 151 discovery runs
- **Scheduled jobs run:** 60,540 between 2026-03-31 and 2026-08-28
- **Browser-like page visits:** 3,641 over 76 days, spread across 3,174 distinct pages
- **Visits arriving from a search engine:** about 119
- **Chat sessions started:** 13 — 10 from the development machine on launch day, 3 from other devices, none of which sent a message
- **Business owners who claimed a page:** 1
- **Code:** 22,035 lines across 148 source files, 68 test files, 19 database migrations, 162 commits over six months

## What was wizytowka.link?

An automated lead-generation platform for Polish local businesses, built as an experiment
and run in production from February to August 2026. It ran on Cloudflare Workers with no
operator.

Every day it picked the next town in Poland, searched Google Maps for 18 kinds of local
business, and kept the ones with a phone number and no website. For each of those it
generated a page — name, address, opening hours, map, description, services — and published
it at a public URL.

**Quick answer:** it was a machine that turned a Google Maps pin into a working website
without asking anyone's permission, and then measured whether that was worth anything.

## What problem was it trying to solve?

Plenty of small Polish businesses have a Maps pin and nothing else. A plumber, a bakery, a
tyre shop. Customers looking for them online find a phone number, a star rating and no
answer to any actual question — opening hours on a bank holiday, whether they do same-day
work, whether they take a card.

The bet was that a ready-made page costs the business nothing and is obviously better than
nothing. The page is already live.

There was a second problem underneath, and it is the more interesting one. A page with a
phone number on it sends the visitor away, so you never learn whether the page created the
demand.

## How did the AI assistant change the measurement?

Every published page hid the phone number, the e-mail and any contact link — in the visible
page and in the structured data underneath it. In their place sat one button: *Zapytaj
asystenta*.

The assistant answered in Polish, only from that business's record. It said plainly that it
did not represent the business, and it refused to hand out contact details. Each
conversation was stored with a transcript, a message count, and an intent summary tagged as
booking, quote, availability, complaint, job enquiry or contact request.

**Key fact:** this turns interest into a row in a database. A phone call is invisible; a
chat session has a start time, a length, a transcript and a category.

That is the part of the design worth keeping. If a page draws people who want to book
something, you can prove it. If it draws nobody, you can prove that too — and that is what
happened.

## How did it work?

Five scheduled jobs, each doing one thing, all logged to the database:

1. **Geocoder**, hourly — assigned GPS coordinates to the next town from the 54,472-record
   TERYT register, backing off exponentially on failure rather than marking anything dead.
2. **Preflight**, 07:55 daily — checked the remaining SerpAPI quota and set a flag if it was
   low.
3. **Discovery**, 08:00 daily — searched the next town in 18 categories, respecting that
   flag and stopping before it burned another call.
4. **Generator**, every 5 minutes — took new businesses and produced page content through
   Z.ai GLM-5, writing the result to object storage.
5. **Chat timeout**, every 10 minutes — closed inactive assistant sessions and wrote the
   intent summary.

A weekly job pushed a funnel report to Telegram, and a private panel showed leads,
transcripts and a seven-stage sales pipeline. Every run of every job wrote a start and
finish row, which is why the operational numbers in this article exist at all.

## What did those 3,867 pages actually do?

The honest answer is: they were crawled, and almost nothing else.

The pages logged 66,912 visits. Of those, 51,620 came from a user agent that identified
itself as a bot, and 11,601 came from our own SEO audit tool. That leaves 3,641 visits from
something browser-shaped, spread across 3,174 distinct pages over 76 days.

**Key fact:** roughly 1.15 visits per page is what crawling looks like, not what an audience
looks like. About 119 of those visits arrived with a search-engine referrer — mostly Bing,
then Google.

Thirteen people ever opened the assistant. Ten of those sessions happened on 26 and 27 May,
from one Mac, on the two days the feature shipped — that was us. The remaining three came
from an iPhone and two Android devices, in June, July and August. All three closed without
a single message typed.

One business owner ever claimed a page through the Telegram bot.

## Why did we stop?

Two numbers, in this order.

**First, the market was a third of what it looked like.** Of 14,040 businesses returned by
Google Maps, 9,086 already had a website and 1,082 had no phone number. Only 3,872
qualified. The gap that made the whole idea attractive was real but far narrower than the
Maps result count suggested, and there is no version of the plan where that ratio improves.

**Second, the demand signal was zero.** Three outside chat sessions and zero messages across
3,867 live pages is not a weak result to be optimised. It is an answer. Adding the AI
assistant was the strongest version of the idea we could build, and it moved nothing.

The last commit pauses every cron trigger. The pages are still up; nothing is being
generated.

## What the experiment proved, and what it did not

This distinction matters more than any other paragraph here, because the test was passive.
Nobody was ever called — the sales log holds three entries and that is the truth, not a
gap in the logging.

| Question | Answered | What the data says |
|---|---|---|
| Can one person build and run this end to end? | Yes | 60,540 unattended jobs, 3,867 pages, no manual step in the pipeline |
| Can you find businesses without a website at scale? | Yes | 3,872 qualified leads from 127 of 54,472 towns |
| Is the addressable market as large as it looks? | No | 65% of Maps results already had a website |
| Will a free published page generate inbound interest? | No | 3 outside sessions, 0 messages, 1 owner claim |
| Would these businesses buy if someone called them? | Unknown | Nobody was ever called |
| Does an assistant beat a phone number as a demand signal? | Unknown | 13 sessions is far too few to compare |

**In short:** we proved that publishing the thing and waiting does not work. We did not
prove that the business is impossible, and saying otherwise would be reading more into the
data than it holds.

## Steps: how to test an idea like this in a week instead of six months

1. **Count the addressable market from live data before writing any code.** One day of
   scraping would have shown that 65% of results already had a website. That single ratio
   was available in February and read in July.
2. **Publish twenty pages by hand.** Not 3,867. The per-page cost of finding out is the same.
3. **Instrument the one signal you care about** — for us, whether anyone starts a
   conversation — and nothing else, until it moves.
4. **Set the kill number before you start.** "Fewer than N conversations in 30 days and we
   stop" is a decision you can make honestly in advance and cannot make honestly afterwards.
5. **Run the active test before the passive one.** Calling fifty businesses takes an
   afternoon and answers a question that six months of publishing did not.
6. **Log every scheduled run from day one.** It costs one table and it is the reason this
   write-up contains numbers rather than impressions.

## FAQ

### What is wizytowka.link?

An automated platform that found Polish local businesses without a website, generated a
free page for each with an AI model, and published it with an AI assistant instead of a
phone number. It ran in production from February to August 2026 and is now paused.

### Why hide the business's phone number?

Because a phone number sends the visitor off the page and the demand becomes invisible.
Routing everything through an assistant meant every enquiry was recorded with a transcript
and an intent category. The assistant always stated that it did not represent the business.

### How were the pages generated?

Z.ai GLM-5 produced the name, description, services and local context for each business
from its scraped record. The generator ran every five minutes, and the output was stored as
JSON in object storage and rendered on request by an Astro SSR worker.

### How many businesses actually qualified?

3,872 out of 14,040 scraped, or 28%. 9,086 already had a website and 1,082 had no phone
number. The share with a website swung from 23% to 96% between towns, so only the aggregate
is worth planning against.

### Did anyone use the AI assistant?

Thirteen sessions were started in total. Ten were our own testing on the two days the
feature launched. The remaining three came from outside devices over three months and all
closed without a message being sent.

### Was this a failure?

It answered its question, which is what an experiment is for. The engineering worked as
designed and ran unattended for five months. What it cost was the six months spent learning
something a week of testing would have shown.

### Would cold-calling the leads have worked?

Unknown, and worth saying plainly: nobody was ever called. The database holds three
sales-log entries. Everything in this write-up is a result about inbound interest, and none
of it is evidence about what happens when a human picks up the phone.

### What would you do differently?

Test the market before building the machine. The addressable-market ratio and the inbound
demand signal were both available from a few days of scraping and twenty hand-made pages.
Six months of engineering produced a more elegant answer to a question that a week would
have answered.

### Is the code still running?

No. The last commit pauses all cron triggers. Published pages remain online, nothing new is
being discovered or generated, and the assistant is idle.

## Last updated

2026-09-01
