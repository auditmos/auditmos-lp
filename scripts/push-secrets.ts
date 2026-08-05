/**
 * Push the contact-form runtime secrets to a deployed Worker environment:
 *
 *   pnpm secrets:staging
 *   pnpm secrets:production
 *
 * Reads `.dev.vars` and `.dev.vars.<env>` (env-specific file wins) and
 * pipes the runtime secrets to `wrangler secret bulk` via stdin, so
 * values never touch a temp file or the shell history. Run after the
 * first `pnpm deploy:<env>` — the Worker must exist.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execa } from "execa";
import {
	DEPLOY_ENVS,
	isDeployEnv,
	missingVars,
	parseDotVars,
	RUNTIME_SECRET_VARS,
	runtimeSecrets,
} from "./deploy-lib";

const root = resolve(import.meta.dirname, "..");
const targetEnv = process.argv[2] ?? "";

if (!isDeployEnv(targetEnv)) {
	console.error(`Usage: tsx scripts/push-secrets.ts <${DEPLOY_ENVS.join("|")}>`);
	process.exit(1);
}

const envFile = `.dev.vars.${targetEnv}`;
const vars = {
	...readDotVars(".dev.vars"),
	...readDotVars(envFile),
};

const missing = missingVars(vars, RUNTIME_SECRET_VARS);
if (missing.length > 0) {
	console.error(
		`Missing runtime secrets for ${targetEnv}: ${missing.join(", ")}.\n` +
			`Fill them in ${envFile} (template: ${envFile}.example).`,
	);
	process.exit(1);
}

await execa("pnpm", ["exec", "wrangler", "secret", "bulk", "--env", targetEnv], {
	cwd: root,
	stdio: ["pipe", "inherit", "inherit"],
	input: JSON.stringify(runtimeSecrets(vars)),
});

console.log(`\nSecrets pushed to ${targetEnv} (${RUNTIME_SECRET_VARS.join(", ")}).`);

function readDotVars(fileName: string): Record<string, string> {
	const filePath = resolve(root, fileName);
	if (!existsSync(filePath)) return {};
	return parseDotVars(readFileSync(filePath, "utf8"));
}
