export const PROJECT_CAPABILITIES = ["software", "security", "applied-r-and-d"] as const;
export type ProjectCapability = (typeof PROJECT_CAPABILITIES)[number];

export const PROJECT_PROVENANCES = ["client-work", "internal-r-and-d"] as const;
export type ProjectProvenance = (typeof PROJECT_PROVENANCES)[number];

export const PROJECT_CAPABILITY_OPTIONS = [
	{ value: "software", label: "Software" },
	{ value: "security", label: "Security" },
	{ value: "applied-r-and-d", label: "Applied R&D" },
] as const satisfies readonly { value: ProjectCapability; label: string }[];
