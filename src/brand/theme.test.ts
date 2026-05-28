import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const globalsCss = readFileSync(
	resolve(import.meta.dirname, "..", "styles", "globals.css"),
	"utf8",
);

describe("Tailwind theme tokens", () => {
	it("declares the Auditmos accent color as a Tailwind v4 token", () => {
		expect(globalsCss).toContain("@theme");
		expect(globalsCss).toContain("--color-brand-accent: #04d9ff;");
	});

	it("declares a system-stack sans font token", () => {
		expect(globalsCss).toContain("--font-sans:");
		expect(globalsCss).toContain("system-ui");
	});
});
