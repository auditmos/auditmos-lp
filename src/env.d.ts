type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
	CONTACT_TO_EMAIL: string;
	RESEND_API_KEY: string;
	TURNSTILE_SECRET_KEY: string;
}

declare namespace Cloudflare {
	interface Env {
		CONTACT_TO_EMAIL: string;
		RESEND_API_KEY: string;
		TURNSTILE_SECRET_KEY: string;
	}
}

interface ImportMetaEnv {
	readonly TURNSTILE_SITE_KEY?: string;
}

declare namespace App {
	interface Locals extends Runtime {}
}
