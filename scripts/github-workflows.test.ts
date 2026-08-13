import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflow = (name: string): string =>
	readFileSync(resolve(import.meta.dirname, "..", ".github", "workflows", name), "utf8");

const ciWorkflow = workflow("ci.yml");
const gatesWorkflow = workflow("security-gates.yml");
const mtaSts = readFileSync(
	resolve(import.meta.dirname, "..", "src", "mail", "mta-sts.ts"),
	"utf8",
);
const mtaStsTest = readFileSync(
	resolve(import.meta.dirname, "..", "src", "mail", "mta-sts.test.ts"),
	"utf8",
);

describe("ci.yml", () => {
	it("runs the Phase 1 validation command on pull requests", () => {
		expect(ciWorkflow).toContain("pull_request:");
		expect(ciWorkflow).toContain("pnpm types && pnpm lint && pnpm knip && pnpm test");
	});

	it("validates pushes to main without deploying", () => {
		expect(ciWorkflow).toContain("branches: [main]");
		expect(ciWorkflow).not.toContain("wrangler deploy");
	});
});

describe("security-gates.yml", () => {
	it("runs on a schedule, because the gates fire on dates nobody is watching", () => {
		expect(gatesWorkflow).toContain("schedule:");
		expect(gatesWorkflow).toContain("workflow_dispatch:");
		expect(gatesWorkflow).toContain("pnpm run security:gates");
	});

	it("never changes DNS — the mail policies are published by hand", () => {
		expect(gatesWorkflow).not.toContain("api.cloudflare.com");
		expect(gatesWorkflow).not.toContain("CLOUDFLARE_DNS_API_TOKEN");
	});

	it("does not deploy anything either — a PR is as far as it goes", () => {
		// `pnpm deploy:mta-sts` does appear, in the PR checklist a human works
		// through. What must not appear is a step that runs it.
		expect(gatesWorkflow).not.toContain("wrangler deploy");
		expect(/run:[^\n]*\bdeploy\b/.test(gatesWorkflow)).toBe(false);
	});

	/**
	 * The job rewrites these two lines with `perl -i -pe`, which is silent when
	 * its pattern stops matching. The workflow greps to catch that, but only at
	 * 08:00 on the day the gate opens — months from now, in a job nobody is
	 * watching. These assertions fail in the PR that renames the constant.
	 */
	it("targets a constant that still exists, spelled the way it greps for", () => {
		expect(mtaSts).toContain('export const MTA_STS_MODE = "testing";');
		expect(gatesWorkflow).toContain('export const MTA_STS_MODE = "testing";');
		expect(gatesWorkflow).toContain('export const MTA_STS_MODE = "enforce";');
	});

	it("targets a test assertion that still exists", () => {
		expect(mtaStsTest).toContain('expect(MTA_STS_MODE).toBe("testing");');
		expect(gatesWorkflow).toContain('expect(MTA_STS_MODE).toBe("enforce");');
	});

	it("tells the human to read the reports it cannot read itself", () => {
		// Both mail gates depend on a mailbox this workflow has no credentials
		// for. A `due` gate means the timer elapsed, never that mail is healthy.
		expect(gatesWorkflow).toContain("dmarc@auditmos.com");
		// The other half a machine cannot do: the DNS id bump that makes a mode
		// change visible to senders at all.
		expect(gatesWorkflow).toMatch(/bump the `id` in the `_mta-sts` TXT record/i);
	});
});
