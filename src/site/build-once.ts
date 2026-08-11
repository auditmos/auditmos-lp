/**
 * One production build, shared by every suite that asserts against it.
 *
 * `astro build` empties `dist/` before it writes to it. Vitest runs test files
 * in parallel isolated workers, so the moment a second suite calls the builder
 * the two builds interleave: one file reads a `dist/` the other has just wiped.
 * A module-level memo cannot fix that — `isolate: true` gives every file its own
 * module registry, so there is nothing in-process for the workers to share.
 *
 * The coordination therefore has to live on disk, which is what this module is:
 * an exclusive lock the first caller takes, a marker the rest read instead of
 * building, and a counter so a suite can assert it really was one build. The
 * state is cleared once per run by the vitest global setup — that is also what
 * makes a lock left behind by a killed run recoverable without a human.
 *
 * **Node-only, test support.** Touches `node:fs`; nothing in the application may
 * import it, or the Worker bundle would pull in the filesystem.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const defaultStateDir = resolve(
	import.meta.dirname,
	"..",
	"..",
	"node_modules",
	".cache",
	"auditmos-build-once",
);

/** Long enough for a cold `astro build`, short enough to fail loudly. */
const defaultTimeoutMs = 180_000;
const defaultPollMs = 50;

export interface BuildOnceOptions {
	/** Where the lock, marker and counter live. Defaults to a cache under `node_modules`. */
	stateDir?: string;
	/** How long a waiting caller tolerates a lock it cannot acquire. */
	timeoutMs?: number;
	/** How often a waiting caller re-checks the lock. */
	pollMs?: number;
}

class BuildLockTimeoutError extends Error {
	constructor(timeoutMs: number, lockDir: string) {
		super(`Timed out after ${timeoutMs}ms waiting for the build lock at ${lockDir}`);
		this.name = "BuildLockTimeoutError";
	}
}

function paths(stateDir: string): { lockDir: string; marker: string; counter: string } {
	return {
		lockDir: resolve(stateDir, "lock"),
		marker: resolve(stateDir, "done"),
		counter: resolve(stateDir, "runs"),
	};
}

/**
 * Takes the lock by creating a directory, which the OS makes atomic: `mkdir`
 * either creates it or fails, with no window in which two callers both believe
 * they won. A lock file would need the same `O_EXCL` guarantee and an extra
 * decision about what its contents mean.
 */
function tryAcquire(lockDir: string): boolean {
	try {
		mkdirSync(lockDir, { recursive: false });
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
		throw error;
	}
}

function recordRun(counter: string): void {
	writeFileSync(counter, `${readRuns(counter) + 1}`);
}

function readRuns(counter: string): number {
	if (!existsSync(counter)) return 0;
	return Number.parseInt(readFileSync(counter, "utf8").trim(), 10) || 0;
}

/**
 * Runs `build` if nobody has yet this run, otherwise waits for whoever is.
 *
 * A failed build releases the lock without writing the marker, so the next
 * caller retries and reports the real error rather than inheriting a silence.
 */
export async function buildOnce(
	build: () => Promise<void>,
	options: BuildOnceOptions = {},
): Promise<void> {
	const stateDir = options.stateDir ?? defaultStateDir;
	const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
	const pollMs = options.pollMs ?? defaultPollMs;
	const { lockDir, marker, counter } = paths(stateDir);
	const deadline = Date.now() + timeoutMs;

	mkdirSync(stateDir, { recursive: true });

	while (Date.now() <= deadline) {
		if (existsSync(marker)) return;

		if (tryAcquire(lockDir)) {
			try {
				recordRun(counter);
				await build();
				writeFileSync(marker, "");
			} finally {
				rmSync(lockDir, { recursive: true, force: true });
			}
			return;
		}

		await delay(pollMs);
	}

	throw new BuildLockTimeoutError(timeoutMs, lockDir);
}

/**
 * Drops everything a previous run left behind, including a lock nobody holds
 * any more. Called once per test run — and again on every watch re-run, so an
 * edited page is rebuilt rather than asserted against stale output.
 */
export function clearBuildState(stateDir: string = defaultStateDir): void {
	rmSync(stateDir, { recursive: true, force: true });
}

/** How many builds this run actually started. */
export function buildRunCount(stateDir: string = defaultStateDir): number {
	return readRuns(paths(stateDir).counter);
}
