/**
 * THE DATA CHECK (since 16 November 2026; the researcher's "approve, D1-A", PLAN_Data_check.md):
 *
 *   node tools/data_check.cjs "Prolific docs/daily/<date>"        (the same as: npm run data:check -- "...")
 *
 * Reads participants.json in that folder (Compass's export of `participants`, the same file the pay check reads) and
 * writes DATA_CHECK.html beside it. For every record with a Prolific ID it says whether the record is complete:
 *
 *   - who: the Prolific ID with Prolific's study and session ids, recruitment_source "prolific", no email in the record;
 *   - finished, or the stage it stopped at;
 *   - the four "about you" answers, the consent with today's version, one of the four conditions from the landing page;
 *   - every saved section a finished record carries (36: read from the study's own code, see `codeFacts`), with the
 *     rows each per-scenario section must hold;
 *   - the main scores saved as numbers from 0 to 100 (the reflection scores empty only in APA_Only and Baseline, where
 *     the study does not measure them), and the same in their three places (the main study's own record, `headline`,
 *     `major_info_and_scores`), and the condition the same on the record and in `major_info_and_scores`;
 *   - the study's own self-checks agree; the completion code was shown; `resume_state` gone after finishing.
 *
 * A TECHNICAL CHECK ONLY. The OSF plan: during data collection the research team looks at completion times, technical
 * problems and Prolific's payment rules, never at a measure used in the hypotheses. So the page and the console show
 * "there" or "missing", "agree" or "disagree", names and counts, and NEVER a value: no score, no age, no answer, no
 * code, no email. A self-check block can hold a score (`vci_all_recomputed_from_the_rows`): only its yes/no fields are
 * read. "Complete" means every part is in the database; it says nothing about how good the answers are.
 *
 * Nothing is changed anywhere. The page holds Prolific IDs, so it stays in `Prolific docs/` (never GitHub, never an AI
 * tool); the console's summary has counts and part names only, so it can be shared. `npm run validate:datacheck`
 * stands over this file, including complete pretend records built by the study's real code in all four conditions.
 */
const fs = require("fs");
const path = require("path");
const { readParticipants, EMAIL } = require("./pay_check.cjs");

const ROOT = path.join(__dirname, "..");

/* ------------------------------------------------------------------ what the study's code says a record holds */

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

/**
 * Read from the study's code at run time, so nothing here can fall out of date:
 *   sections        every `path: "..."` storage.ts and dbShape.ts send, comments left out, minus `resume_state`
 *                   (a finished record must NOT have it: the completion route removes it)
 *   consentVersion  PROLIFIC_CONSENT_VERSION in ConsentPage.tsx
 *   conditions      the four conditions in server/conditions.js
 *   countedSource   the condition source the landing page writes (COUNTED_SOURCE)
 */
function codeFacts(root = ROOT) {
  const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
  const code = stripComments(read("src/experiment/storage.ts") + "\n" + read("src/experiment/dbShape.ts"));
  const all = new Set([...code.matchAll(/path: "([a-z0-9_]+(?:\.[a-z0-9_]+)?)"/g)].map((m) => m[1]));
  const sections = [...all].filter((p) => p !== "resume_state").sort();
  const consent = /PROLIFIC_CONSENT_VERSION = "([^"]+)"/.exec(read("src/experiment/ConsentPage.tsx"));
  const conditionsSrc = stripComments(read("server/conditions.js"));
  const conditions = [...conditionsSrc.matchAll(/\{ number: (\d), type: "([^"]+)"/g)].map((m) => ({ number: Number(m[1]), type: m[2] }));
  const counted = /COUNTED_SOURCE = "([^"]+)"/.exec(conditionsSrc);
  if (sections.length < 30 || !consent || conditions.length !== 4 || !counted) {
    throw new Error("could not read the study's code (run this from the project folder, where package.json is)");
  }
  return { sections, consentVersion: consent[1], conditions, countedSource: counted[1] };
}

/** How many rows each per-scenario part holds in a finished record (six scenarios; the position effect has no row for
 *  scenario 6, which has no position). Checked against the real builders by validate:datacheck X9. */
const ROWS = [
  ["blocks.block5_emergency_scenarios.scenarioResults", 6],
  ["analysis.alignment_records.by_scenario", 6],
  ["analysis.mpf_predictions_every_scenario.by_scenario", 6],
  ["analysis.value_profile_by_scenario.by_scenario", 6],
  ["analysis.card_order_by_scenario.by_scenario", 6],
  ["analysis.mcf.by_scenario", 6],
  ["analysis.value_moves_asked_for_and_made.by_scenario", 6],
  ["analysis.position_effect.by_scenario", 5],
];

