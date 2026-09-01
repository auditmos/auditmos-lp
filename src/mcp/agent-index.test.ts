import { legalEntity } from "@/brand/site";
import { MARKDOWN_MEDIA_TYPE, MARKDOWN_TOKENS_HEADER } from "@/site/markdown-negotiation";
import { buildAgentIndex, MCP_AGENT_DNS_NAME } from "./agent-index";
import { MCP_ENDPOINT_PATH, MCP_RATE_LIMIT } from "./server";
import { createSiteTools, type McpProjectEntry } from "./tools";

const projects = [
	{
		data: {
			title: "Auditmos Website Rebuild",
			slug: "auditmos-website-rebuild",
			summary: "A static-first rebuild for a trust-focused company website.",
			provenance: "client-work",
			capabilities: ["software"],
			client: { name: "Auditmos OÜ" },
			stack: [],
			featured: true,
			links: [],
		},
		body: "Auditmos needed a concise public surface.",
	},
] as const satisfies readonly McpProjectEntry[];

interface AgentIndex {
	organization: Record<string, string>;
	agents: {
		protocol: string;
		endpoint: string;
		dnsName: string;
		readOnly: boolean;
		authentication: {
			required: boolean;
			scheme: string;
			registrationEndpoint: string;
			documentation: string;
		};
		rateLimit: { requests: number; windowSeconds: number };
		tools: { name: string }[];
	}[];
	documents: Record<string, string>;
}

function index(): AgentIndex {
	return buildAgentIndex(projects) as AgentIndex;
}

describe("buildAgentIndex", () => {
	it("identifies the publishing organization from the shared legal entity", () => {
		expect(index().organization).toMatchObject({
			legalName: legalEntity.name,
			registration: legalEntity.registration,
			url: "https://auditmos.com",
		});
	});

	it("advertises the MCP agent at the endpoint that actually serves it", () => {
		const [agent] = index().agents;

		expect(agent.protocol).toBe("mcp");
		expect(agent.endpoint).toBe(`https://auditmos.com${MCP_ENDPOINT_PATH}`);
		expect(agent.dnsName).toBe(MCP_AGENT_DNS_NAME);
	});

	it("declares the agent read-only, with authentication optional rather than absent", () => {
		const [agent] = index().agents;

		// It stopped being "none" the moment a credential started doing
		// something. Stating `required: false` alongside the endpoint that
		// issues one is the difference between "you cannot" and "you need not".
		expect(agent.readOnly).toBe(true);
		expect(agent.authentication).toMatchObject({ required: false, scheme: "oauth2" });
		expect(agent.authentication.registrationEndpoint).toContain("/oauth/register");
		expect(agent.authentication.documentation).toContain("/auth.md");
	});

	it("publishes the rate limit so a client can pace itself before being refused", () => {
		const [agent] = index().agents;

		expect(agent.rateLimit).toMatchObject({
			requests: MCP_RATE_LIMIT.requests,
			windowSeconds: MCP_RATE_LIMIT.windowSeconds,
		});
	});

	it("lists exactly the tools the server registers, so the index cannot overclaim", () => {
		const [agent] = index().agents;

		expect(agent.tools.map((tool) => tool.name)).toEqual(
			createSiteTools(projects).map((tool) => tool.name),
		);
	});

	it("points at the other machine-readable surfaces an arriving agent needs", () => {
		expect(index().documents.llmsTxt).toBe("https://auditmos.com/llms.txt");
		expect(index().documents.sitemap).toBe("https://auditmos.com/sitemap.xml");
	});

	it("advertises both routes to a page's markdown, naming what the Worker enforces", () => {
		const { markdownMirror, markdownNegotiation } = index().documents;

		// Renaming the header or media type in the negotiation module without
		// republishing it here would leave agents acting on a stale contract.
		expect(markdownMirror).toContain(MARKDOWN_MEDIA_TYPE);
		expect(markdownNegotiation).toContain(`Accept: ${MARKDOWN_MEDIA_TYPE}`);
		expect(markdownNegotiation).toContain(MARKDOWN_TOKENS_HEADER);
	});
});
