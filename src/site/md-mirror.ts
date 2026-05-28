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
Auditmos helps EU-based founders, CTOs, CISOs, and research teams ship reliable software, validate technical bets, and document security risk clearly enough for procurement, grants, and executive review.

## Services

- Software development for reliable systems, internal tools, integrations, and product delivery.
- R&D services for technical validation, prototypes, feasibility studies, and grant work.
- Security audits for actionable findings, defensible severity, and procurement-ready reporting.

## How Auditmos works

The public site is intentionally narrow because most visitors arrive through referral, partner conversation, or procurement review. These pages answer what Auditmos does, where the company is registered, and what kind of technical work it can credibly carry.
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
Auditmos is a small technical company built for serious software, R&D, and security work.

The company works with teams that already have a real problem to solve: shipping a system, validating an uncertain technical path, or getting clear evidence about security risk before a business decision.

## Substance first

Auditmos keeps the public surface focused on services, work, legal identity, and contact paths rather than broad marketing claims.

## Technical ownership

Engagements are scoped around clear outcomes, explicit tradeoffs, and artifacts that a client team can maintain or defend after handoff.

## EU vendor clarity

Company identity, privacy posture, and contact information are kept visible because procurement and due diligence should not require guesswork.

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
