/**
 * TDD assumptions for issue #17:
 * - The tested interface is `renderWebMcpScript()`, the JavaScript source that
 *   goes inline into the homepage.
 * - The properties that matter are structural, not behavioural: nothing may run
 *   outside the feature check, nothing may leave the page, and the whole thing
 *   must stay small enough that a zero-JS site still honestly claims to be one.
 * - The browser-side behaviour (a real `navigator.modelContext`) is not
 *   simulated here; the scanner exercises that on staging.
 */

import { site } from "@/brand/site";
import { servicePages } from "@/site/pages";
import { renderWebMcpScript, WEB_MCP_TOOL_NAMES } from "./web-mcp";

const script = renderWebMcpScript();

describe("renderWebMcpScript", () => {
	it("fits in the 2 KB budget the zero-JS principle allows", () => {
		expect(new TextEncoder().encode(script).byteLength).toBeLessThanOrEqual(2048);
	});

	it("wraps everything it does in a single try/catch", () => {
		// A throw here would surface as a console error on a page that ships no
		// other JavaScript, which is exactly the cost this feature must not have.
		expect(script.trimStart().startsWith("try{")).toBe(true);
		expect(script.trimEnd().endsWith("}catch(e){}")).toBe(true);
	});

	it("does nothing at all unless the browser implements WebMCP", () => {
		// Everything after the guard is inside its block, so in every normal
		// browser the entire script is one property read and a return.
		const guard = "navigator.modelContext";
		const body = script.slice(script.indexOf(guard));

		expect(script).toContain(`if(${guard}&&`);
		expect(body).toContain("provideContext");
		// No statement may precede the guard other than opening the try block.
		expect(script.slice(0, script.indexOf("if(")).trim()).toBe("try{");
	});

	it("registers exactly the three tools it claims", () => {
		expect(WEB_MCP_TOOL_NAMES).toEqual(["get_company", "get_services", "get_contact_channels"]);

		for (const name of WEB_MCP_TOOL_NAMES) {
			expect(script).toContain(`"${name}"`);
		}
	});

	it("reaches nothing off this origin", () => {
		// Two reasons: a third-party script would break the CSP-free zero-JS
		// claim, and an agent should not have to trust anyone else to read this
		// site. Every fetch here is a same-origin markdown twin.
		expect(script).not.toMatch(/https?:\/\//);
		expect(script).not.toContain("//");
	});

	it("uses no dynamic code execution", () => {
		for (const forbidden of ["eval(", "Function(", "document.write", "innerHTML"]) {
			expect(script).not.toContain(forbidden);
		}
	});

	it("mirrors data the site already publishes", () => {
		// Every answer is either a markdown twin this site serves or a fact from
		// the brand module — no capability exists here that the MCP server and
		// the pages do not also expose.
		expect(script).toContain("/about.md");
		expect(script).toContain(site.contactEmail);

		for (const service of servicePages) {
			expect(script).toContain(service.path);
		}
	});

	it("cannot break out of the inline script element it is embedded in", () => {
		expect(script.toLowerCase()).not.toContain("</script");
	});

	it("says plainly that contact is human-only", () => {
		// The one place an agent could waste a user's time: it must not read the
		// contact form as something it can submit.
		expect(script.toLowerCase()).toContain("human");
	});
});
