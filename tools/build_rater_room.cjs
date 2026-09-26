/**
 * build_rater_room.cjs — makes the four "rater rooms": one folder per blind rater, OUTSIDE this
 * project, where each rater is run in its own Claude Code session (audit Fix 3 Step B).
 *
 * WHY SEPARATE FOLDERS (26 September 2026). The researcher's rule for the raters: they must not
 * modify the code or reach the code. Two things make a session opened in this project unsafe for that:
 *   - agent types in .claude/agents load only when a session starts, so the no-tools rater cannot be
 *     added to a session already running;
 *   - a Claude Code session, and its helpers, read the project's CLAUDE.md, and CLAUDE.md quotes real
 *     option value numbers (for example the two wildfire numbers of 26 September). A rater that saw
 *     them would no longer be blind.
 * Each room holds ONLY what its rater may see: its own shuffled sheet, the rater as a no-tools agent
 * type, a probe file and a run-book. No CLAUDE.md, no code, and never the answer keys (letter ->
 * option id), which stay in Generated Outputs/rater_study in this project.
 *
 * HOW A ROOM IS USED. The researcher opens a new Code session in the room, picks the room's model and
 * types "Follow RUNBOOK.md". That session only organizes: it proves with a probe that the rater has no
 * tools and no project notes, hands the sheet to ONE rater (the no-tools agent type, running on the
 * session's own model), and saves the answer unchanged to answer.json, with run_notes.md beside it.
 *
 *   node tools/build_rater_sheet.cjs "Generated Outputs/rater_study"
 *   node tools/build_rater_room.cjs "<parent folder outside this project>"
 * Afterwards:
 *   node tools/compare_ratings.cjs "Generated Outputs/rater_study" --rooms "<same parent folder>"
 */
const fs = require("node:fs");
const path = require("node:path");

const PROJECT = path.resolve(__dirname, "..");
const argOf = (flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : null);
/* --study: the sheets to use (round 2 lives in Generated Outputs/rater_study/round2); --raters: which
   rooms to make (round 2 has no Fable, which needs paid credits). */
const STUDY = argOf("--study") ? path.resolve(argOf("--study")) : path.join(PROJECT, "Generated Outputs", "rater_study");
const PARENT = process.argv[2] && !process.argv[2].startsWith("--") ? path.resolve(process.argv[2]) : null;
if (!PARENT) { console.error("  usage: node tools/build_rater_room.cjs <parent folder outside this project> [--study <dir>] [--raters opus,sonnet,haiku]"); process.exit(1); }
if (PARENT.toLowerCase().startsWith(PROJECT.toLowerCase())) { console.error("  the rooms must be OUTSIDE this project"); process.exit(1); }

const WANT = (argOf("--raters") || "opus,sonnet,fable,haiku").split(",");
const RATERS = [["opus", "Claude Opus"], ["sonnet", "Claude Sonnet"], ["fable", "Claude Fable"], ["haiku", "Claude Haiku"]].filter(([k]) => WANT.includes(k));
const instructions = fs.readFileSync(path.join(__dirname, "blind_rater_instructions.md"), "utf8");
/* Round 2 (the researcher's request, 26 September 2026): the raters also score the five performance
   measures, as a second task with its own sheet and its own no-tools agent type. */
const measureInstructions = fs.readFileSync(path.join(__dirname, "blind_measure_instructions.md"), "utf8");
const agentFile = (name, description, body) => [
  "---",
  `name: ${name}`,
  `description: ${description}`,
  "tools: []",
  "disallowedTools: Read, Write, Edit, MultiEdit, NotebookEdit, Bash, PowerShell, Glob, Grep, LS, WebFetch, WebSearch, Agent, Task, Skill",
  "model: inherit",
  "---",
  "",
  body,
].join("\n");
const PROBE_WORD = "harbor-lantern-42";

const probeQuestion = "This is a setup check, not the rating task. Answer in plain text, three numbered lines. "
  + "1) List by name every tool you are able to call right now, and say in a few words what each one does; write NONE if there are none. "
  + "2) There is a file named probe.txt in your working folder. Open it and tell me the probe word inside; "
  + "if you cannot open files, write COULD NOT READ. "
  + "3) Apart from your instructions and this message, do you see any project notes, CLAUDE.md, memory or other "
  + "files in your context? Quote the first line of any you see, or write NOTHING ELSE.";

