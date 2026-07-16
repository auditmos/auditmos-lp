import { site } from "@/brand/site";
import type { ProjectData } from "@/projects/schema";
import { privacyPage, type SitePage, staticPages } from "./pages";

export interface MarkdownProjectEntry {
	body?: string;
	data: Pick<ProjectData, "slug" | "summary" | "title">;
}

export interface MarkdownMirrorPage extends SitePage {
	markdownPath: `/${string}.md`;
	markdown: string;
}

type StaticPagePath = (typeof staticPages)[number]["path"];

const staticMarkdownBodyByPath = {
	"/": `
Don't take my word for it. Read the audits.

Auditmos is the independent technical practice of Tomasz Kowalczyk. Since 2021 it has published 24 audit reports for anyone to read — and builds software the same way it audits it: assuming someone will inspect the work later.

## Proof

- 24 public audit reports since 2021: https://github.com/auditmos/audits
- Software architecture for a 3,000+ GPU compute network spanning nine European countries.
- 2 own products live.
- 7 open-source repositories: https://github.com/auditmos

## Services

- Software development — senior delivery built as if it will be audited, because the author knows exactly what an auditor finds.
- Security audits — findings with impact, reproduction, and remediation, written to the same standard as the public reports.
- R&D services — technical validation, prototypes, feasibility studies, and grant work that turn uncertain bets into evidence.

## For agencies

White-label or named senior capacity for agencies and consultancies. The client stays the agency's — in writing. See /partners.md.
`,
	"/software-development": `
Build reliable software without turning every delivery risk into your team's problem.

Auditmos takes on focused engineering work where senior judgment matters: product foundations, internal systems, integrations, technical rescue, and codebases that need to be left understandable after delivery.

## Best for

- Founders who need senior implementation without building a full internal team first.
- CTOs dealing with brittle systems, unclear ownership, or a delivery deadline that needs fewer surprises.
- Teams that need software built with security, maintainability, and procurement context in mind.

## Product delivery

From scoped product slices to internal tools, the work is planned around usable increments, clear tradeoffs, and code that another senior engineer can pick up later.

## System repair

Auditmos can stabilize fragile services, unwind risky integrations, and turn opaque behavior into documented, testable paths before the next feature push.

## Technical due care

Implementation decisions are made with the audit trail in mind: architecture notes, dependency choices, and risk calls are explicit enough for buyers and stakeholders.

## Deliverables

- Production-ready application slices with source, tests, and deployment notes.
- Architecture and implementation notes for maintainers and reviewers.
- Integration plans for third-party systems, APIs, and internal tools.
- Stabilization reports covering risks found, fixes shipped, and remaining decisions.
`,
	"/r-and-d": `
Turn technical uncertainty into evidence your stakeholders can use.

Auditmos supports applied R&D work where the output must survive review: prototypes, feasibility studies, technical validation, and work-package evidence for grants or innovation programs.

## Best for

- Research teams that need an implementation partner for a technical work package.
- Companies validating whether an idea is technically feasible before committing a full build budget.
- Grant applicants that need credible engineering evidence, assumptions, and risk notes.

## Feasibility

The first goal is to reduce ambiguity: define the question, build the smallest useful proof, and document what the result does and does not prove.

## Prototype delivery

Prototypes are built to answer a real technical question, not to impress in isolation. Code, assumptions, limits, and next steps are handed over together.

## Review evidence

Outputs are written for funders, partners, and technical reviewers: concise enough to read, specific enough to defend.

## Deliverables

- Technical feasibility notes with assumptions, risks, and validation outcomes.
- Prototype code or demonstrators scoped to the research question.
- Architecture sketches and implementation options for next-phase delivery.
- Grant or partner-ready technical summaries and work-package input.
`,
	"/security-audits": `
Find exploitable risk before buyers, attackers, or regulators do.

Auditmos security audits focus on practical findings, defensible severity, and reports that help technical teams fix issues while giving business stakeholders the evidence they need.

Since 2021, 24 audit reports have been published in public at https://github.com/auditmos/audits — read them to judge the reporting standard before any engagement. Client reports stay confidential unless the client chooses otherwise; they are simply written as if they could be public.

## Best for

- CISOs and CTOs preparing for procurement, compliance review, or a high-stakes launch.
- Teams that need actionable audit findings rather than a generic scanner export.
- EU buyers who need clear vendor-vetting and risk documentation.

## Scope clarity

The audit starts with the surfaces that matter: application flows, APIs, infrastructure assumptions, data exposure, and the business impact of likely failures.

## Actionable findings

Each issue is written with impact, reproduction detail, remediation guidance, and severity reasoning so engineers can act without a second discovery phase.

## Review support

Reports are structured for technical owners and procurement readers, with concise summaries and enough detail to support vendor or compliance review.

## Deliverables

- Security audit report with severity, impact, reproduction notes, and remediation guidance.
- Executive summary for procurement, leadership, or partner review.
- Risk register of accepted, mitigated, and unresolved findings.
- Retest notes when remediation validation is in scope.
`,
	"/about": `
Auditmos is a small, independent technical company for software delivery, applied R&D, and security work where judgment, evidence, and clear ownership matter.

The company works with teams that already have a real problem to solve: shipping a system, validating an uncertain technical path, or getting clear evidence about security risk before a business decision.

## Who runs it

Auditmos is the practice of Tomasz Kowalczyk (https://www.linkedin.com/in/kowalczykt/). The person you brief is the person who does the work, and there is one name on every deliverable.

## Substance first

Auditmos keeps the public surface focused on services, work, legal identity, and contact paths rather than broad marketing claims.

## Technical ownership

Engagements are scoped around clear outcomes, explicit tradeoffs, and artifacts that a client team can maintain or defend after handoff.

## Business-aware evidence

Technical output is written so engineering, leadership, procurement, and external reviewers can make the decision in front of them.

## Legal entity

Auditmos OÜ

Registration: 17025406

VAT: EE102758111

Address: Narva mnt 13-27, 10151 Tallinn, Estonia

Contact: contact@auditmos.com
`,
	"/projects": `
Selected Auditmos software, R&D, and security audit projects, including named and anonymised work.

Named work appears where permission exists. Anonymised sector case studies use the same pipeline when confidentiality matters.

Project detail pages include context, client display information, year, stack, links where available, and the case study body authored in Markdown.
`,
	"/open-source": `
Auditmos publishes open-source work under the github.com/auditmos organization: templates, tooling, and public audit resources.

The site shows a focused selection with descriptions, primary language, and star count. The full public inventory remains available on GitHub.

Watch our work on [github.com/auditmos](https://github.com/auditmos).
`,
	"/contact": `
Use this page to contact Auditmos about software development, R&D, or security audit work.

The contact form asks for name, email address, and message, then protects the submission with Cloudflare Turnstile. Successful submissions send a notification to Auditmos and a confirmation email to the submitter.

If the form is unavailable, email contact@auditmos.com directly.
`,
	"/partners": `
Put Auditmos in front of your client. Keep your name on the work.

Subcontracting senior work is a reputational bet: the agency's name is on the deliverable, but someone else's hands are on the keyboard. This page describes how Auditmos makes that bet safe for agencies and consultancies.

## The deal

- Your client stays yours. No pitching, no poaching, no side deals — and it can be put in writing.
- White-label or named. The agency's brand on the deliverable with Auditmos invisible, or openly introduced as the external senior. The agency's call.
- Senior only. The person you brief is the person who builds. There is no bench behind the curtain.
- A paper trail by default. Architecture notes, tests, and deployment documentation the end client can inspect.
- Verifiable in advance. 24 audit reports are public at https://github.com/auditmos/audits — read them before putting Auditmos in a deck.

## Engagement shapes

- Scoped delivery: a feature, integration, or system built end to end and handed over documented.
- Rescue and stabilization: a slipping or fragile project brought back to predictable.
- Pre-delivery review: the work is audited before the end client sees it.
- Security audits under your engagement: audit capacity agencies can resell, reported to the public-report standard.

## Start

Describe the client work you can't risk: /contact.md — or email contact@auditmos.com.
`,
	"/privacy": privacyPage.sections
		.map((section) => [`## ${section.heading}`, "", ...section.body].join("\n\n"))
		.join("\n\n"),
} satisfies Record<StaticPagePath, string>;

