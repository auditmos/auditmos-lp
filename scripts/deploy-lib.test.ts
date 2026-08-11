import {
	BUILD_TIME_VARS,
	DEPLOY_ENVS,
	describeStepFailure,
	isDeployEnv,
	missingVars,
	parseDotVars,
	RUNTIME_SECRET_VARS,
	runtimeSecrets,
} from "./deploy-lib";

describe("isDeployEnv", () => {
	it.each([...DEPLOY_ENVS])("accepts %s", (env) => {
		expect(isDeployEnv(env)).toBe(true);
	});

	it.each(["dev", "prod", "", "Production", "staging "])("rejects %j", (value) => {
		expect(isDeployEnv(value)).toBe(false);
	});
});

describe("parseDotVars", () => {
	it("parses KEY=VALUE lines", () => {
		expect(parseDotVars("A=1\nB=two")).toEqual({ A: "1", B: "two" });
	});

	it("ignores comments and blank lines", () => {
		expect(parseDotVars("# note\n\nA=1\n  # indented comment\n")).toEqual({ A: "1" });
	});

	it("trims whitespace around keys and values", () => {
		expect(parseDotVars("  A  =  1  ")).toEqual({ A: "1" });
	});

	it("strips matching single or double quotes around values", () => {
		expect(parseDotVars(`A="quoted"\nB='single'`)).toEqual({ A: "quoted", B: "single" });
	});

	it("keeps = characters inside the value", () => {
		expect(parseDotVars("A=abc=def")).toEqual({ A: "abc=def" });
	});

	it("treats empty values as unset", () => {
		expect(parseDotVars("A=\nB=''\nC=1")).toEqual({ C: "1" });
	});

	it("skips lines without a separator or without a key", () => {
		expect(parseDotVars("no separator\n=orphan-value\nA=1")).toEqual({ A: "1" });
	});
});

describe("missingVars", () => {
	it("returns required keys that are absent", () => {
		expect(missingVars({ A: "1" }, ["A", "B", "C"])).toEqual(["B", "C"]);
	});

	it("returns an empty list when everything is present", () => {
		expect(missingVars({ A: "1", B: "2" }, ["A", "B"])).toEqual([]);
	});
});

describe("runtimeSecrets", () => {
	it("picks only the runtime secret keys", () => {
		const vars = {
			TURNSTILE_SITE_KEY: "public",
			TURNSTILE_SECRET_KEY: "secret",
			RESEND_API_KEY: "re_123",
			CONTACT_TO_EMAIL: "a@b.c",
			UNRELATED: "x",
		};

		expect(runtimeSecrets(vars)).toEqual({
			TURNSTILE_SECRET_KEY: "secret",
			RESEND_API_KEY: "re_123",
			CONTACT_TO_EMAIL: "a@b.c",
		});
	});

	it("omits keys that are not set", () => {
		expect(runtimeSecrets({ RESEND_API_KEY: "re_123" })).toEqual({ RESEND_API_KEY: "re_123" });
	});

	it("covers every declared runtime secret", () => {
		const vars = Object.fromEntries(RUNTIME_SECRET_VARS.map((key) => [key, `${key}-value`]));

		expect(Object.keys(runtimeSecrets(vars))).toEqual([...RUNTIME_SECRET_VARS]);
	});
});

describe("BUILD_TIME_VARS", () => {
	it("does not overlap with runtime secrets", () => {
		const runtime = new Set<string>(RUNTIME_SECRET_VARS);

		for (const key of BUILD_TIME_VARS) {
			expect(runtime.has(key)).toBe(false);
		}
	});
});

describe("describeStepFailure", () => {
	// Measured on the real failure (issue #37): the build's own stderr *did*
	// reach the terminal at line 46, and execa's unhandled-rejection dump then
	// printed 25 further lines of its own internals below it. The operator reads
	// the bottom, sees "Command failed with exit code 1", and concludes the build
	// swallowed the error. So this replaces the dump — it does not add output.
	it("names the step that failed and its exit code", () => {
		const message = describeStepFailure("build", 1);

		expect(message).toContain("build");
		expect(message).toContain("1");
	});

	it("points the reader back up at the output that carries the real error", () => {
		expect(describeStepFailure("build", 1)).toMatch(/above/i);
	});

	it("keeps itself short enough to survive on one screen", () => {
		// The whole point is not being a wall of text under the real diagnosis.
		expect(describeStepFailure("build", 1).split("\n").length).toBeLessThanOrEqual(4);
	});

	it("handles a signal kill, where there is no exit code", () => {
		expect(describeStepFailure("deploy", undefined)).toContain("deploy");
	});

	it("names the deploy step when that is what failed", () => {
		const message = describeStepFailure("deploy", 2);

		expect(message).toContain("deploy");
		expect(message).not.toContain("build");
	});
});