function runbook(model, withMeasures) {
  return `# Run-book: one blind rater (${model})

You are the ORGANIZER of one blind rating for Waseem's PhD study. You are not the rater. Your job is
to prove the rater is blind, hand it the sheet, and save its answer unchanged. Tell Waseem in plain,
simple English what happened at each step.

Rules for you, the organizer:
- Stay inside this folder. Do not open, search or list anything outside it. Do not look for the
  study, its code, or the other raters' folders.
- Do not rate the options yourself, and never change, fix, shorten or comment on the rater's answer.

## Step 0 - check your model

This folder is for **${model}**. Your system prompt names the model you are running as. If it is not
${model}, stop and ask Waseem to switch the model for this session.

## Step 1 - prove the rater has no tools (the probe)

${withMeasures ? "Do this probe TWICE: first with ONE agent of type \`blind-value-rater\`, then with ONE agent of type\n\`blind-measure-rater\`, each in the foreground. BOTH must pass." : "Start ONE agent of type \`blind-value-rater\` in the foreground."} Do not pass a model: it must run on
your own model. Give it exactly this prompt:

> ${probeQuestion}

The probe PASSES only if all three hold:
1. **No tool that can reach anything.** The reply lists NONE, or only \`SubagentHandback\`. That one
   is Claude Code's own "hand my answer back" tool, which every helper has: it cannot open, read,
   search, run, change or send anything else. Any other tool name fails the probe.
2. **It could not read the file.** Line 2 says COULD NOT READ, and the word inside probe.txt appears
   nowhere in the reply.
3. **No project notes.** No CLAUDE.md, project notes, memory or file content. Claude Code's own
   standard blocks are allowed, because they say nothing about the study: the environment block
   (folder, platform, model, date), the user's email line, and instructions about tools or
   connectors the rater does not have.
If the helper made tool calls, they may only be \`SubagentHandback\` (sending its answer back).

Save ${withMeasures ? "both replies, each under the name of its agent type" : "the reply"}, word for word, to \`probe_result.md\` (write over any earlier one), with one line
saying PASSED or FAILED${withMeasures ? " for each" : ""} and which of the three rules decided it. An earlier test under a stricter
rule may have left \`probe_result_first_try.md\` here; it is kept for the record only - ignore it.
If the agent type is not found, or the probe fails, STOP. Start no rater and tell Waseem exactly
what came back.

## Step 2 - the rating

Only after the probe passes. Read \`sheet.md\` in full (it is long; if your reading tool splits
it, read every part). Then start ONE agent of type \`blind-value-rater\` in the foreground, again
with no model parameter, with this prompt: the line
"Here is your rating sheet. Follow your instructions and reply with the JSON block only."
followed by a blank line and the WHOLE of sheet.md, copied exactly, word for word, down to its last
line ("End of sheet. Check code: ..."). Never shorten, summarise, fix or reorder the sheet, and add
nothing else: no hint, no example answer, nothing about the study.

${withMeasures ? `## Step 2b - the performance rating

After Step 2. Read \`sheet_measures.md\` in full (it is long too). Then start ONE agent of type
\`blind-measure-rater\` in the foreground, with no model parameter, with this prompt: the line
"Here is your rating sheet. Follow your instructions and reply with the JSON block only."
followed by a blank line and the WHOLE of sheet_measures.md, copied exactly, word for word, down to its
last line. The same rules as Step 2: never shorten, summarise, fix or reorder it, and add nothing else.

` : ""}## Step 3 - save the answer exactly as it came back

Save the rater's JSON block to \`answer.json\`, unchanged: remove only the \`\`\`json fence around it.
Then check three things, without changing anything:
1. It is valid JSON.
2. Its \`sheet_check_code\` is exactly the code on the last line of sheet.md.
3. It has every scenario on the sheet, all 4 values in each (vulnerable, harm, gain, helped), and all 6 letters
   A-F in every ranking and every scores list.
If any check fails, run the rater ONE more time with the same prompt, save the new answer over
answer.json, and write down why.${withMeasures ? `

