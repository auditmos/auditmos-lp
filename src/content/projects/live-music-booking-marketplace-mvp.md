---
title: "Live-music booking marketplace MVP: instant gig quotes with travel cost and a concert listing that fills itself"
slug: "live-music-booking-marketplace-mvp"
summary: "Auditmos built the MVP of a two-sided live-music marketplace in Poland for a startup founder whose premise is simple: there is no booking.com for bands and local artists."
provenance: "client-work"
capabilities:
  - "software"
client:
  sector: "Live-music marketplace"
industry: "Live entertainment"
year: 2026
stack:
  - "Next.js"
  - "Cloudflare Workers"
  - "Hono"
  - "Neon Postgres"
  - "Drizzle ORM"
  - "Durable Objects"
featured: false
order: 0
---

## TLDR

Auditmos built the MVP of a two-sided live-music marketplace in Poland for a startup founder whose premise is simple: there is no booking.com for bands and local artists. A venue, an event organiser or a private client finds a musician by city, genre and price, sees the full cost of the gig including travel before contacting anyone, and books a free date from the musician's calendar. Fans get a public listing and map of live music near them, filled every night by a collector that reads 5 ticketing sources and 173 venue and city-calendar pages. The MVP scope was coded in two weeks, the investor demo has taken place, and the MVP is now shown in investor pitches.

## Key facts

- **Client:** a startup founder in Poland; an MVP for investor demos, built by the Auditmos team.
- **Timeline:** MVP scope finished two weeks after the first commit in August 2026; 228 commits over about ten weeks, to mid-October 2026.
- **Status:** the investor demo has taken place, and the MVP is shown in ongoing investor pitches.
- **Account types:** 3 (musician, business, fan).
- **Concert collector:** 5 ticketing sources plus 173 venue, cultural-institution and city-calendar pages in 42 Polish cities, read every night, 90 days ahead.
- **Listing size:** over 3,500 collected concerts on the live listing in early October 2026.
- **AI budget caps:** at most 20 changed venue pages read by a language model and at most 20 pages rendered in a headless browser per night.
- **Tests:** 149 test files with more than 1,000 test cases.
- **Mobile Lighthouse performance:** listing page 55 to 80, event page 84 to 97; accessibility and SEO 100.
- **Hosting plan:** Cloudflare Workers Paid, $5 per month list price.

## What is the live-music booking marketplace?

It is a web app, installable on a phone, where three groups meet: musicians who sell live performances, businesses that hire them, and fans who look for concerts. Musicians publish a profile with rates, a calendar, photos and recordings. Businesses and fans search, request a gig and agree a price, and fans browse a listing and map of concerts near them.

> **Quick answer:** It is a booking marketplace for live musicians in Poland combined with a public concert listing. Clients see a musician's full price and free dates before the first message.

## What problem does it solve?

Live music in Poland is booked informally. A club, restaurant or event organiser finds a musician through friends or Facebook groups. They do not know who plays nearby, what a performance costs or whether the musician is free on a given Friday, and the cost of travel often comes up at the end of a phone call.

Musicians face the same gap from the other side. Gigs come through referrals, so calendars fill unevenly and rates vary from deal to deal. Fans have no single place to check where live music is playing tonight: the information sits in social-media events, posters and venue websites.

> **Key fact:** The founder's starting point was that no single place like booking.com exists for bands and local artists.

## How is the price of a gig calculated?

The musician fills in pricing once: an hourly rate, a higher rate for weekends and public holidays, a radius within which travel is free, and a rate per kilometre beyond it. When a client enters the event address, date and hours, the quote module returns an itemised price.

- Weekdays use the standard rate. Weekend days and Polish public holidays use the weekend rate; the holiday calendar is built in.
- Travel is charged only for kilometres beyond the free radius, doubled for the return trip.
- Travel is charged once per gig, whatever the number of hours played.
- Changing the event address changes only the travel line.
- The agreed price is stored with the booking, so a later change to the musician's rates does not touch it.

> **Quick answer:** The price of a gig is the hours played times the standard or weekend rate, plus travel beyond the musician's free radius counted both ways.

## How does booking work without double bookings?

A fan or a business sends a request for a date and hours. The musician answers with an offer that carries a final price, and the requester accepts that exact version or negotiates. The calendar works in hours: a musician can play a lunch set and an evening gig on the same day, and a set from 22:00 to 03:00 is one booking.

Two clients can try to take the same evening at the same moment. A PostgreSQL exclusion constraint settles it by rejecting any confirmed booking that overlaps another by even a minute. Times are stored in UTC and shown in Polish time, including the autumn night when 2:00 happens twice.

> **Key fact:** Double bookings are blocked by the database itself, so no sequence of requests can leave a musician with two overlapping confirmed gigs.

A confirmed booking stays private until the organiser publishes it to the listing, and then the musician's followers nearby get a push notification. Gigs arranged outside the platform can be entered as private events that block the calendar without appearing in public.

## Why does the concert listing include artists who are not on the platform?

A new marketplace starts empty. A fan who opens the listing and sees no concerts in their city has no reason to come back, and an empty map undermines an investor demo. So a collector runs every night and reads public concert data from 178 sources.

