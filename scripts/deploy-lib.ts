/**
 * Pure helpers for the deploy and push-secrets scripts.
 *
 * The side-effecting orchestration (fs, execa, wrangler) lives in
 * `deploy.ts` / `push-secrets.ts`; everything here is testable without
 * touching the filesystem or network.
 */

export const DEPLOY_ENVS = ["staging", "production"] as const;

export type DeployEnv = (typeof DEPLOY_ENVS)[number];

/** Baked into the prerendered HTML by `astro build` (import.meta.env). */
export const BUILD_TIME_VARS = ["TURNSTILE_SITE_KEY"] as const;

/**
 * Pushed to the Worker with `wrangler secret bulk`, read at request time.
 *
 * `OAUTH_SIGNING_KEY` derives every client secret and signs every access token,
 * so it must be cryptographically random and distinct per environment — a
 * staging credential minted from a shared key would authenticate against
 * production.
 *
 * `RESEND_WEBHOOK_SECRET` is the Svix signing secret Resend issues per webhook
 * endpoint, so it is also distinct per environment. `/api/resend-webhook` fails
 * closed without it: an unverified sink would let anyone forge delivery events.
 */
export const RUNTIME_SECRET_VARS = [
	"TURNSTILE_SECRET_KEY",
	"RESEND_API_KEY",
	"RESEND_WEBHOOK_SECRET",
	"CONTACT_TO_EMAIL",
	"OAUTH_SIGNING_KEY",
] as const;

export function isDeployEnv(value: string): value is DeployEnv {
	return (DEPLOY_ENVS as readonly string[]).includes(value);
}

/**
 * Parse a `.dev.vars`-style dotenv source: `KEY=VALUE` lines, `#` comments,
 * optional single or double quotes around the value. Keys with empty values
 * are treated as unset so `missingVars` reports them as missing.
 */
export function parseDotVars(source: string): Record<string, string> {
	const vars: Record<string, string> = {};

	for (const rawLine of source.split("\n")) {
		const entry = parseDotVarsLine(rawLine);
		if (entry) vars[entry.key] = entry.value;
	}

	return vars;
}

function parseDotVarsLine(rawLine: string): { key: string; value: string } | undefined {
	const line = rawLine.trim();
	if (line === "" || line.startsWith("#")) return undefined;

	const separatorIndex = line.indexOf("=");
	if (separatorIndex === -1) return undefined;

	const key = line.slice(0, separatorIndex).trim();
	const value = unquote(line.slice(separatorIndex + 1).trim());
	if (key === "" || value === "") return undefined;

	return { key, value };
}

function unquote(value: string): string {
	const isQuoted =
		value.length >= 2 &&
		((value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'")));

	return isQuoted ? value.slice(1, -1) : value;
}

export function missingVars(vars: Record<string, string>, required: readonly string[]): string[] {
	return required.filter((key) => !vars[key]);
}

/**
 * What to print when a deploy step exits non-zero.
 *
 * The steps run with `stdio: "inherit"`, so the child's stderr is already on
 * the terminal — measured during issue #37, the workerd fatal error was there
 * in full. What hid it was letting the rejection go unhandled: node then dumps
 * the whole `ExecaError` object, 25 lines of execa internals whose last legible
 * sentence is "Command failed with exit code 1", printed *below* the real
 * diagnosis. So this replaces that dump rather than adding to it, and stays
 * short enough that the build's own output remains the thing on screen.
 */
export function describeStepFailure(step: string, exitCode: number | undefined): string {
	const reason = exitCode === undefined ? "was terminated" : `exited with code ${exitCode}`;

	return [
		`\nDeploy aborted: the ${step} step ${reason}.`,
		"Its output is above — that is where the actual error is.",
	].join("\n");
}

/** Subset of parsed vars that must be uploaded as Worker secrets. */
export function runtimeSecrets(vars: Record<string, string>): Record<string, string> {
	const secrets: Record<string, string> = {};

	for (const key of RUNTIME_SECRET_VARS) {
		const value = vars[key];
		if (value) secrets[key] = value;
	}

	return secrets;
}