function routeToMarkdownPath(path: SitePage["path"]): MarkdownMirrorPage["markdownPath"] {
	if (path === "/") return "/index.md";
	return `${path}.md`;
}

function pageMarkdown(page: SitePage, body: string): string {
	return [`# ${page.title}`, "", body.trim(), ""].join("\n");
}

function projectRoute(project: MarkdownProjectEntry): SitePage {
	return {
		path: `/projects/${project.data.slug}`,
		title: project.data.title,
		description: project.data.summary,
	};
}

function projectMarkdown(project: MarkdownProjectEntry): string {
	return [`# ${project.data.title}`, "", (project.body ?? "").trim(), ""].join("\n");
}

export function getMarkdownMirrorPages(
	projects: readonly MarkdownProjectEntry[],
): MarkdownMirrorPage[] {
	const staticMarkdownPages = staticPages.map((page) => ({
		...page,
		markdownPath: routeToMarkdownPath(page.path),
		markdown: pageMarkdown(page, staticMarkdownBodyByPath[page.path]),
	}));
	const projectMarkdownPages = projects.map((project) => {
		const page = projectRoute(project);

		return {
			...page,
			markdownPath: routeToMarkdownPath(page.path),
			markdown: projectMarkdown(project),
		};
	});

	return [...staticMarkdownPages, ...projectMarkdownPages];
}

export function findMarkdownMirrorPage(
	pages: readonly MarkdownMirrorPage[],
	path: SitePage["path"],
): MarkdownMirrorPage {
	const page = pages.find((candidate) => candidate.path === path);

	if (!page) {
		throw new Error(`No markdown mirror configured for ${path}`);
	}

	return page;
}

export function renderLlmsTxt(pages: readonly MarkdownMirrorPage[]): string {
	return [
		"# Auditmos",
		"",
		site.defaultDescription,
		"",
		`Contact: ${site.contactEmail}`,
		"",
		"## Pages",
		"",
		...pages.map(
			(page) => `- [${page.title}](${site.url}${page.markdownPath}): ${page.description}`,
		),
		"",
	].join("\n");
}

export function markdownResponse(markdown: string): Response {
	return new Response(markdown, {
		status: 200,
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
		},
	});
}
