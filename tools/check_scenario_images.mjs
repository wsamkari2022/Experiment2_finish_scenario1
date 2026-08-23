/**
 * check_scenario_images.mjs — verify the illustration maps against what is on disk.
 *
 *     node tools/check_scenario_images.mjs
 *
 * Reports three kinds of problem, all of which are silent at runtime and would otherwise only
 * surface as a blank frame partway through a block:
 *
 *   MISSING   a path the code maps to a file that does not exist (typo, rename, or an image
 *             that was never run through tools/optimize_scenario_images.py)
 *   UNMAPPED  a converted image that no map entry points at (usually a spare, sometimes a
 *             rung the map forgot)
 *   GAPS      a sub-scenario that is partly illustrated — the most dangerous case, because the
 *             block silently loses its picture for some rungs and keeps it for others
 *
 * Run it after adding artwork, before committing.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PUBLIC_DIR = join(ROOT, "public", "scenario-images");
const MAP_FILE = join(ROOT, "src", "experiment", "scenarioImages.ts");

/* The maps are plain string literals, so the URLs can be lifted straight out of the source
   without importing TypeScript. Every entry is a template literal of the form
   `${CONST}/some/path.webp`, so resolve the folder constants first, then the entries. */
const source = readFileSync(MAP_FILE, "utf8");

/* Folder constants are declared either as a plain string ("/scenario-images") or as a template
   literal that interpolates an earlier one (`${IMAGE_BASE}/Block_3_images`). Capture both, in
   source order, resolving each against the ones already seen. */
const constants = {};
for (const m of source.matchAll(/^const (\w+) = (?:`([^`]+)`|"([^"]+)");/gm)) {
  let value = m[2] ?? m[3];
  for (const [name, resolved] of Object.entries(constants)) {
    value = value.replaceAll("${" + name + "}", resolved);
  }
  constants[m[1]] = value;
}

const mapped = new Set();
for (const m of source.matchAll(/`\$\{(\w+)\}(\/[^`]*\.webp)`/g)) {
  const base = constants[m[1]];
  if (base) mapped.add(base + m[2]);
}

/** Every converted asset actually present, as a site-absolute URL. */
function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".webp")) out.push(p);
  }
  return out;
}
const onDisk = new Set(
  walk(PUBLIC_DIR).map(
    (p) => "/scenario-images/" + relative(PUBLIC_DIR, p).split(sep).join("/"),
  ),
);

/**
 * Converted images that are deliberately not mapped, so the report stays quiet about them.
 *
 * The wealthy-district and shelter sets were drawn with a $5 illustration, but the Block 1
 * amount ladder has no $5 rung (0.25, 1, 10, 20, 50, 100, 1000, 10000). Confirmed as spares —
 * they are extra artwork, not a missing rung.
 */
const KNOWN_SPARES = new Set([
  "/scenario-images/Block1_Shelter_scenario_images/Shelter_5.webp",
  "/scenario-images/Block1_Wealthy_district_scenario_images/Wealth_district_5.webp",
]);

const missing = [...mapped].filter((u) => !onDisk.has(u)).sort();
const unmapped = [...onDisk]
  .filter((u) => !mapped.has(u) && !KNOWN_SPARES.has(u))
  .sort();
for (const spare of KNOWN_SPARES) onDisk.delete(spare);

/* A sub-scenario is the folder an illustration sits in. Partial coverage within one folder is
   the failure worth shouting about. */
const byFolder = {};
for (const u of onDisk) {
  const folder = u.slice(0, u.lastIndexOf("/"));
  byFolder[folder] ??= { total: 0, mapped: 0 };
  byFolder[folder].total += 1;
  if (mapped.has(u)) byFolder[folder].mapped += 1;
}

console.log(`\n  mapped in code : ${mapped.size}`);
console.log(`  present on disk: ${onDisk.size}\n`);

console.log("  coverage by sub-scenario");
for (const [folder, c] of Object.entries(byFolder).sort()) {
  const flag = c.mapped === 0 ? "(none mapped)" : c.mapped < c.total ? "<-- PARTIAL" : "";
  console.log(`    ${String(c.mapped + "/" + c.total).padEnd(7)} ${folder.replace("/scenario-images/", "")}  ${flag}`);
}

if (missing.length) {
  console.log(`\n  MISSING (${missing.length}) — mapped in code but not on disk:`);
  missing.forEach((u) => console.log("    " + u));
}
if (unmapped.length) {
  console.log(`\n  UNMAPPED (${unmapped.length}) — on disk but no map entry:`);
  unmapped.forEach((u) => console.log("    " + u));
}

const partial = Object.entries(byFolder).filter(([, c]) => c.mapped > 0 && c.mapped < c.total);
console.log(
  `\n  ${missing.length === 0 && partial.length === 0 ? "OK — every mapped path resolves, no partly-illustrated sub-scenario" : "PROBLEMS FOUND (see above)"}\n`,
);
process.exit(missing.length || partial.length ? 1 : 0);
