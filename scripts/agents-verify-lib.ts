/**
 * Pure helpers for `pnpm agents:verify`.
 *
 * The scan report is an inventory of agent-readiness checks, most of which
 * describe protocols this site does not implement and never will. A raw
 * pass/fail count is therefore meaningless — 8 failures is the healthy steady
 * state. What matters is whether the checks backed by something the site
 * actually ships have stopped passing.
 *
 * So the contract is a declared list of checks that must pass, and the verdict
 * is the diff against it: a regression fails the command, and a check that
 * started passing on its own is reported so the list can be widened rather
 * than silently drifting behind reality.
 *
 * The network call lives in `agents-verify.ts`; everything here is testable
 * without touching it.
 */

export interface ScanCheck {
	status: string;
	message?: string;
}

export interface ScanReport {
	checks?: Record<string, Record<string, ScanCheck>>;
}

export interface RequiredCheck {
	/** `<group>.<name>` as the scanner nests them, e.g. `discoverability.dnsAid`. */
	id: string;
	/** Why this site is expected to pass it — printed when it regresses. */
	backedBy: string;
	/**
	 * Required only on the apex. DNS-AID records live at `_index._agents.auditmos.com`
	 * and no equivalent exists per environment, so staging cannot pass this.
	 */
	apexOnly?: boolean;
}

export interface CheckOutcome {
	id: string;
	status: string;
	message: string;
	backedBy?: string;
}

export interface VerifyResult {
	ok: boolean;
	/** Declared as required, not passing. These fail the command. */
	regressions: CheckOutcome[];
	/** Passing but not declared — widen REQUIRED_CHECKS, or the guard misses them. */
	undeclared: CheckOutcome[];
	/** Declared but absent from the report, usually a scanner rename. */
	missing: string[];
	/** Required checks skipped because the target is not the apex. */
	skipped: string[];
	passing: number;
}

/**
 * The checks this site is expected to pass, each tied to the thing that makes
 * it pass. Everything absent from this list is a protocol the site does not
 * implement — those failing is the intended state, not a defect.
 */
export const REQUIRED_CHECKS: readonly RequiredCheck[] = [
	{ id: "discoverability.robotsTxt", backedBy: "public/robots.txt" },
	{ id: "discoverability.sitemap", backedBy: "src/pages/sitemap.xml.ts" },
	{ id: "discoverability.linkHeaders", backedBy: "src/site/discovery-headers.ts" },
	{
		id: "discoverability.dnsAid",
		backedBy: "_index._agents.auditmos.com DNS records",
		apexOnly: true,
	},
	{
		id: "contentAccessibility.markdownNegotiation",
		backedBy: "src/site/markdown-negotiation.ts + assets.run_worker_first",
	},
	{
		id: "discovery.mcpServerCard",
		backedBy: "src/mcp/server-card.ts + src/pages/.well-known/mcp/server-card.json.ts",
	},
	{
		id: "discovery.apiCatalog",
		backedBy: "src/agents/surfaces.ts + src/pages/.well-known/api-catalog.ts",
	},
	{
		id: "discovery.oauthDiscovery",
		backedBy:
			"src/oauth/server.ts + src/pages/.well-known/{openid-configuration,oauth-authorization-server}.ts",
	},
	{
		// The scanner requires `resource` to match the host it scanned, which is
		// why the OAuth documents name the deployed origin rather than the
		// canonical production URL every other surface uses.
		id: "discovery.oauthProtectedResource",
		backedBy: "src/oauth/server.ts + src/pages/.well-known/oauth-protected-resource/mcp.ts",
	},
	{
		// The scanner parses the H1 for the document's own name, so the heading
		// is load-bearing, not decoration.
		id: "discovery.authMd",
		backedBy: "src/oauth/auth-doc.ts + src/pages/auth.md.ts",
	},
	{
		id: "discovery.a2aAgentCard",
		backedBy: "src/agents/agent-card.ts + src/pages/.well-known/agent-card.json.ts",
	},
	{
		id: "discovery.agentSkills",
		backedBy: "src/agents/skills.ts + src/pages/.well-known/agent-skills/**",
	},
	{ id: "botAccessControl.robotsTxtAiRules", backedBy: "public/robots.txt" },
	{
		id: "botAccessControl.contentSignals",
		backedBy: "CONTENT_SIGNAL in src/site/discovery-headers.ts",
	},
];

function flattenChecks(report: ScanReport): Map<string, ScanCheck> {
	const flat = new Map<string, ScanCheck>();

	for (const [group, checks] of Object.entries(report.checks ?? {})) {
		for (const [name, check] of Object.entries(checks ?? {})) {
			if (check && typeof check.status === "string") flat.set(`${group}.${name}`, check);
		}
	}

	return flat;
}

/** True when `siteUrl` is the apex the DNS-AID records are published on. */
export function isApex(siteUrl: string, apexUrl: string): boolean {
	try {
		return new URL(siteUrl).hostname === new URL(apexUrl).hostname;
	} catch {
		return false;
	}
}

export function verifyScan(
	report: ScanReport,
	options: { apex: boolean; required?: readonly RequiredCheck[] },
): VerifyResult {
	const required = options.required ?? REQUIRED_CHECKS;
	const found = flattenChecks(report);
	const declared = new Set(required.map((check) => check.id));

	const regressions: CheckOutcome[] = [];
	const missing: string[] = [];
	const skipped: string[] = [];

	for (const check of required) {
		if (check.apexOnly && !options.apex) {
			skipped.push(check.id);
			continue;
		}

		const result = found.get(check.id);

		// A declared check the report does not mention is a failure too: the
		// scanner renamed or dropped it and the guard is no longer watching.
		if (!result) {
			missing.push(check.id);
			continue;
		}

		if (result.status !== "pass") {
			regressions.push({
				id: check.id,
				status: result.status,
				message: result.message ?? "",
				backedBy: check.backedBy,
			});
		}
	}

	const undeclared = [...found.entries()]
		.filter(([id, check]) => check.status === "pass" && !declared.has(id))
		.map(([id, check]) => ({ id, status: check.status, message: check.message ?? "" }));

	return {
		ok: regressions.length === 0 && missing.length === 0,
		regressions,
		undeclared,
		missing,
		skipped,
		passing: [...found.values()].filter((check) => check.status === "pass").length,
	};
}

export function formatVerifyReport(result: VerifyResult, target: string): string {
	const lines = [`Agent readiness — ${target}`, ""];

	for (const check of result.regressions) {
		lines.push(`  REGRESSED  ${check.id} (${check.status})`);
		lines.push(`             ${check.message}`);
		lines.push(`             backed by: ${check.backedBy}`);
	}

	for (const id of result.missing) {
		lines.push(`  MISSING    ${id} — not present in the report; scanner renamed it?`);
	}

	for (const id of result.skipped) {
		lines.push(`  SKIPPED    ${id} — apex-only, not expected on this host`);
	}

	for (const check of result.undeclared) {
		lines.push(`  NEW PASS   ${check.id} — add it to REQUIRED_CHECKS to guard it`);
	}

	if (result.regressions.length === 0 && result.missing.length === 0) {
		lines.push(`  OK         every required check passes (${result.passing} passing in total)`);
	}

	return `${lines.join("\n")}\n`;
}
