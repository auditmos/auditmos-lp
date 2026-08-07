import { legalEntity } from "@/brand/site";
import { buildAgentIndex, MCP_AGENT_DNS_NAME, MCP_ENDPOINT_PATH } from "./agent-index";
import { createSiteTools, type McpProjectEntry } from "./tools";

const projects = [
	{
		data: {
			title: "Auditmos Website Rebuild",
			slug: "auditmos-website-rebuild",
			summary: "A static-first rebuild for a trust-focused company website.",
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
		authentication: string;
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

	it("declares the agent read-only and unauthenticated, matching what it serves", () => {
		const [agent] = index().agents;

		expect(agent.readOnly).toBe(true);
		expect(agent.authentication).toBe("none");
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
});
