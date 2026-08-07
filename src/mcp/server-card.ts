/**
 * The MCP Server Card and the AI Catalog that points at it (SEP-2127).
 *
 * A Server Card is static metadata describing a *remote* MCP server — identity,
 * transport, protocol versions — so a client can decide whether and how to
 * connect without paying for an `initialize` round trip first.
 *
 * Two things the draft settled differently from how it is often summarised,
 * both of which shape what is emitted here:
 *
 * 1. **No primitives.** The card deliberately omits tools, resources, and
 *    prompts. A server's primitives vary by user, session, and configuration,
 *    so a static document cannot state them honestly and a client must never
 *    make a security decision from one. Tools stay discoverable at runtime via
 *    `tools/list`, and `/agents.json` still lists them for human readers.
 * 2. **Not under `.well-known`.** The reserved location is
 *    `<streamable-http-url>/server-card` — for this server, `/mcp/server-card`.
 *    The draft considered `/.well-known/mcp/server-card` and rejected it:
 *    `.well-known` is for site-wide metadata, and a single server's card is
 *    application-level. `.well-known` stays correct for the *catalog*.
 *
 * The card is nonetheless also served at the `.well-known` path, because the
 * agent-readiness scanners that drove this work look for it there. Same
 * document, two URLs — see `SERVER_CARD_PATHS`.
 *
 * Identity is read from `MCP_SERVER_INFO`, the same constant `initialize`
 * answers with, because the draft requires a card not to contradict the live
 * server. Restating the values here is how they would drift.
 */

import { legalEntity, site } from "@/brand/site";
import { MCP_ENDPOINT_PATH, MCP_PROTOCOL_VERSION, MCP_RATE_LIMIT, MCP_SERVER_INFO } from "./server";

/** The schema URL the card declares conformance to. Versioned by the `vN` segment. */
const SERVER_CARD_SCHEMA =
	"https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json";

/**
 * Reverse-DNS server name. The card schema requires exactly one slash
 * separating namespace from name, which the bare runtime name lacks.
 */
const SERVER_CARD_NAME = `com.auditmos/${MCP_SERVER_INFO.name}`;

/** Catalog entry identifier, `urn:air:{publisher}:{namespace}:{name}`. */
const CATALOG_IDENTIFIER = "urn:air:auditmos.com:mcp:auditmos";

export const SERVER_CARD_MEDIA_TYPE = "application/mcp-server-card+json";
export const AI_CATALOG_MEDIA_TYPE = "application/ai-catalog+json";

/** The reserved location, `<streamable-http-url>/server-card`. */
export const SERVER_CARD_PATH = `${MCP_ENDPOINT_PATH}/server-card`;

/** Where the readiness scanners look. Serves the identical document. */
export const SERVER_CARD_WELL_KNOWN_PATH = "/.well-known/mcp/server-card.json";

export const AI_CATALOG_PATH = "/.well-known/ai-catalog.json";

export const SERVER_CARD_PATHS = [SERVER_CARD_PATH, SERVER_CARD_WELL_KNOWN_PATH] as const;

export function buildServerCard(): unknown {
	return {
		$schema: SERVER_CARD_SCHEMA,
		name: SERVER_CARD_NAME,
		version: MCP_SERVER_INFO.version,
		description: MCP_SERVER_INFO.description,
		title: MCP_SERVER_INFO.title,
		websiteUrl: site.url,
		// Public repository, so a reader can inspect what answers the endpoint
		// rather than taking the card's word for it.
		repository: {
			url: "https://github.com/auditmos/auditmos-lp",
			source: "github",
		},
		icons: [
			{ src: `${site.url}/favicon.svg`, mimeType: "image/svg+xml", sizes: ["any"] },
			{ src: `${site.url}/favicon.ico`, mimeType: "image/x-icon", sizes: ["32x32"] },
		],
		remotes: [
			{
				type: "streamable-http",
				url: `${site.url}${MCP_ENDPOINT_PATH}`,
				supportedProtocolVersions: [MCP_PROTOCOL_VERSION],
			},
		],
		// Vendor-namespaced per the `_meta` rules: any prefix containing
		// `mcp` or `modelcontextprotocol` is reserved, `com.auditmos/` is not.
		// The limit is published so a client paces itself instead of finding it
		// by being refused — same number the endpoint enforces.
		_meta: {
			"com.auditmos/rateLimit": {
				requests: MCP_RATE_LIMIT.requests,
				windowSeconds: MCP_RATE_LIMIT.windowSeconds,
				scope: "per client IP",
			},
			"com.auditmos/operator": {
				legalName: legalEntity.name,
				registration: legalEntity.registration,
				contact: site.contactEmail,
			},
		},
	};
}

export function buildAiCatalog(): unknown {
	return {
		specVersion: "1.0",
		entries: [
			{
				identifier: CATALOG_IDENTIFIER,
				type: SERVER_CARD_MEDIA_TYPE,
				// The reserved location, not the `.well-known` mirror: a client
				// reading the catalog should be sent to the spec's address.
				url: `${site.url}${SERVER_CARD_PATH}`,
			},
		],
	};
}
