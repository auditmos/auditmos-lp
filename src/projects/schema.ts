import { z } from "astro/zod";

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
		client: projectClientSchema,
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