/** The main scores: [name, headline field, the main study's own field (or null), the copy in major_info_and_scores]. */
const MAIN_SCORES = [
  ["VCI (the 4 decisions)", "consistency_score", "vci", "vci.overall_score"],
  ["VCI_all (all 6 scenarios)", "consistency_score_all_six", "vciAll", "vci.all_six_scenarios_score"],
  ["Stability", "stability_score", "stability", "stability.score"],
  ["Stability, order part", "value_order_stability", "valueOrderStability", "stability.value_order_stability"],
  ["Stability, difference part", "value_difference_stability", "valueDifferenceStability", "stability.value_difference_stability"],
  ["Stability_all", "stability_all_score", "stabilityAll", "stability.all_six_scenarios_score"],
  ["Stability_all, order part", "value_order_stability_all", "valueOrderStabilityAll", "stability.all_six_scenarios_value_order_stability"],
  ["Stability_all, difference part", "value_difference_stability_all", "valueDifferenceStabilityAll", "stability.all_six_scenarios_value_difference_stability"],
  ["Performance", "performance_score", null, "performance.score"],
  ["Performance captured", "performance_captured", null, "performance.captured"],
  ["Position effect", "position_effect", null, "position_effect.overall"],
];
/** Measured only in conditions 1 and 2; empty (null) by design in APA_Only and Baseline ("reflection_scores_measured"). */
const REFLECTION_SCORES = [
  ["Directness stability", "directness_stability_score", "stability.directness_score"],
  ["Context stability", "context_stability_score", "stability.context_score"],
  ["Stakeholder stability", "stakeholder_stability_score", "stability.stakeholder_score"],
];
const NOT_MEASURED_IN = new Set(["APA_Only", "Baseline"]);

/** The study's own self-checks: only these yes/no fields are read, never the numbers beside them. */
const SELF_CHECKS = [
  ["the profile after every scenario", "analysis.value_profile_by_scenario.self_check.agrees"],
  ["the predictions in every scenario", "analysis.mpf_predictions_every_scenario.self_check.passed"],
  ["VCI_all's running fits", "analysis.vci_all.self_check.saved_and_rebuilt_agree"],
  ["VCI_all against the saved one", "analysis.vci_all.self_check.matches_the_saved_vci_all"],
  ["Stability_all against the saved one", "analysis.stability_all.self_check.matches_the_saved_stability_all"],
  ["Stability_all is the average of its two parts", "analysis.stability_all.self_check.is_the_average_of_its_two_parts"],
  ["Stability_all's decisions part equals Stability's swaps", "analysis.stability_all.self_check.decisions_part_equals_stability_swaps"],
];

/** The fields the server writes on a record (server/index.js, server/conditions.js). */
const ABOUT_YOU = [["age", (v) => (typeof v === "number" && Number.isFinite(v)) || (typeof v === "string" && /^\d+$/.test(v))],["gender", (v) => typeof v === "string" && !!v],
  ["country", (v) => typeof v === "string" && !!v], ["english_first_language", (v) => typeof v === "boolean"]];

/* ------------------------------------------------------------------ reading one record */

const get = (obj, dotted) => dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const isScore = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
const there = (v) => v !== undefined && v !== null;

/** Where in the record an email-like text sits: the PATHS only, never the text. */
function emailPaths(doc) {
  const out = [];
  const walk = (v, at) => {
    if (typeof v === "string") { if (EMAIL.test(v)) out.push(at || "(the record)"); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, at ? `${at}.${k}` : k);
  };
  walk(doc, "");
  return out;
}

/**
 * One record -> its checklist. Each item: { label, value, state, problems }. state: ok, warn (a note), bad (something
 * missing or disagreeing), info, na (not judged). `problems` are short names without any value, gathered across
 * everyone at the top of the page and in the console.
 */
