import cached from "../../.cache/oss-projects.json";
import type { OssProject } from "./aggregator";

/**
 * The `/open-source` page data. Statically imported from the repo-committed cache that
 * `scripts/refresh-oss-cache.ts` regenerates before every build. Inlined by Vite at build
 * time, so the prerendered page performs no network or filesystem work at request time.
 */
export const ossProjects: OssProject[] = cached as OssProject[];