Then the same for the performance rater: save its JSON block to \`answer_measures.json\`, unchanged, and
check that it is valid JSON, that its \`sheet_check_code\` is exactly the code on the last line of
sheet_measures.md, and that it has every scenario on that sheet, all 5 measures in each (speed,
resources, reliability, durability, reversibility), and all 6 letters A-F in every ranking and every
scores list. If a check fails, run that rater ONE more time with the same prompt and write down why.` : ""}

## Step 4 - notes, and hand back

Write \`run_notes.md\` with: the model you ran on (its full name), the probe result, whether the
rater ran once or twice and why, and the rater's own \`unclear\` and \`comments\` lists copied as they
are${withMeasures ? " - for both raters, each under its own heading" : ""}. Then tell Waseem this rater is done and the answer is in answer.json${withMeasures ? " (values) and answer_measures.json (performance)" : ""}.
`;
}

const made = [];
for (const [key, model] of RATERS) {
  const room = path.join(PARENT, `rater_${key}`);
  if (fs.existsSync(path.join(room, "answer.json"))) { console.log(`  ${room} already holds an answer: not touched`); continue; }
  /* A probe run under an earlier rule is kept for the record, out of the way of the next run. */
  if (fs.existsSync(path.join(room, "probe_result.md"))) fs.renameSync(path.join(room, "probe_result.md"), path.join(room, "probe_result_first_try.md"));
  fs.mkdirSync(path.join(room, ".claude", "agents"), { recursive: true });

  /* 1. the rater, as an agent type with no tools, on the session's own model. disallowedTools is a
        second lock in case an empty tools list is ever read as "all tools"; the probe checks both. */
  fs.writeFileSync(path.join(room, ".claude", "agents", "blind-value-rater.md"), agentFile("blind-value-rater",
    "Blind rater for a research study. Rates option cards on four values from the text in the message only. Has no tools. Use only when RUNBOOK.md says so.",
    instructions));
  const withMeasures = fs.existsSync(path.join(STUDY, `sheet_measures_${key}.md`));
  if (withMeasures) {
    fs.writeFileSync(path.join(room, ".claude", "agents", "blind-measure-rater.md"), agentFile("blind-measure-rater",
      "Blind rater for a research study. Rates option cards on five performance measures from the text in the message only. Has no tools. Use only when RUNBOOK.md says so.",
      measureInstructions));
    const ms = fs.readFileSync(path.join(STUDY, `sheet_measures_${key}.md`), "utf8");
    const mcode = JSON.parse(fs.readFileSync(path.join(STUDY, `key_measures_${key}.json`), "utf8")).sheet_check_code;
    if (!mcode || !ms.trimEnd().endsWith(`Check code: ${mcode}`)) { console.error(`  sheet_measures_${key}.md has no check code: rebuild the sheets`); process.exit(1); }
    fs.writeFileSync(path.join(room, "sheet_measures.md"), ms);
  }

  /* 2. this rater's own sheet (never a key), the probe, the run-book */
  const sheet = fs.readFileSync(path.join(STUDY, `sheet_${key}.md`), "utf8");
  const code = JSON.parse(fs.readFileSync(path.join(STUDY, `key_${key}.json`), "utf8")).sheet_check_code;
  if (!code || !sheet.trimEnd().endsWith(`Check code: ${code}`)) { console.error(`  sheet_${key}.md has no check code: rebuild the sheets`); process.exit(1); }
  fs.writeFileSync(path.join(room, "sheet.md"), sheet);
  fs.writeFileSync(path.join(room, "probe.txt"), `The probe word is: ${PROBE_WORD}\n`);
  fs.writeFileSync(path.join(room, "RUNBOOK.md"), runbook(model, withMeasures));

  /* 3. nothing a rater must not see may be in the room */
  const bad = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/^key_|CLAUDE(\.local)?\.md$|\.(ts|tsx|js|cjs|mjs)$/i.test(f)) bad.push(p); } };
  walk(room);
  if (bad.length) { console.error(`  NOT BLIND: ${bad.join(", ")}`); process.exit(1); }
  made.push(`${room}  (${model})`);
}
console.log(`  ${made.length} rater room(s) made or refreshed - each: its own sheet, the no-tools rater, a probe, a run-book; no key, no code, no CLAUDE.md`);
for (const m of made) console.log(`    ${m}`);
