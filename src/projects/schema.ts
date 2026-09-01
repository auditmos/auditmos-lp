import { z } from "astro/zod";
import { PROJECT_CAPABILITIES, PROJECT_PROVENANCES } from "./taxonomy";

const nonEmptyString = z.string().trim().min(1);

const projectClientSchema = z
	.object({
		name: nonEmptyString.optional(),
		url: z.url().optional(),
		sector: nonEmptyString.optional(),
	})
	.strict();

export const projectDataSchema = z
	.object({
		title: nonEmptyString,
		slug: nonEmptyString,
		summary: nonEmptyString,
		provenance: z.enum(PROJECT_PROVENANCES).default("client-work"),
		capabilities: z.array(z.enum(PROJECT_CAPABILITIES)).min(1),
		client: projectClientSchema.optional(),
		industry: nonEmptyString.optional(),
		year: z.number().int().optional(),
		stack: z.array(nonEmptyString).default([]),
		hero: nonEmptyString.optional(),
		featured: z.boolean().default(false),
		order: z.number().int().optional(),
		links: z
			.array(
				z.object({
					label: nonEmptyString,
					url: z.url(),
				}),
			)
			.default([]),
	})
	.superRefine((project, ctx) => {
		if (project.provenance === "internal-r-and-d") {
			if (project.client) {
				ctx.addIssue({
					code: "custom",
					path: ["client"],
					message: "Internal R&D must not provide a client.",
				});
			}
			return;
		}

		if (!project.client) {
			ctx.addIssue({
				code: "custom",
				path: ["client"],
				message: "Client work must provide a client.",
			});
			return;
		}

		const hasName = Boolean(project.client.name);
		const hasSector = Boolean(project.client.sector);

		if (hasName === hasSector) {
			ctx.addIssue({
				code: "custom",
				path: ["client"],
				message: "Provide exactly one of client.name or client.sector.",
			});
		}

		if (hasSector && project.client.url) {
			ctx.addIssue({
				code: "custom",
				path: ["client", "url"],
				message: "client.url is only valid when client.name is provided.",
			});
		}
	});

export type ProjectData = z.infer<typeof projectDataSchema>;
