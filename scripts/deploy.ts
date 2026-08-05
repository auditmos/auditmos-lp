/**
 * Per-environment deploy: build with the env's build-time vars baked in,
 * then `wrangler deploy --env <env>`.
 *
 *   pnpm deploy:staging
 *   pnpm deploy:production
 *
 * Reads `.dev.vars` and `.dev.vars.<env>` (the wrangler convention; the
 * env-specific file wins) and fails fast when any contact-form var is
 * missing, so a half-configured environment never ships. Runtime secrets
 * are NOT sent by this script — push them with `pnpm secrets:<env>`.
 * Full runbook: docs/deployment.md.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execa } from "execa";
import {
	BUILD_TIME_VARS,
	DEPLOY_ENVS,
	isDeployEnv,
	missingVars,
	parseDotVars,
	RUNTIME_SECRET_VARS,
} from "./deploy-lib";

const root = resolve(import.meta.dirname, "..");
const targetEnv = process.argv[2] ?? "";

if (!isDeployEnv(targetEnv)) {
	console.error(`Usage: tsx scripts/deploy.ts <${DEPLOY_ENVS.join("|")}>`);
	process.exit(1);
}

const envFile = `.dev.vars.${targetEnv}`;
const vars = {
	...readDotVars(".dev.vars"),
	...readDotVars(envFile),
};

const missing = missingVars(vars, [...BUILD_TIME_VARS, ...RUNTIME_SECRET_VARS]);
if (missing.length > 0) {
	console.error(
		[
			`Missing required vars for ${targetEnv}: ${missing.join(", ")}.`,
			`Fill them in ${envFile} (template: ${envFile}.example).`,
			"Runtime secrets are validated here too so the follow-up",
			`\`pnpm secrets:${targetEnv}\` cannot be forgotten half-filled.`,
		].join("\n"),
	);
	process.exit(1);
}

const buildEnv: Record<string, string> = { CLOUDFLARE_ENV: targetEnv };
for (const key of BUILD_TIME_VARS) {
	const value = vars[key];
	if (value) buildEnv[key] = value;
}

await execa("pnpm", ["run", "build"], { cwd: root, stdio: "inherit", env: buildEnv });
await execa("pnpm", ["exec", "wrangler", "deploy", "--env", targetEnv], {
	cwd: root,
	stdio: "inherit",
});

console.log(
	`\nDeployed ${targetEnv}. If this Worker's secrets are not set yet, run: pnpm secrets:${targetEnv}`,
);

function readDotVars(fileName: string): Record<string, string> {
	const filePath = resolve(root, fileName);
	if (!existsSync(filePath)) return {};
	return parseDotVars(readFileSync(filePath, "utf8"));
}
