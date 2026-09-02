import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderThemeScript, THEME_STORAGE_KEY } from "./theme";

const globalsCss = readFileSync(
	resolve(import.meta.dirname, "..", "styles", "globals.css"),
	"utf8",
);

function relativeLuminance(hex: string): number {
	const [red = 0, green = 0, blue = 0] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(
		(channel) => {
			const value = Number.parseInt(channel, 16) / 255;
			return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
		},
	);

	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
	const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
	const darker = Math.min(relativeLuminance(first), relativeLuminance(second));

	return (lighter + 0.05) / (darker + 0.05);
}

function lightHexFor(token: string): string {
	return (
		new RegExp(`--color-${token}: light-dark\\((#[0-9a-f]+),`, "i").exec(globalsCss)?.[1] ?? ""
	);
}

describe("Tailwind theme tokens", () => {
	it("declares the Auditmos accent color as a Tailwind v4 token", () => {
		expect(globalsCss).toContain("@theme");
		expect(globalsCss).toContain("--color-brand-accent: #04d9ff;");
	});

	it("declares a system-stack sans font token", () => {
		expect(globalsCss).toContain("--font-sans:");
		expect(globalsCss).toContain("system-ui");
	});

	it("keeps the existing visible blue-black values in dark mode", () => {
		const darkValues = [
			"oklch(0.97 0.006 220)",
			"oklch(0.922 0.008 220)",
			"oklch(0.87 0.01 220)",
			"oklch(0.708 0.012 220)",
			"oklch(0.556 0.014 220)",
			"oklch(0.439 0.015 220)",
			"oklch(0.371 0.015 220)",
			"oklch(0.269 0.014 220)",
			"oklch(0.205 0.012 220)",
			"oklch(0.148 0.01 220)",
		];

		for (const darkValue of darkValues) {
			expect(globalsCss).toContain(`, ${darkValue})`);
		}
	});

	it("lets System follow the OS while explicit choices override it", () => {
		expect(globalsCss).toContain(":root {\n\tcolor-scheme: light dark;");
		expect(globalsCss).toContain('html[data-theme="light"] {\n\tcolor-scheme: light;');
		expect(globalsCss).toContain('html[data-theme="dark"] {\n\tcolor-scheme: dark;');
		expect(globalsCss).toContain("--color-neutral-950: light-dark(");
		expect(globalsCss).toContain("--color-brand-ink: light-dark(");
	});

	it("keeps light-theme text and control boundaries above WCAG contrast thresholds", () => {
		const canvas = lightHexFor("neutral-950");
		const textTokens = [
			"brand-ink",
			"neutral-50",
			"neutral-100",
			"neutral-200",
			"neutral-300",
			"neutral-400",
			"neutral-500",
			"neutral-600",
		];

		for (const token of textTokens) {
			expect({ token, passes: contrastRatio(lightHexFor(token), canvas) >= 4.5 }).toEqual({
				token,
				passes: true,
			});
		}

		expect(contrastRatio(lightHexFor("neutral-700"), canvas)).toBeGreaterThanOrEqual(3);
	});
});

describe("renderThemeScript", () => {
	it("encodes System as the safe default and persists only explicit overrides", () => {
		const script = renderThemeScript();

		expect(script).toContain(`k="${THEME_STORAGE_KEY}"`);
		expect(script).toContain('v=["light","dark"]');
		expect(script).toContain('return v.includes(t)?t:"system"');
		expect(script).toContain('t==="system"?localStorage.removeItem(k):localStorage.setItem(k,t)');
		expect(script).toContain('document.querySelector("[data-theme-select]")');
	});
});
