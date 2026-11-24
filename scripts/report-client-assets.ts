import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

const root = "dist/client";
const files = readdirSync(root, { recursive: true, withFileTypes: true })
	.filter((file) => file.isFile() && /\.(?:[cm]?js|css)$/.test(file.name))
	.map((file) => join(file.parentPath, file.name))
	.sort();
const totals = { JS: { raw: 0, brotli: 0 }, CSS: { raw: 0, brotli: 0 } };

console.log("## Client build assets");
console.log("");
console.log("| File in `dist/client` | Raw bytes | Brotli q11 bytes |");
console.log("| --- | ---: | ---: |");
for (const file of files) {
	const body = readFileSync(file);
	const brotli = brotliCompressSync(body, {
		params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_LGWIN]: 22 },
	}).length;
	const total = file.endsWith(".css") ? totals.CSS : totals.JS;
	total.raw += body.length;
	total.brotli += brotli;
	console.log(`| \`${relative(root, file)}\` | ${body.length} | ${brotli} |`);
}
for (const [type, { raw, brotli }] of Object.entries(totals)) {
	console.log(`| **${type} total** | ${raw} | ${brotli} |`);
}