function checkRecord(doc, facts) {
  const items = [];
  const add = (label, value, state, problems = []) => items.push({ label, value, state, problems });
  const finished = doc.status === "Study Completed";
  const judge = (bad) => (finished ? bad : "info");

  /* 1. Who. Prolific's study and session ids arrive only through Prolific's link: somebody who pasted their ID on the
     first page has none, which is a note, not missing data. The study's own session id and the source must be there. */
  {
    const fromLink = ["prolific_study_id", "prolific_session_id"].filter((k) => !there(doc[k]));
    const own = ["participant_id"].filter((k) => !there(doc[k]));
    const notProlific = doc.recruitment_source !== "prolific";
    const bad = own.length || notProlific;
    const value = [own.length ? `missing: ${own.join(", ")}` : "", notProlific ? "recruitment_source is not \"prolific\"" : "",
      fromLink.length ? `no ${fromLink.join(" or ")} (they may have pasted their ID instead of using Prolific's link)` : ""].filter(Boolean).join("; ");
    add("Prolific ID, with Prolific's study and session ids", value || "all there", bad ? judge("bad") : fromLink.length ? (finished ? "warn" : "info") : "ok",
      [...own.map((k) => `missing ${k}`), ...(notProlific ? ["recruitment_source not prolific"] : []), ...fromLink.map((k) => `no ${k}`)]);
  }
  /* 2. Finished */
  add("Finished the study", finished ? "yes" : `no${doc.current_stage ? ` (stopped at "${doc.current_stage}")` : ""}`, finished ? "ok" : "info");

  if (!finished) {
    const answers = ["blocks.block1_money", "blocks.block2_trolley", "blocks.block3_ai_workforce", "blocks.block4_stakeholder_reflection",
      "blocks.block5_emergency_scenarios", "blocks.feedback_answers"].filter((p) => there(get(doc, p))).length;
    add("Saved so far", `${answers} of the 6 answer parts (Blocks 1-4, the main study, the feedback)`, "info");
    add("Everything else", "not judged: the study is not finished", "na");
    return { finished, items };
  }

  /* 3. About you */
  {
    const missing = ABOUT_YOU.filter(([k, ok]) => !ok(doc[k])).map(([k]) => k);
    add("The four \"about you\" answers", missing.length ? `missing: ${missing.join(", ")}` : "age, gender, country, English first language: all there",
      missing.length ? "bad" : "ok", missing.map((k) => `missing ${k}`));
  }
  /* 4. Consent */
  {
    const c = doc.consent;
    const agreed = c && c.agreed === true;
    const sameVersion = c && c.version === facts.consentVersion;
    add("Consent", !agreed ? "no consent saved" : sameVersion ? "agreed, today's consent version" : "agreed, but an older consent version",
      !agreed ? "bad" : sameVersion ? "ok" : "warn", !agreed ? ["no consent"] : sameVersion ? [] : ["older consent version"]);
  }
  /* 5. Condition */
  {
    const known = facts.conditions.find((k) => k.number === doc.condition_number && k.type === doc.condition_type);
    const counted = doc.condition_source === facts.countedSource;
    const arrival = there(doc.condition_arrival_id);
    const copy = get(doc, "major_info_and_scores.condition");
    const copyAgrees = copy && copy.condition_number === doc.condition_number && copy.condition_type === doc.condition_type;
    const problems = [];
    if (!known) problems.push("no valid condition");
    else {
      if (!counted) problems.push("condition not from the landing page");
      if (!arrival) problems.push("condition without its arrival id");
      if (!copyAgrees) problems.push("condition differs in major_info_and_scores");
    }
    const value = !known ? "no valid condition on the record"
      : [`${doc.condition_type}`, counted ? "given by the landing page" : `source "${doc.condition_source ?? "none"}" (not counted for the balance)`,
        arrival ? "" : "no arrival id", copyAgrees ? "the same in major_info_and_scores" : "different or missing in major_info_and_scores"].filter(Boolean).join(" · ");
    add("Condition", value, !known || !copyAgrees ? "bad" : (!counted || !arrival) ? "warn" : "ok", problems);
  }
  /* 6-8. The saved sections, in three families */
  {
    const fam = (prefix) => facts.sections.filter((p) => (prefix ? p.startsWith(prefix) : !p.includes(".")));
    for (const [label, list, words] of [
      ["The answers", fam("blocks."), "Blocks 1-4, the main study, scenarios 5 and 6, the feedback"],
      ["The analysis parts", fam("analysis."), "everything the study works out from the answers"],
      ["The summary parts", fam(""), "headline, quality, major scores, timings, working time, logins"],
    ]) {
      const missing = list.filter((p) => !there(get(doc, p)));
      add(`${label} (${list.length})`, missing.length ? `missing ${missing.length}: ${missing.join(", ")}` : `all ${list.length} there (${words})`,
        missing.length ? "bad" : "ok", missing.map((p) => `missing ${p}`));
    }
    const short = ROWS.filter(([p, n]) => there(get(doc, p.split(".").slice(0, -1).join("."))))
      .map(([p, n]) => [p, n, Array.isArray(get(doc, p)) ? get(doc, p).length : null]).filter(([, n, have]) => have !== n);
    add("Rows for every scenario", short.length ? short.map(([p, n, have]) => `${p}: ${have === null ? "none" : have} of ${n}`).join("; ") : "6 of 6 in every part (5 of 5 for the position effect)",
      short.length ? "bad" : "ok", short.map(([p]) => `wrong number of rows in ${p}`));
  }
  /* 9. The main scores: saved, and a number from 0 to 100 */
  {
    const h = doc.headline ?? {};
    const notSaved = MAIN_SCORES.filter(([, hk]) => !isScore(h[hk])).map(([name]) => name);
    const sixDone = h.scenarios_completed === 6;
    add(`Main scores saved (${MAIN_SCORES.length})`, notSaved.length || !sixDone
      ? [notSaved.length ? `not a number from 0 to 100: ${notSaved.join(", ")}` : "", sixDone ? "" : "the headline does not say 6 scenarios"].filter(Boolean).join("; ")
      : "VCI, VCI_all, Stability and Stability_all with their parts, performance, captured, position effect: all saved",
    notSaved.length || !sixDone ? "bad" : "ok", [...notSaved.map((n) => `score not saved: ${n}`), ...(sixDone ? [] : ["headline not 6 scenarios"])]);

    const measured = h.reflection_scores_measured;
    const byDesignEmpty = NOT_MEASURED_IN.has(doc.condition_type);
    let state = "ok", value, problems = [];
    if (measured === true && !byDesignEmpty) {
      const bad = REFLECTION_SCORES.filter(([, hk]) => !isScore(h[hk])).map(([name]) => name);
      value = bad.length ? `not a number from 0 to 100: ${bad.join(", ")}` : "directness, context, stakeholder: all saved";
      if (bad.length) { state = "bad"; problems = bad.map((n) => `score not saved: ${n}`); }
    } else if (measured === false && byDesignEmpty) {
      const filled = REFLECTION_SCORES.filter(([, hk]) => h[hk] !== null).map(([name]) => name);
      value = filled.length ? `should be empty in ${doc.condition_type}: ${filled.join(", ")}` : `not measured in ${doc.condition_type}, by design (empty)`;
      if (filled.length) { state = "bad"; problems = ["reflection scores filled where not measured"]; }
    } else {
      state = "bad";
      value = `"measured" says ${measured === undefined ? "nothing" : String(measured)}, but the condition is ${doc.condition_type ?? "missing"}`;
      problems = ["reflection scores do not match the condition"];
    }
    add("Reflection scores (3)", value, state, problems);
  }
  /* 10. The same score in its three places */
  {
    const h = doc.headline ?? {};
    const b5 = get(doc, "blocks.block5_emergency_scenarios") ?? {};
    const major = doc.major_info_and_scores ?? {};
    const same = (a, b) => (a ?? null) === (b ?? null);
    const differ = [];
    for (const [name, hk, bk, mk] of MAIN_SCORES) {
      if (bk && !same(b5[bk], h[hk])) differ.push(`${name} (main study / headline)`);
      if (!same(h[hk], get(major, mk))) differ.push(`${name} (headline / major scores)`);
    }
    for (const [name, hk, mk] of REFLECTION_SCORES) if (!same(h[hk], get(major, mk))) differ.push(`${name} (headline / major scores)`);
    const n = MAIN_SCORES.length + REFLECTION_SCORES.length;
    add("Each score the same in its places", differ.length ? `different: ${differ.join(", ")}` : `all ${n} the same in the main study, the headline and the major scores`,
      differ.length ? "bad" : "ok", differ.map((d) => `copies differ: ${d}`));
  }
  /* 11. The study's own self-checks */
  {
    const failed = [], counted = [];
    for (const [name, p] of SELF_CHECKS) {
      const v = get(doc, p);
      if (v === true) counted.push(name);
      else if (v === false) failed.push(name);
    }
    const cards = get(doc, "analysis.card_order_by_scenario.by_scenario");
    const cardFlags = Array.isArray(cards) ? cards.map((r) => r && r.order_rebuilt_from_these_inputs_matches_the_order_stored) : [];
    const cardBad = cardFlags.filter((v) => v === false).length;
    if (cardBad) failed.push(`the card order in ${cardBad} scenario(s)`);
    else if (cardFlags.some((v) => v === true)) counted.push("the card order");
    add("The study's own self-checks", failed.length ? `disagree: ${failed.join(", ")}` : `${counted.length} checked, all agree`,
      failed.length ? "bad" : "ok", failed.map((f) => `self-check disagrees: ${f}`));
  }
  /* 12. The code, the leftovers, privacy */
  add("Completion code shown on our last page", there(doc.prolific_code_given_at) ? "yes" : "no", there(doc.prolific_code_given_at) ? "ok" : "bad",
    there(doc.prolific_code_given_at) ? [] : ["code never shown"]);
  add("Half-finished copy removed", there(doc.resume_state) ? "still there (the completion did not remove it)" : "removed, as it should be",
    there(doc.resume_state) ? "warn" : "ok", there(doc.resume_state) ? ["resume_state still there"] : []);
  {
    const at = emailPaths(doc);
    add("No email in the record", at.length ? `an email-like text in: ${at.slice(0, 5).join(", ")}${at.length > 5 ? ` and ${at.length - 5} more` : ""}` : "none",
      at.length ? "warn" : "ok", at.length ? ["an email-like text in the record"] : []);
  }
  return { finished, items };
}

