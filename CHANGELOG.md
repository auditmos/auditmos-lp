# [1.29.0](https://github.com/auditmos/auditmos-lp/compare/v1.28.0...v1.29.0) (2026-08-13)


### Features

* **ci:** remember the three deferred security gates ([27e369a](https://github.com/auditmos/auditmos-lp/commit/27e369a8a4b5a2405ab351774d4d86dadf2253c8))

# [1.28.0](https://github.com/auditmos/auditmos-lp/compare/v1.27.0...v1.28.0) (2026-08-13)


### Features

* **security:** check the deployed security.txt in pnpm agents:verify ([867d3c3](https://github.com/auditmos/auditmos-lp/commit/867d3c356a9d36b38c45b74b7fcc075ac8b8801d))

# [1.27.0](https://github.com/auditmos/auditmos-lp/compare/v1.26.0...v1.27.0) (2026-08-13)


### Features

* **security:** publish an RFC 9116 security.txt ([4d88e3b](https://github.com/auditmos/auditmos-lp/commit/4d88e3b20db7a134ae4234dc64317fcc4c0304d1))

# [1.26.0](https://github.com/auditmos/auditmos-lp/compare/v1.25.1...v1.26.0) (2026-08-13)


### Features

* **mail:** serve an MTA-STS policy from a standalone Worker ([7f253ab](https://github.com/auditmos/auditmos-lp/commit/7f253ab2122bafd29700616b81b00a514173abe3)), closes [#34](https://github.com/auditmos/auditmos-lp/issues/34) [#34](https://github.com/auditmos/auditmos-lp/issues/34)

## [1.25.1](https://github.com/auditmos/auditmos-lp/compare/v1.25.0...v1.25.1) (2026-08-13)


### Bug Fixes

* **analytics:** delete the build-time beacon and assert the edge one instead ([107b3dc](https://github.com/auditmos/auditmos-lp/commit/107b3dc4610d3231ee7b1393b4289ae9f2032176)), closes [#39](https://github.com/auditmos/auditmos-lp/issues/39) [#39](https://github.com/auditmos/auditmos-lp/issues/39) [#39](https://github.com/auditmos/auditmos-lp/issues/39)

# [1.25.0](https://github.com/auditmos/auditmos-lp/compare/v1.24.1...v1.25.0) (2026-08-12)


### Features

* **resend:** add a signature-verified delivery webhook ([39340b7](https://github.com/auditmos/auditmos-lp/commit/39340b74ad42e5ae7830eb152e1b5f6f3c984ff2))

## [1.24.1](https://github.com/auditmos/auditmos-lp/compare/v1.24.0...v1.24.1) (2026-08-11)


### Bug Fixes

* **contact:** move the contact address to tom@auditmos.com ([75a29f2](https://github.com/auditmos/auditmos-lp/commit/75a29f2c897dc55badadc1c9d32da752f0de3e5b))
* **contact:** record Resend message ids and rejection details ([3193cd5](https://github.com/auditmos/auditmos-lp/commit/3193cd552625f8f3eded0dffa28aa7278dacb1f1))

# [1.24.0](https://github.com/auditmos/auditmos-lp/compare/v1.23.0...v1.24.0) (2026-08-11)


### Features

* **scripts:** watch a deployed env for CSP violations ([0dee5eb](https://github.com/auditmos/auditmos-lp/commit/0dee5ebb526de42c6e7a7df83fe66273ff4431eb)), closes [#30](https://github.com/auditmos/auditmos-lp/issues/30) [#30](https://github.com/auditmos/auditmos-lp/issues/30)

# [1.23.0](https://github.com/auditmos/auditmos-lp/compare/v1.22.3...v1.23.0) (2026-08-11)


### Features

* **site:** ship a report-only Content Security Policy ([010d771](https://github.com/auditmos/auditmos-lp/commit/010d7719091aa03d1d7afc3d405c84c07bf0e060)), closes [#30](https://github.com/auditmos/auditmos-lp/issues/30)

## [1.22.3](https://github.com/auditmos/auditmos-lp/compare/v1.22.2...v1.22.3) (2026-08-11)


### Bug Fixes

* **scripts:** probe the host under test, not the one the sitemap names ([3e32cb1](https://github.com/auditmos/auditmos-lp/commit/3e32cb12455dc959653b021e9eda76540395a1d1)), closes [#38](https://github.com/auditmos/auditmos-lp/issues/38) [#38](https://github.com/auditmos/auditmos-lp/issues/38)

## [1.22.2](https://github.com/auditmos/auditmos-lp/compare/v1.22.1...v1.22.2) (2026-08-11)


### Bug Fixes

* **routing:** claim both URL forms in run_worker_first so pages 301 ([67f24ea](https://github.com/auditmos/auditmos-lp/commit/67f24eaa85be6cacdb797f9b2945c162d685568b)), closes [#38](https://github.com/auditmos/auditmos-lp/issues/38)

## [1.22.1](https://github.com/auditmos/auditmos-lp/compare/v1.22.0...v1.22.1) (2026-08-11)


### Bug Fixes

* **build:** give the build its own miniflare state directory ([1ade4d6](https://github.com/auditmos/auditmos-lp/commit/1ade4d67e2e3c810247dd617babf7fba7d8d3ab1)), closes [#37](https://github.com/auditmos/auditmos-lp/issues/37)

# [1.22.0](https://github.com/auditmos/auditmos-lp/compare/v1.21.0...v1.22.0) (2026-08-11)


### Features

* **site:** send baseline application-security response headers ([0d33554](https://github.com/auditmos/auditmos-lp/commit/0d33554f6fe4b7da6cf9a6205b6739eb6177ee45)), closes [#29](https://github.com/auditmos/auditmos-lp/issues/29)

# [1.21.0](https://github.com/auditmos/auditmos-lp/compare/v1.20.0...v1.21.0) (2026-08-10)


### Bug Fixes

* **site:** 301 the trailing-slash URLs the asset server never sees ([3ef733c](https://github.com/auditmos/auditmos-lp/commit/3ef733c6c53c368756da79b516d5ee4c79b15bea))


### Features

* **agents:** publish an A2A agent card derived from the MCP tools ([efd56e4](https://github.com/auditmos/auditmos-lp/commit/efd56e499cd6818f9329a2ca25d3445c851ad8c9)), closes [#15](https://github.com/auditmos/auditmos-lp/issues/15)
* **agents:** publish three agent skills with build-verified digests ([209c931](https://github.com/auditmos/auditmos-lp/commit/209c931459dff87d2f842bb917990ec50a0b863d)), closes [#16](https://github.com/auditmos/auditmos-lp/issues/16)
* **agents:** register three WebMCP tools from the homepage ([301f8e6](https://github.com/auditmos/auditmos-lp/commit/301f8e6c86afefb7532153915796242372fa1263)), closes [#17](https://github.com/auditmos/auditmos-lp/issues/17)
* **content:** keep only the GPU fleet case study on /work ([8879c17](https://github.com/auditmos/auditmos-lp/commit/8879c1719642bfc0632ed9ca18a369a96613452b))
* **mcp:** make the token worth acquiring, then document it ([0ef5f04](https://github.com/auditmos/auditmos-lp/commit/0ef5f04927a658a98264dad495eba300c0bd65ce)), closes [#14](https://github.com/auditmos/auditmos-lp/issues/14)
* **oauth:** issue real client credentials and publish the metadata ([8ddc772](https://github.com/auditmos/auditmos-lp/commit/8ddc77241f26e6694c90cf43f8772a49917d8afb)), closes [#13](https://github.com/auditmos/auditmos-lp/issues/13)
* **scripts:** import authored launch articles into /work ([d19e599](https://github.com/auditmos/auditmos-lp/commit/d19e599e1e163ecac0133a9e050d3f883679d6d7))
* **site:** link the founder's X profile alongside LinkedIn ([fa9ba56](https://github.com/auditmos/auditmos-lp/commit/fa9ba56fa1890d590c605b7b36ddacb9d0bdabbc))
* **site:** move projects to /work and render their Markdown properly ([d071bcb](https://github.com/auditmos/auditmos-lp/commit/d071bcb797f4d3be1705c4917ad1fb809dd477df)), closes [#0d1117](https://github.com/auditmos/auditmos-lp/issues/0d1117) [#24292e](https://github.com/auditmos/auditmos-lp/issues/24292e)

# [1.20.0](https://github.com/auditmos/auditmos-lp/compare/v1.19.0...v1.20.0) (2026-08-07)


### Features

* **agents:** publish an RFC 9727 API catalog from a surface registry ([2169d89](https://github.com/auditmos/auditmos-lp/commit/2169d897ac7fd86229988b6b310e02361c917587)), closes [#12](https://github.com/auditmos/auditmos-lp/issues/12)

# [1.19.0](https://github.com/auditmos/auditmos-lp/compare/v1.18.0...v1.19.0) (2026-08-07)


### Features

* **agents:** publish an MCP Server Card and AI Catalog (SEP-2127) ([538df94](https://github.com/auditmos/auditmos-lp/commit/538df9484075d7e660690f1a016f9e90c380a626))

# [1.18.0](https://github.com/auditmos/auditmos-lp/compare/v1.17.0...v1.18.0) (2026-08-07)


### Features

* **agents:** add pnpm agents:verify to catch agent-readiness regressions ([54007cd](https://github.com/auditmos/auditmos-lp/commit/54007cd79fca630c99908704cb61b412f792c8ca))

# [1.17.0](https://github.com/auditmos/auditmos-lp/compare/v1.16.0...v1.17.0) (2026-08-07)


### Features

* **agents:** declare Content Signals in robots.txt and on every response ([7e4d18a](https://github.com/auditmos/auditmos-lp/commit/7e4d18ad778d83d8cf7a4fe94ef35423e75d2762))
* **agents:** publish the negotiation contract in llms.txt and agents.json ([8ae90bd](https://github.com/auditmos/auditmos-lp/commit/8ae90bdf616c7fd68c659092c1834ab645311b7a))

# [1.16.0](https://github.com/auditmos/auditmos-lp/compare/v1.15.0...v1.16.0) (2026-08-07)


### Features

* **agents:** negotiate Accept: text/markdown on page URLs ([8f12369](https://github.com/auditmos/auditmos-lp/commit/8f12369fd4a41ac11d40fb4fa1e2959097d71967))

# [1.15.0](https://github.com/auditmos/auditmos-lp/compare/v1.14.0...v1.15.0) (2026-08-07)


### Features

* **mcp:** rate limit the endpoint and publish the limit to clients ([0d8b30a](https://github.com/auditmos/auditmos-lp/commit/0d8b30af463ba27cdfd0f018ed6041dfee8ac72a))

# [1.14.0](https://github.com/auditmos/auditmos-lp/compare/v1.13.0...v1.14.0) (2026-08-07)


### Features

* **mcp:** serve an MCP agent and publish DNS-AID discovery records ([4acb39d](https://github.com/auditmos/auditmos-lp/commit/4acb39d67096ae282d5ed9f389324b63a0186773))

# [1.13.0](https://github.com/auditmos/auditmos-lp/compare/v1.12.2...v1.13.0) (2026-08-07)


### Features

* **seo:** advertise agent-discovery Link headers and unify the sitemap ([542a920](https://github.com/auditmos/auditmos-lp/commit/542a920a34f8bd3e3edc1ab8e876b7b05a3822c4))

## [1.12.2](https://github.com/auditmos/auditmos-lp/compare/v1.12.1...v1.12.2) (2026-08-05)


### Bug Fixes

* **seo:** fit title and description into scraper limits, add CTA to OG card ([bc2986d](https://github.com/auditmos/auditmos-lp/commit/bc2986d076e704392b4b7b06dfc28243e45d111a))

## [1.12.1](https://github.com/auditmos/auditmos-lp/compare/v1.12.0...v1.12.1) (2026-08-05)


### Bug Fixes

* **seo:** tighten meta description and serve the OG image at 1200x630 ([24e10ec](https://github.com/auditmos/auditmos-lp/commit/24e10ec7f3d020caddc5ea1e78f2acad2d828940))

# [1.12.0](https://github.com/auditmos/auditmos-lp/compare/v1.11.1...v1.12.0) (2026-08-05)


### Bug Fixes

* **contact:** derive the confirmation reply address from CONTACT_TO_EMAIL ([1729185](https://github.com/auditmos/auditmos-lp/commit/1729185950a74770414aa8d427a2d87fd03f208c))


### Features

* **oss:** trim the curated open-source list to seven repositories ([a3ff77b](https://github.com/auditmos/auditmos-lp/commit/a3ff77b18cfa3d8c25d3178cb34109cec8c2656f))

## [1.11.1](https://github.com/auditmos/auditmos-lp/compare/v1.11.0...v1.11.1) (2026-08-05)


### Bug Fixes

* **contact:** bind fetch for workerd to unbreak form submissions ([262dcd7](https://github.com/auditmos/auditmos-lp/commit/262dcd7d3a7450d0c3c00d3f8b61903ac617b130))

# [1.11.0](https://github.com/auditmos/auditmos-lp/compare/v1.10.1...v1.11.0) (2026-08-05)


### Features

* **deploy:** per-environment deploy and secrets tooling ([87011c4](https://github.com/auditmos/auditmos-lp/commit/87011c406e43840bf0fa32cd564663a889e2ffe1))

## [1.10.1](https://github.com/auditmos/auditmos-lp/compare/v1.10.0...v1.10.1) (2026-08-05)


### Bug Fixes

* **copy:** shift page voice from founder first-person to practice voice ([412777f](https://github.com/auditmos/auditmos-lp/commit/412777f8fa6462e3a7e1f66ad78236c539aa1dff))

# [1.10.0](https://github.com/auditmos/auditmos-lp/compare/v1.9.0...v1.10.0) (2026-08-04)


### Features

* **ui:** slash-motif visual identity and branded OG image ([733284a](https://github.com/auditmos/auditmos-lp/commit/733284aafd419191192c8f24678bb9fd5c5e8ada))

# [1.9.0](https://github.com/auditmos/auditmos-lp/compare/v1.8.0...v1.9.0) (2026-08-03)


### Features

* **audits:** derive the public report count from the audits repo ([bf0b07a](https://github.com/auditmos/auditmos-lp/commit/bf0b07adecf44afa731255e7a8f44330a8aefbb4))

# [1.8.0](https://github.com/auditmos/auditmos-lp/compare/v1.7.1...v1.8.0) (2026-08-03)


### Features

* **oss:** curate the open-source list explicitly ([2f21fd5](https://github.com/auditmos/auditmos-lp/commit/2f21fd5d9d27fd54e2a5cbfa60ae26e1a4270eb2))

## [1.7.1](https://github.com/auditmos/auditmos-lp/compare/v1.7.0...v1.7.1) (2026-08-03)


### Bug Fixes

* **home:** align hero divider with the proof-strip grid ([e7a2ce0](https://github.com/auditmos/auditmos-lp/commit/e7a2ce0b9949cb8e3b4d894aa98dbe2820568036))

# [1.7.0](https://github.com/auditmos/auditmos-lp/compare/v1.6.0...v1.7.0) (2026-07-16)


### Features

* reposition site around public-receipts brand ([b049d4f](https://github.com/auditmos/auditmos-lp/commit/b049d4ff035a943ff511c654136b07bd7b24d60c))

# [1.6.0](https://github.com/auditmos/auditmos-lp/compare/v1.5.0...v1.6.0) (2026-07-11)


### Features

* redesign site experience and content hierarchy ([07949d9](https://github.com/auditmos/auditmos-lp/commit/07949d9a7dac2f3b3100868120fc9d86c776ce1a))

# [1.5.0](https://github.com/auditmos/auditmos-lp/compare/v1.4.0...v1.5.0) (2026-07-10)


### Features

* add open-source aggregator and /open-source page ([7187ef1](https://github.com/auditmos/auditmos-lp/commit/7187ef12cdfd2ed642c494c661f0fdf820938af2)), closes [#7](https://github.com/auditmos/auditmos-lp/issues/7)

# [1.4.0](https://github.com/auditmos/auditmos-lp/compare/v1.3.0...v1.4.0) (2026-05-31)


### Features

* add contact form with Turnstile and Resend ([573a183](https://github.com/auditmos/auditmos-lp/commit/573a1836461971706df009cab54fc2441dff284a))

# [1.3.0](https://github.com/auditmos/auditmos-lp/compare/v1.2.0...v1.3.0) (2026-05-28)


### Features

* add markdown mirror endpoints ([6d4b0b4](https://github.com/auditmos/auditmos-lp/commit/6d4b0b46a17b19f7d6c7f4a03747145469876b3f)), closes [#5](https://github.com/auditmos/auditmos-lp/issues/5)

# [1.2.0](https://github.com/auditmos/auditmos-lp/compare/v1.1.0...v1.2.0) (2026-05-28)


### Features

* add projects collection pipeline ([3934474](https://github.com/auditmos/auditmos-lp/commit/3934474ab2920ffa0c5b1617dd2d088443f0e759)), closes [#4](https://github.com/auditmos/auditmos-lp/issues/4)

# [1.1.0](https://github.com/auditmos/auditmos-lp/compare/v1.0.0...v1.1.0) (2026-05-28)


### Features

* add static content pages ([f417329](https://github.com/auditmos/auditmos-lp/commit/f41732994a04cc3875ea18b20cacee6b114dda53)), closes [#3](https://github.com/auditmos/auditmos-lp/issues/3)

# 1.0.0 (2026-05-28)


### Features

* add deployable brand skeleton ([2ca6498](https://github.com/auditmos/auditmos-lp/commit/2ca649849e27d8f77951c72b5b7c55a7c8f34321)), closes [#2](https://github.com/auditmos/auditmos-lp/issues/2)

# [1.1.0](https://github.com/auditmos/astro-on-cf/compare/v1.0.0...v1.1.0) (2026-05-25)


### Features

* **lint:** enable Biome noFloatingPromises rule ([#2](https://github.com/auditmos/astro-on-cf/issues/2)) ([14cc774](https://github.com/auditmos/astro-on-cf/commit/14cc774e76351128e8789174b0d45993493e4d1f))

# 1.0.0 (2026-05-19)


### Features

* align template with Auditmos Cloudflare baseline ([81b8cc2](https://github.com/auditmos/astro-on-cf/commit/81b8cc20cc6edde94cdc437a72f0a946963d917f))
