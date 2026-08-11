/**
 * Run-scoped reset for the shared production build.
 *
 * This file runs once per `vitest` invocation, before any worker starts, which
 * is the only moment at which no test can be holding the build lock — so it is
 * where a lock abandoned by a killed run gets cleared. Deliberately it does
 * *not* build: `globalSetup` runs whether or not the filters select a suite that
 * needs one, so building here would make `vitest run src/site/canonical-url`
 * pay for a full `astro build`. The first suite that actually wants the output
 * triggers it; see `src/site/build-once.ts`.
 */

import type { TestProject } from "vitest/node";
import { clearBuildState } from "./src/site/build-once";

// `onTestsRerun` reads `this`, so the project has to stay whole — destructuring
// the method off it throws on the first call.
export default function setup(project: TestProject): void {
	clearBuildState();
	// Watch mode keeps the same global setup across re-runs, so without this an
	// edited page would be asserted against the build from the session's start.
	project.onTestsRerun(() => {
		clearBuildState();
	});
}
