/**
 * The machine-readable surface registry — one list, many projections.
 *
 * Every document on this site that exists for a machine rather than a person is
 * registered here once, with the four things any projection needs: where it
 * lives, what it is, what to call it, and the RFC 8288 relation that says how it
 * relates to the site. The API catalog below, the `Link` response headers, and
 * everything later phases add are all derived from this list, so a surface can
 * never be advertised in one place and missing from another — the same
 * philosophy as the MD mirror's page enumerator.
 *
 * Not registered: the markdown twins. They are a per-page family rather than one
 * document, so they have no single URL to register; `/llms.txt` is their index
 * and it *is* registered, and each page advertises its own twin as an
 * `alternate` relation from `src/site/discovery-headers.ts`.
 *
 * Node-safe: `astro.config.mjs` reaches this module through the discovery-headers
 * integration, so nothing here may touch Astro or Workers runtime APIs.
 */

import { A2A_AGENT_CARD_PATH } from "@/agents/agent-card";
import { site } from "@/brand/site";
import {
	AI_CATALOG_MEDIA_TYPE,
	AI_CATALOG_PATH,
	SERVER_CARD_MEDIA_TYPE,
	SERVER_CARD_PATH,
} from "@/mcp/server-card";
import {
	AUTH_DOC_PATH,
	OAUTH_AUTHORIZATION_SERVER_PATHS,
	OAUTH_PROTECTED_RESOURCE_PATH,
} from "@/oauth/server";

/**
 * The RFC 8288 relations a surface can hold, and what each one means here:
 * `service-desc` is machine-readable description of the service (RFC 8631),
 * `service-doc` is documentation meant to be read, `service-meta` is metadata
 * about the service rather than the service itself.
 */
type SurfaceRelation = "service-desc" | "service-doc" | "service-meta";

export interface AgentSurface {
	/** Site-relative path. Absolute URLs are derived, never stored. */
	readonly path: string;
	readonly mediaType: string;
	readonly title: string;
	readonly relation: SurfaceRelation;
}

/** RFC 9727 reserves this exact path; the document is an RFC 9264 linkset. */
export const API_CATALOG_PATH = "/.well-known/api-catalog";

export const API_CATALOG_MEDIA_TYPE = "application/linkset+json";

/**
 * Every machine-readable surface the site ships. Adding an entry here is all a
 * new surface needs to appear in the catalog and in the `Link` headers.
 *
 * The catalog itself is deliberately absent: it is the index, and an index that
 * lists itself tells a client nothing it did not already have.
 */
export const agentSurfaces: readonly AgentSurface[] = [
	{
		path: "/llms.txt",
		mediaType: "text/plain",
		title: "Auditmos site index for AI agents",
		relation: "service-desc",
	},
	{
		path: "/agents.json",
		mediaType: "application/json",
		title: "Auditmos agent index (DNS-AID)",
		relation: "service-desc",
	},
	{
		path: AI_CATALOG_PATH,
		mediaType: AI_CATALOG_MEDIA_TYPE,
		title: "Auditmos AI catalog (MCP server cards)",
		relation: "service-desc",
	},
	{
		path: SERVER_CARD_PATH,
		mediaType: SERVER_CARD_MEDIA_TYPE,
		title: "Auditmos MCP Server Card",
		relation: "service-desc",
	},
	{
		path: "/sitemap.xml",
		mediaType: "application/xml",
		title: "Auditmos sitemap",
		relation: "service-meta",
	},
	{
		path: OAUTH_AUTHORIZATION_SERVER_PATHS[0],
		mediaType: "application/json",
		title: "Auditmos OAuth 2.0 authorization server metadata",
		relation: "service-meta",
	},
	{
		// The same document at the path OpenID clients probe first. Registered
		// separately because a catalog entry is a URL, and both URLs answer.
		path: OAUTH_AUTHORIZATION_SERVER_PATHS[1],
		mediaType: "application/json",
		title: "Auditmos OAuth 2.0 authorization server metadata (OpenID discovery path)",
		relation: "service-meta",
	},
	{
		path: OAUTH_PROTECTED_RESOURCE_PATH,
		mediaType: "application/json",
		title: "Auditmos protected resource metadata for the MCP endpoint",
		relation: "service-meta",
	},
	{
		path: A2A_AGENT_CARD_PATH,
		mediaType: "application/json",
		title: "Auditmos A2A agent card",
		relation: "service-desc",
	},
	{
		// `service-doc` rather than `service-meta`: this one is meant to be read,
		// and it is the only surface here that explains the others in prose.
		path: AUTH_DOC_PATH,
		mediaType: "text/markdown",
		title: "How authentication and rate limits work at Auditmos",
		relation: "service-doc",
	},
];

interface LinksetLink {
	href: string;
	type: string;
	title: string;
}

function linkOf(surface: AgentSurface): LinksetLink {
	return { href: `${site.url}${surface.path}`, type: surface.mediaType, title: surface.title };
}

/**
 * The RFC 9727 API catalog: one RFC 9264 link context anchored at the site,
 * with the registered surfaces grouped by their relation.
 *
 * One context rather than one per surface, because every surface here describes
 * the same thing — this site — from a different angle. A client that wants a
 * specific kind of document reads the group it understands and ignores the rest.
 */
export function buildApiCatalog(): unknown {
	const groups = new Map<SurfaceRelation, LinksetLink[]>();

	for (const surface of agentSurfaces) {
		const group = groups.get(surface.relation) ?? [];
		group.push(linkOf(surface));
		groups.set(surface.relation, group);
	}

	return { linkset: [{ anchor: site.url, ...Object.fromEntries(groups) }] };
}
