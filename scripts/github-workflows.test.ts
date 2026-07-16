import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ciWorkflow = readFileSync(
	resolve(import.meta.dirname, "..", ".github", "workflows", "ci.yml"),
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
