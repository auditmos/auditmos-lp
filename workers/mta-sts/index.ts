/**
 * A Worker whose entire job is serving one file at `mta-sts.auditmos.com`.
 *
 * Separate from the site Worker deliberately (#34 option b). Folding the policy
 * into the main Worker and binding a second custom domain to it looks cheaper,
 * but Workers Assets serves static assets *before* the Worker runs for any path
 * outside `assets.run_worker_first`, and that list is scoped by path, not by
 * host. So `mta-sts.auditmos.com/og.png`, `/sitemap.xml` and `/_astro/*` would
 * be answered straight from the asset server, never reaching a redirect the
 * Worker might want to apply — a second URL for site content on a hostname that
 * exists only to publish a mail policy. Making the Worker see every request
 * would mean `run_worker_first: ["/*"]`, routing the whole site's assets
 * through the Worker to fix a subdomain. Fifty lines of separate Worker is the
 * smaller cost.
 *
 * All the behaviour lives in `src/mail/mta-sts.ts`, shared with the tests. This
 * file is only the deployment shape.
 */

import { mtaStsResponse } from "../../src/mail/mta-sts";

export default {
	fetch(request: Request): Response {
		return mtaStsResponse(request);
	},
};
