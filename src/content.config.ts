import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { projectDataSchema } from "./projects/schema";

const projects = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
	schema: projectDataSchema,
});

export const collections = { projects };
