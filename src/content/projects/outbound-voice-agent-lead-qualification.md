---
title: "Outbound voice agent for lead qualification: a consent-first calling bot built in 7 weeks"
slug: "outbound-voice-agent-lead-qualification"
summary: "A Polish company that sells home heating and energy upgrades holds a contact base of well over ten thousand people who once asked about a government retrofit subsidy."
provenance: "client-work"
capabilities:
  - "software"
  - "applied-r-and-d"
client:
  sector: "Home heating and energy upgrades"
industry: "Home energy retrofit"
year: 2026
stack:
  - "Python"
  - "LiveKit Agents"
  - "Groq Whisper"
  - "ElevenLabs"
  - "Claude"
  - "PostgreSQL"
featured: false
order: 5
---

## TLDR
A Polish company that sells home heating and energy upgrades holds a contact base of well over ten thousand people who once asked about a government retrofit subsidy. We built a voice agent that calls each of them, says in its first sentence that it is a virtual assistant, asks whether the topic is still current, and hands interested people to a human advisor. Everyone else is closed with a status in the client's CRM, with no human involved. The bot can only say sentences from a human-approved list, a rule-based classifier decides every outcome, and one flag stops the whole campaign within a single scheduler cycle. Two people built it in seven weeks; it is pilot-ready and has completed the full loop on a live call.

## Key facts
- Built in 7 weeks by 2 contributors, Q3 2026.
- Target base: a five-figure list of past contacts, exported from the client's CRM as a spreadsheet.
- Stack: Python, LiveKit Agents, Groq Whisper for speech-to-text, ElevenLabs for speech, PostgreSQL for state, a SIP trunk for calls. Claude is wired in but off by default.
- Consent filter is fail-closed: a row without an explicit positive consent flag never enters the queue.
- The bot's vocabulary is a whitelist of approved sentences, checked by a CI test that walks the whole conversation tree.
- Kill switch: one flag, read every scheduler cycle, default off.
- Budget estimate for the full base: about 3,400 PLN, range 1,900–7,000 PLN, roughly 0.68 PLN per answered call.
- AI disclosure ("virtual assistant") is in the first sentence and enforced by a guard, as Article 50 of the EU AI Act requires.
- Status: pilot-ready. Full loop verified on a live call, result confirmed inside the client's CRM.

## What is this outbound voice agent?
It is a phone bot that makes outgoing calls to a list of known contacts and sorts them. Its only job is to learn whether a person is still interested in replacing their home heating under a subsidy programme. If yes, a human advisor calls back. If no, the record is closed.

**Quick answer:** an automated opener that qualifies a lead base and hands the warm leads to people.

The conversation is short by design: a greeting with an identity check, one question about interest, a closing line. Prices, timelines and conditions are deferred to the advisor.

## What problem does it solve?
Working a five-figure list by hand means a person dials each number to ask two or three questions. Each call can end in voicemail, a wrong number, a polite no, or the one answer that matters. The bot absorbs the first three and passes only the "yes" to an advisor.

**Key fact:** the bot never closes a sale. It qualifies and hands over.

## Why is consent the first gate, not a formality?
Polish law (Article 398 of the Electronic Communications Law) bans automated calling systems for marketing without the recipient's prior consent. A bot that dials and delivers an offer is such a system by definition, and the burden of proof sits with the caller.

So the import step is fail-closed. Each spreadsheet row needs an explicit positive value in the consent column to enter the queue. A missing column, an empty cell or an ambiguous value means no call.

**In short:** the size of the base is not the size of the campaign. The number of rows with provable consent is.

## How does a single call flow through the system?
A call passes through seven stages, each owned by a separate piece of code.

1. **Import.** The CRM export is de-duplicated by phone number and filtered for consent. It loads in batches, so only records being worked sit in the database.
2. **Scheduling.** A scheduler keeps a fixed number of lines busy inside a calling window, ramps up gradually, and makes up to three attempts per number.
3. **Dialling.** A SIP trunk places the call through LiveKit. Before each pick, the scheduler re-reads the kill switch and the window.
4. **Answering-machine detection.** In the first seconds, code decides whether a human or voicemail picked up, before the opener plays to a recorder.
5. **Conversation.** Speech-to-text hears the person, a deterministic state machine picks the next approved sentence, text-to-speech says it.
6. **Classification.** A rule-based classifier maps the call to a business event: interested, not interested, opt-out, wrong person, deceased, callback, escalated, or unresolved.
7. **Hand-back.** The record's final state and the CRM message are written in one database transaction. A separate dispatcher delivers the message with retries and an idempotency key.

**Key fact:** the CRM exchange is one-way. The list comes in as a file; only a status per record goes back.

## Why does code decide the outcome instead of the model?
The status sent to the CRM triggers real actions: an advisor calls someone, or a number is blocked for good. Neither should depend on whether a language model produced the right label. The classifier is a set of rules over the transcript, and it recognises a refusal only when it is explicit. Two extra end states cover what a script cannot settle: "escalated" when the person asked more than the bot may answer, and "unresolved" when the bot ran out of clarifying turns and a human must review the transcript.

