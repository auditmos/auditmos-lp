import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envExample = readFileSync(resolve(import.meta.dirname, "..", ".env.example"), "utf8");

describe(".env.example", () => {
	it("documents the Cloudflare Web Analytics build token", () => {
		expect(envExample).toContain("CLOUDFLARE_WEB_ANALYTICS_TOKEN=");
	});
});
