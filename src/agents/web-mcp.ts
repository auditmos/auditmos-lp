/**
 * WebMCP: three read-only tools offered to a browser-embedded agent.
 *
 * `navigator.modelContext` is a proposal, implemented today by a handful of
 * agentic browsers and by nothing else. That shapes the whole design: the
 * script is inline, vanilla, under 2 KB, and every statement it runs lives
 * inside one feature check inside one try/catch. In every normal browser it is
 * a single property read that finds nothing and stops — so the site's zero-JS
 * claim survives intact, because nothing executes.
 *
 * The tools mirror what the MCP server and the pages already expose: two of
 * them answer from markdown twins this site serves, the third from the brand
 * module, baked in at build. No capability exists here that an agent could not
 * get by fetching the same URLs itself; the value is that it does not have to
 * know they exist.
 *
 * Generated as a string rather than written as a `.js` file so the service and
 * contact facts come from the same constants every other surface reads.
 */

import { legalEntity, site } from "@/brand/site";
import { servicePages } from "@/site/pages";

export const WEB_MCP_TOOL_NAMES = ["get_company", "get_services", "get_contact_channels"] as const;

/**
 * JSON safe to inline inside a `<script>` element: `<` escaped so a value can
 * never terminate the element early, and no `//` sequence that the
 * same-origin assertion would flag.
 */
function inlineJson(value: unknown): string {
	return JSON.stringify(value).replaceAll("<", "\\u003c");
}

const servicesAnswer = servicePages.map((service) => ({
	name: service.jsonLd.name,
	description: service.description,
	page: service.path,
	markdown: `${service.path}.md`,
}));

const contactAnswer = {
	email: site.contactEmail,
	legalName: legalEntity.name,
	registration: legalEntity.registration,
	address: legalEntity.address,
	contactPage: "/contact",
	note: "The contact form is gated by an anti-spam challenge only a human can pass. Use the email address instead — it reaches a person.",
};

export function renderWebMcpScript(): string {
	// Hand-minified: a build step for 2 KB of vanilla JavaScript would cost more
	// than it saves, and this stays readable enough to audit in the emitted HTML.
	return `try{if(navigator.modelContext&&typeof navigator.modelContext.provideContext==="function"){var t=function(n,d,f){return{name:n,description:d,inputSchema:{type:"object",properties:{}},execute:function(){return Promise.resolve(f()).then(function(x){return{content:[{type:"text",text:x}]}})}}};var m=function(u){return fetch(u,{headers:{accept:"text/markdown"}}).then(function(r){return r.text()})};var j=function(v){return JSON.stringify(v,null,2)};navigator.modelContext.provideContext({tools:[t("get_company","Auditmos company profile: legal entity, registration, address, and what the practice does.",function(){return m("/about.md")}),t("get_services","The three Auditmos service lines with their page and markdown URLs.",function(){return j(${inlineJson(servicesAnswer)})}),t("get_contact_channels","How to reach Auditmos. Contact is human-only; the form cannot be submitted by an agent.",function(){return j(${inlineJson(contactAnswer)})})]})}}catch(e){}`;
}