| Reader | What it reads | Sources |
|---|---|---|
| Ticketing feed and catalogue pages | Ticketmaster's feed and four Polish ticketing sites | 5 |
| Language model | venue and city-calendar pages with no structured data | 149 |
| The Events Calendar REST API | venues running that WordPress plugin | 16 |
| JSON-LD | venues that publish schema.org events | 4 |
| Headless browser | calendars that render only in JavaScript | 4 |

The same performer, city and day become one entry with a "buy ticket" button per seller, and a musician's own entry wins over a collected copy. A cancelled concert keeps a "cancelled" label until its date. A concert that disappears from its source is hidden only after two successful runs without it, so one site's outage cannot empty the listing.

> **Quick answer:** The listing combines concerts from musicians on the platform with concerts collected each night from 178 public sources in 42 cities. In early October 2026 it held over 3,500 collected concerts.

## How does the collector stay within a near-zero budget?

The goal was to add no cost beyond the hosting plan the app already pays for. Each source uses the cheapest reader that works: feeds and structured data first, a language model only for pages with nothing structured. The model reads only pages that changed since the last run, at most 20 a night, and the headless browser renders at most 20 pages a night.

The model extracts facts only: title, performers, date, venue, address, price, link and status. Its response schema has no field for a description, so concert pages carry no AI-written text. The crawler respects robots.txt, sends its own User-Agent with a link to a page that explains the collector, and waits several seconds between requests to one domain.

In short, the model is the last resort and works on a nightly ration, which keeps the cost of a full national listing close to zero.

## What tradeoffs shaped the collector?

| Option considered | Decision | Reason |
|---|---|---|
| Use the language model for every page | Rejected | Feeds, JSON-LD and plugin APIs give the same data at no cost and with no model errors |
| Let the model write concert descriptions | Rejected | Only facts are extracted; concert pages carry no AI-written copy |
| Copy event posters into own storage | Rejected | Copyright; images come only from sources that license them for display |
| Approval queue for collected concerts | Rejected | Thousands of entries are too many to review; an admin "hide" button is the safety valve |
| Separate table for collected concerts | Rejected | The listing, favourites and reminders would have to handle two data sources |
| Attach collected concerts to profiles by name automatically | Rejected | Two bands with the same name would receive each other's concerts and alerts |
| Delete cancelled or missing concerts at once | Rejected | One ticketing-site outage would empty the listing |
| Discover new venues weekly through a search API | Rejected | An earlier attempt ran out of search quota, and of 540 sources it had marked trusted only 21 held up on checking |
| Collect twice a day | Rejected | Doubles traffic to ticketing sites and model usage |

## What is the technology stack?

- **App and API:** Next.js on Cloudflare Workers through OpenNext, and a Hono API on Workers with types shared through Hono's RPC client.
- **Data:** PostgreSQL on Neon with Drizzle ORM; R2 for photos.
- **Real time and background work:** chat on Durable Objects with hibernating WebSockets, Cloudflare Queues for the collector, Web Push written without libraries (RFC 8291 and VAPID).
- **AI:** Workers AI for venue pages and genres (Llama 4 Scout, answering only with a genre from a fixed list); OpenAI's gpt-5-mini for the help assistant.

## Steps: how the MVP was built

1. **Discovery.** One session fixed the scope, roles, stack and what moves to version 2.
2. **MVP scope in 17 phases.** Accounts, profiles, calendar, search, quotes, booking, listing and map, chat, ratings, admin panel. Finished two weeks after the first commit.
3. **Post-MVP change package.** 14 changes after the MVP review, including versioned offers, push notifications and concert reminders.
4. **Security and consent.** Rate limits, a test that every private API route returns 401 to anonymous users, two-factor sign-in, a consent banner.
5. **Concert collector.** Nightly collection from 178 sources with deduplication and run reports.
6. **Visibility.** Sitemap, JSON-LD for events, security headers, uptime monitoring.

## What is out of scope in version 1?

Money does not move through the platform: no commissions, in-app tips or paid promotion. Each booking still records the agreed amount, status and confirmation time, so adding a commission later means adding a step, not rebuilding the data model.

## FAQ

### What is a booking marketplace for live musicians?
It is a platform where venues, event organisers and private clients find musicians, see their prices and free dates, and book a performance. This one, built for the Polish market, also runs a public concert listing so fans can find live music near them.

### How long did it take to build the MVP?
The MVP scope was finished two weeks after the first commit in August 2026. The project reached 228 commits over about ten weeks by mid-October 2026.

### How does the platform calculate the cost of travel?
The musician sets a free-travel radius and a rate per kilometre. The platform charges only the kilometres beyond the radius, doubled for the return trip, once per gig.

### Can two clients book the same musician for the same evening?
No. A PostgreSQL exclusion constraint rejects any confirmed booking that overlaps an existing one, so of two simultaneous confirmations one succeeds and the other is refused.

### Where do the concerts on the listing come from?
From musicians on the platform and from a nightly collector that reads 5 ticketing sources and 173 venue and city-calendar pages in 42 Polish cities. Duplicates merge into one entry with a ticket button per seller.

### Does the platform use AI?
Yes, in three narrow places: reading venue pages that publish no structured data, assigning genres from a fixed list, and a help assistant. The models extract or classify; they write no concert descriptions.

### Does the platform handle payments?
Not in version 1. Clients and musicians settle the fee outside the app, but each booking stores the amount and status so a commission can be added later.

## Last updated

2026-10-12