/* ------------------------------------------------------------------ everyone */

function dataCheck(docs, facts) {
  const prolific = docs.filter((d) => d && typeof d.prolific_pid === "string" && d.prolific_pid);
  const skipped = docs.length - prolific.length;
  const seen = new Map();
  for (const d of prolific) {
    const k = d.prolific_pid.toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const rows = prolific.map((d) => {
    const { finished, items } = checkRecord(d, facts);
    const twice = seen.get(d.prolific_pid.toLowerCase()) > 1;
    if (twice) items.unshift({ label: "One record per Prolific ID", value: `this Prolific ID has ${seen.get(d.prolific_pid.toLowerCase())} records`, state: "bad", problems: ["the same Prolific ID twice"] });
    const bad = items.some((i) => i.state === "bad");
    const warn = items.some((i) => i.state === "warn");
    const group = !finished && !twice ? "notFinished" : bad ? "missing" : "complete";
    return { pid: d.prolific_pid, condition: d.condition_type ?? null, finished, group, warn, items };
  });
  const groups = { missing: rows.filter((r) => r.group === "missing"), complete: rows.filter((r) => r.group === "complete"), notFinished: rows.filter((r) => r.group === "notFinished") };
  /* Each problem, how many records, and in which conditions: no ID, no value. */
  const problems = new Map();
  for (const r of rows) {
    for (const i of r.items) for (const p of i.problems) {
      if (i.state !== "bad" && i.state !== "warn") continue;
      const e = problems.get(p) ?? { problem: p, serious: i.state === "bad", records: 0, conditions: new Set() };
      e.records += 1;
      e.conditions.add(r.condition ?? "no condition");
      problems.set(p, e);
    }
  }
  const byCondition = facts.conditions.map((c) => ({ type: c.type,
    finished: rows.filter((r) => r.finished && r.condition === c.type).length,
    complete: rows.filter((r) => r.group === "complete" && r.condition === c.type).length }));
  return { rows, groups, skipped, duplicates: [...seen.values()].filter((n) => n > 1).length,
    problems: [...problems.values()].sort((a, b) => Number(b.serious) - Number(a.serious) || b.records - a.records)
      .map((e) => ({ ...e, conditions: [...e.conditions].sort() })), byCondition, sections: facts.sections.length };
}

/** The console summary: counts and part names only (no Prolific ID, no value), so it can be shared. */
function summaryLines(result, date) {
  const g = result.groups;
  const lines = [`Data check ${date}: ${result.rows.length} Prolific records - complete ${g.complete.length}${g.complete.filter((r) => r.warn).length ? ` (${g.complete.filter((r) => r.warn).length} with a note)` : ""}, something missing ${g.missing.length}, not finished ${g.notFinished.length}${result.duplicates ? `, same Prolific ID twice ${result.duplicates}` : ""}${result.skipped ? `; ${result.skipped} record(s) without a Prolific ID skipped` : ""}.`];
  lines.push(`Finished per condition: ${result.byCondition.map((c) => `${c.type} ${c.finished}`).join(", ")}.`);
  if (result.problems.length) {
    lines.push("Found (no IDs, no values):");
    for (const p of result.problems) lines.push(`  ${p.serious ? "x" : "!"} ${p.problem}: ${p.records} record(s) (${p.conditions.join(", ")})`);
  } else lines.push("Nothing missing and nothing disagreeing.");
  return lines;
}

/* ------------------------------------------------------------------ the page */

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MARK = { ok: "✓", warn: "!", bad: "✗", info: "•", na: "–" };
const PAGE_GROUPS = [
  { key: "missing", title: "Something missing", tone: "red", mark: "✗", short: "Finished, but a part is missing or disagrees",
    todo: "Each card names the part. Tell Claude the part's name and the condition (never the Prolific ID)." },
  { key: "complete", title: "Complete", tone: "green", mark: "✓", short: "Finished, every part there and agreeing",
    todo: "Nothing to do. A card with a ! has a note worth reading, but nothing is missing." },
  { key: "notFinished", title: "Not finished", tone: "slate", mark: "…", short: "Returned, timed out or still working",
    todo: "Nothing to check: an unfinished record is expected to be incomplete." },
];

function cardHtml(row, g) {
  const n = (st) => row.items.filter((i) => i.state === st).length;
  const clean = !n("bad") && !n("warn");
  const brief = `${n("ok")} ✓${n("warn") ? ` · ${n("warn")} !` : ""}${n("bad") ? ` · ${n("bad")} ✗` : ""}`;
  return `<article class="card t-${g.tone}" data-pid="${esc(row.pid)}" data-group="${g.key}">
  <div class="card-head"><span class="badge">${g.mark} ${esc(g.title)}</span><code class="pid">${esc(row.pid)}</code><button type="button" class="copy" data-copy="${esc(row.pid)}">Copy ID</button>${row.condition ? `<span class="cond">${esc(row.condition)}</span>` : ""}</div>
  <details class="checklist"${clean ? "" : " open"}><summary><span class="sum-t">Checklist</span> <span class="sum-b">${esc(brief)}</span>${clean ? ' <span class="sum-ok">everything there · click to see</span>' : ""}</summary><ul class="checks">${row.items.map((i) => `<li class="s-${i.state}"><span class="mark" aria-hidden="true">${MARK[i.state]}</span><span class="label">${esc(i.label)}</span><span class="value">${esc(i.value)}</span></li>`).join("")}</ul></details>
</article>`;
}

function reportHtml(result, { date, file }) {
  const { groups, problems, byCondition } = result;
  const tiles = PAGE_GROUPS.map((g) => `<a class="tile t-${g.tone}" href="#g-${g.key}"><span class="n">${groups[g.key].length}</span><span class="t">${g.mark} ${esc(g.title)}</span><span class="d">${esc(g.short)}</span></a>`).join("")
    + (result.duplicates ? `<a class="tile t-amber" href="#g-missing"><span class="n">${result.duplicates}</span><span class="t">! Same Prolific ID twice</span><span class="d">Listed under "Something missing"</span></a>` : "")
    + (result.skipped ? `<div class="tile t-slate"><span class="n">${result.skipped}</span><span class="t">• Without a Prolific ID</span><span class="d">Skipped: test records from before Prolific only</span></div>` : "");
  const notes = groups.complete.filter((r) => r.warn).length;
  const verdict = groups.missing.length === 0 && !result.duplicates
    ? `<div class="alert ok">Every finished record is complete: all ${result.sections} saved parts are there, the main scores are saved and the same in their places, and the study's own self-checks agree${notes ? ` (${notes} card(s) carry a note marked !)` : ""}.</div>`
    : `<div class="alert bad">${groups.missing.length} finished record(s) have a part missing or disagreeing. The list below says which part, without IDs.</div>`;
  const problemRows = problems.map((p) => `<tr><td><span class="pm s-${p.serious ? "bad" : "warn"}">${p.serious ? "✗" : "!"}</span> ${esc(p.problem)}</td><td>${p.records}</td><td>${esc(p.conditions.join(", "))}</td></tr>`).join("");
  const sections = PAGE_GROUPS.map((g) => `<section class="group t-${g.tone}" id="g-${g.key}">
  <h2><span class="badge">${g.mark} ${esc(g.title)}</span> <span class="count">${groups[g.key].length}</span></h2>
  <p class="todo">${esc(g.todo)}</p>
  ${groups[g.key].length ? `<div class="cards">${groups[g.key].map((r) => cardHtml(r, g)).join("\n")}</div>` : `<p class="none">Nobody.</p>`}
</section>`).join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Data check ${esc(date)}</title>
<style>
:root{--bg:#f6f7fb;--panel:#fff;--fg:#1c2230;--muted:#5d6678;--line:#dfe3ec;--ok:#15803d;--warn:#b45309;--bad:#b91c1c;--info:#475569;--na:#8a93a3;
--green:#16a34a;--red:#dc2626;--amber:#d97706;--slate:#64748b;--blue:#2563eb;--tint:8%}
@media (prefers-color-scheme:dark){:root{--bg:#10141c;--panel:#181e29;--fg:#e8ecf3;--muted:#a2abbb;--line:#2b3445;--ok:#4ade80;--warn:#fbbf24;--bad:#f87171;--info:#94a3b8;--na:#6b7485;--tint:16%}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}h1{font-size:26px;margin:0 0 4px}h2{font-size:20px;margin:0;display:flex;align-items:center;gap:10px}
.sub{color:var(--muted);margin:0 0 16px}.private{border:1px solid var(--line);border-left:5px solid var(--slate);background:var(--panel);padding:10px 14px;border-radius:10px;margin:0 0 16px;color:var(--muted)}
.alert{border-radius:10px;padding:12px 14px;margin:0 0 16px;font-weight:600}.alert.bad{background:color-mix(in srgb,var(--red) var(--tint),var(--panel));border:1px solid var(--red)}
.alert.ok{background:color-mix(in srgb,var(--green) var(--tint),var(--panel));border:1px solid var(--green)}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin:0 0 18px}
.tile{display:flex;flex-direction:column;gap:2px;text-decoration:none;color:var(--fg);background:var(--panel);border:1px solid var(--line);border-top:5px solid var(--c);border-radius:12px;padding:12px 14px}
.tile .n{font-size:30px;font-weight:800;color:var(--c);line-height:1.1}.tile .t{font-weight:700}.tile .d{font-size:13px;color:var(--muted)}
.t-green{--c:var(--green)}.t-red{--c:var(--red)}.t-amber{--c:var(--amber)}.t-slate{--c:var(--slate)}.t-blue{--c:var(--blue)}
.box{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;margin:0 0 18px}.box h2{margin-bottom:8px}
.find{display:flex;gap:8px;align-items:center;margin:0 0 18px}.find input{flex:1;min-width:0;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--fg);font:inherit}
.group{background:var(--panel);border:1px solid var(--line);border-left:6px solid var(--c);border-radius:14px;padding:16px;margin:0 0 18px}
.badge{display:inline-flex;align-items:center;gap:6px;background:var(--c);color:#fff;font-weight:700;border-radius:999px;padding:3px 12px;font-size:14px;white-space:nowrap}
.count{color:var(--muted);font-weight:700}.todo{margin:6px 0 12px;color:var(--muted)}.none{color:var(--muted);font-style:italic;margin:0}
.cards{display:grid;gap:12px}.card{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:color-mix(in srgb,var(--c) var(--tint),var(--panel))}
.card-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px}.pid{font:600 15px/1.3 ui-monospace,Consolas,monospace;word-break:break-all}
.cond{margin-left:auto;font-size:13px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:2px 10px;background:var(--panel)}
.copy{border:1px solid var(--line);background:var(--panel);color:var(--fg);border-radius:8px;padding:4px 10px;font:inherit;font-size:13px;cursor:pointer}.copy:hover{border-color:var(--c,var(--slate))}
.checklist summary{cursor:pointer;padding:6px 10px;border-radius:10px;background:var(--panel);border:1px solid var(--line);list-style-position:inside}.checklist[open] summary{margin-bottom:8px}.sum-t{font-weight:700}.sum-b{font-weight:600}.sum-ok{color:var(--ok);font-size:13px}
.checks{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:6px}
.checks li{display:grid;grid-template-columns:26px 1fr;grid-template-rows:auto auto;column-gap:8px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:7px 10px}
.checks .mark,.pm{grid-row:1/3;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-weight:800;color:#fff}
.checks .label{font-size:13px;color:var(--muted)}.checks .value{font-weight:600;overflow-wrap:anywhere}
.s-ok .mark{background:var(--ok)}.s-warn .mark,.pm.s-warn{background:var(--warn)}.s-bad .mark,.pm.s-bad{background:var(--bad)}.s-info .mark{background:var(--info)}.s-na .mark{background:var(--na)}
.checks .s-bad{border-color:var(--bad)}.checks .s-warn{border-color:var(--warn)}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:middle}th{color:var(--muted);font-size:13px}
.rules{color:var(--muted);font-size:14px}.rules ul{padding-left:20px}.hidden{display:none!important}
.tablewrap{overflow-x:auto}
</style></head>
<body><main>
<h1>Data check · ${esc(date)}</h1>
<p class="sub">Read: <code>${esc(file)}</code> (records with a Prolific ID only). Nothing was changed anywhere.</p>
<p class="private"><b>Private.</b> This page holds Prolific IDs. Keep it in <code>Prolific docs/</code>; never send it to an AI tool or to anybody else. It shows <b>no value</b> of anything: no score, no age, no answer, no code. Only "there" or "missing", "the same" or "different".</p>
${verdict}
<div class="tiles">${tiles}</div>
<section class="box"><h2>Finished per condition</h2><div class="tablewrap"><table><thead><tr><th>Condition</th><th>Finished</th><th>Complete</th></tr></thead><tbody>${byCondition.map((c) => `<tr><td>${esc(c.type)}</td><td>${c.finished}</td><td>${c.complete}</td></tr>`).join("")}</tbody></table></div></section>
<section class="box" id="found"><h2>Missing or different, across everyone</h2>${problems.length
    ? `<div class="tablewrap"><table><thead><tr><th>What</th><th>Records</th><th>Conditions</th></tr></thead><tbody>${problemRows}</tbody></table></div><p class="todo">✗ = something missing or different. ! = a note. If one line is true for every record in a condition, the check may expect something that condition does not have: tell Claude that line.</p>`
    : `<p class="none">Nothing missing and nothing different.</p>`}</section>
<div class="find"><label for="find"><b>Find a Prolific ID</b></label><input id="find" type="search" placeholder="Type or paste part of an ID"></div>
${sections}
<section class="rules"><h2>What this checks</h2><ul>
<li><b>Complete</b> means every part a finished record carries is in the database (${result.sections} saved parts, read from the study's own code), the main scores are saved as numbers from 0 to 100 and are the same in the main study's record, the headline and the major scores, and the study's own self-checks agree. It says nothing about how good the answers are.</li>
<li>The reflection scores (directness, context, stakeholder) are empty on purpose in APA_Only and Baseline: the study does not measure them there.</li>
<li>Export when nobody is working: a record that finished a minute before the export may still be sending its last parts.</li>
<li>The second collection, <code>condition_arrivals</code>, is not in this file and is not checked.</li>
<li>Made by <code>tools/data_check.cjs</code> (<code>npm run data:check</code>).</li></ul></section>
</main>
<script>
(function(){
  function copied(btn){var o=btn.textContent;btn.textContent="Copied";setTimeout(function(){btn.textContent=o;},1200);}
  function copy(text,btn){
    function fallback(){var t=document.createElement("textarea");t.value=text;document.body.appendChild(t);t.select();try{document.execCommand("copy");copied(btn);}catch(e){}t.remove();}
    if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(function(){copied(btn);},fallback);}else{fallback();}
  }
  document.addEventListener("click",function(e){var b=e.target.closest("[data-copy]");if(!b)return;copy(b.getAttribute("data-copy"),b);});
  var find=document.getElementById("find");
  find.addEventListener("input",function(){var q=find.value.trim().toLowerCase();
    document.querySelectorAll("[data-pid]").forEach(function(el){el.classList.toggle("hidden",!!q&&el.getAttribute("data-pid").toLowerCase().indexOf(q)<0);});});
})();
</script>
</body></html>
`;
  if (EMAIL.test(html.replace(/<style>[\s\S]*?<\/style>|<script>[\s\S]*?<\/script>/g, ""))) {
    throw new Error("the page would contain an email address; nothing was written");
  }
  return html;
}

/* ------------------------------------------------------------------ the command */

function main(argv) {
  const dir = argv.find((a) => !a.startsWith("--"));
  if (!dir) throw new Error('give the day\'s folder holding participants.json, for example: node tools/data_check.cjs "Prolific docs/daily/2026-11-16"');
  const outDir = path.resolve(dir);
  const dbFile = path.join(outDir, "participants.json");
  if (!fs.existsSync(dbFile)) throw new Error(`there is no participants.json in ${outDir}`);
  const facts = codeFacts();
  const result = dataCheck(readParticipants(fs.readFileSync(dbFile, "utf8")), facts);
  const date = path.basename(outDir);
  const html = reportHtml(result, { date, file: "participants.json" });
  fs.writeFileSync(path.join(outDir, "DATA_CHECK.html"), html);
  for (const l of summaryLines(result, date)) console.log(l);
  console.log(`Written: ${path.join(outDir, "DATA_CHECK.html")} (open it in your browser)`);
  return result;
}

module.exports = { codeFacts, checkRecord, dataCheck, summaryLines, reportHtml, emailPaths, main, ROWS, MAIN_SCORES, REFLECTION_SCORES, SELF_CHECKS };

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`Data check stopped: ${e.message}`);
    process.exit(1);
  }
}