## Why is the bot's vocabulary a whitelist?
The client asked for certainty that the bot would never state an amount, a deadline or a promise. Blacklist guards cannot give that; they block only the shapes someone predicted. During development, an amount guard let through a number spelled out in words for half a day, because it only matched digits.

A whitelist can. Every sentence the bot may say lives in one file that a human signs off, and a CI test walks the whole conversation tree to confirm nothing else can be spoken.

**Quick answer:** the bot cannot improvise, and that is the feature.

## How does it compare with the alternatives we rejected?

| | Deterministic whitelist (chosen) | LLM-generated replies | Voice-to-voice model |
|---|---|---|---|
| What the bot can say | Only approved sentences | Anything the prompt allows | Anything the model produces |
| Where safety checks run | Before speech is synthesised | Before speech is synthesised | After the person has heard it |
| Latency per turn (live test) | Inside the budget | Over the budget | Comparable once retrieval is removed |
| Polish gender forms | From a name dictionary; unknown names get a neutral form | Misgendered a contact in the live test | Left to the prompt |
| Invented requirements | Impossible | Asked for a surname the script may not collect | Possible |
| Who decides the outcome | Rule-based classifier | Classifier over model output | Classifier over transcript, after the fact |

The voice-to-voice option lost on one point: guards need a moment when the text exists but the audio does not. In a speech-to-speech model that moment never occurs, so prevention becomes detection.

## How is a live campaign kept under control?
**Key fact:** a person with no access to the code can stop the campaign in minutes.

The campaign flag is read on every scheduler cycle, so flipping it needs no restart and no deployment. Connected calls finish; no new call starts. Its default is off, because a system that starts calling thousands of people after a fresh checkout is built wrong. Transcripts are written raw, one line per turn, and personal data is redacted before a reviewer or the QA judge sees them.

Retention defaults to thirty days, after which numbers on closed records are anonymised and old transcripts deleted. Recording sits behind its own flag, off by default, and cannot produce a file unless the greeting contains a recording notice.

## Steps: what to demand from an outbound voice bot before it dials
1. Prove consent per record from the data, not from a statement.
2. Put the AI disclosure in the first sentence and enforce it in code.
3. Define what the bot may say as a finite, human-approved list, and test that nothing else can be spoken.
4. Let code, not the model, decide the outcome that goes back to the CRM.
5. Treat opt-out as terminal: acknowledge, record, never call again.
6. Make the kill switch a runtime setting, default off, read continuously.
7. Write the result and the CRM message in one transaction, then deliver with retries and idempotency.
8. Detect voicemail with a bias toward "human".
9. Set retention in days and schedule it.

## FAQ

### What is an outbound voice agent for lead qualification?
It is software that places phone calls to a list of contacts, holds a short scripted conversation, and sorts each person into an outcome such as interested, not interested or opt-out. The interested ones are handed to a human. It replaces the first, repetitive call, not the sales conversation.

### Is it legal for a bot to make marketing calls in Poland?
Only with the recipient's prior consent. Article 398 of the Polish Electronic Communications Law bans automated calling systems for commercial information without it, and the caller carries the burden of proof. Since 2 August 2026, Article 50 of the EU AI Act also requires telling the person they are talking to an AI system at the first interaction. This project enforces both in code.

### Why doesn't the bot use a language model to talk?
A model can be switched on, but a live comparison showed it misgendering a contact, asking for data the script may not collect, and missing the latency budget. The deterministic variant did none of that. The conversation has around eight paths, so a state machine with approved sentences covers it.

### How does the bot know whether it reached voicemail?
Answering-machine detection runs in the first seconds of the call, inside the project's own code, because SIP trunking delivers raw audio and nothing more. The threshold is asymmetric: when in doubt, it assumes a human. Hanging up on a person cannot be undone; wasting one of three attempts on a machine can.

### What happens when someone says "stop calling me"?
The bot acknowledges the objection, says it will not call again, apologises, and ends the call. No offer follows. The record moves to a terminal opt-out state, and a repeat import cannot revive it. The code treats this as an obligation under GDPR Article 21, not as a conversational branch.

### How long did it take to build?
Seven weeks from first commit to a pilot-ready system, with two contributors. Part of the core, such as the guard layer and the Polish speech handling, was carried over from an earlier inbound agent for the same client, which is why the timeline is short.

### What does a campaign like this cost to run?
The pre-pilot estimate for the full base is about 3,400 PLN, with a range of 1,900 to 7,000 PLN depending on answer rate and call length. That works out to roughly 0.68 PLN per answered call in the base case. Speech synthesis is the largest single line item, followed by telephony minutes and the voice platform.

### When should you not use this approach?
When consent per record cannot be proven from the data, because the system will correctly produce zero calls. When the conversation needs advice, pricing or negotiation, because the bot defers all of that to a human. And when the script has more paths than a person can approve sentence by sentence.

### Does it record the calls?
Only behind a flag that is off by default. When enabled, a recording exists only if the greeting includes a recording notice, and only human conversations above a minimum length are kept. Voicemail, unanswered and short calls are deleted along with their intermediate files.

## Last updated
2026-09-07
