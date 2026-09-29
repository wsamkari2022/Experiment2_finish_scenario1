"""make_accuracy_checklist_docx.py — docs/VRDS_Accuracy_Checklist.docx: what is accurate now, and what is still open.

WHY. The researcher asked (29 September 2026) for one file "for me and you" with checklists of what is now accurate
and need not be worried about - the working time per participant, the total time at the end, the major scores, the
Blocks 1-4 measurements and the rest - so both of us can see at a glance what stands and what does not.

A CHECKLIST THAT RE-CHECKS ITSELF. Every item names the check that stands over it, and this script RUNS those checks
before it writes the file: each row's tick is the result of the run that made the document, and the front page says
when that was and at which commit. A failed check turns its rows red. Nothing is ticked on memory alone: an item no
check covers says so in words ("read in the code") or is listed in the "worth your attention" section instead.

The version stamps on the front page are read from the source, so they cannot go stale either.

Run:  python tools/make_accuracy_checklist_docx.py docs/VRDS_Accuracy_Checklist.docx
      (about five minutes: it runs every check; add --no-run to build the file without running them)
"""
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Inches

# Print in UTF-8: the build line carries a check mark a Windows console cannot encode otherwise.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
OUT = sys.argv[1]
RUN = "--no-run" not in sys.argv
ROOT = Path(__file__).resolve().parent.parent

# ------------------------------------------------------------------------------------------------ the checks
CHECKS = {
    "typecheck": "npm run typecheck",
    "lint": "npm run lint",
    "block5": "node tools/validate_block5.cjs",
    "metrics": "npm run validate:metrics",
    "vci": "npm run validate:vci",
    "stability": "npm run validate:stability",
    "lenses": "npm run validate:lenses",
    "people": "npm run validate:people",
    "twins": "npm run validate:twins",
    "apa": "npm run verify:apa",
    "planner": "npm run test:planner",
    "profile": "npm run validate:profile",
    "calibration": "npm run calibration:check",
    "dbshape": "npm run validate:dbshape",
    "vciall": "npm run validate:vciall",
    "journey": "npm run validate:journey",
    "position": "npm run validate:position",
    "visits": "npm run validate:visits",
    "resume": "npm run validate:resume",
    "mcf": "npm run validate:mcf",
    "prediction": "npm run validate:prediction",
    "build": "npm run build",
    "envignored": "git check-ignore -q .env",
}
LABEL = {k: (v.replace("npm run ", "").replace("node tools/", "") if k != "envignored" else ".env is git-ignored")
         for k, v in CHECKS.items()}

results = {}
if RUN:
    for key, cmd in CHECKS.items():
        start = time.time()
        p = subprocess.run(cmd, shell=True, cwd=ROOT, capture_output=True, text=True, encoding="utf8", errors="replace")
        ok = p.returncode == 0
        out = (p.stdout or "").replace("\ufffd", "-")
        last = [l.strip() for l in out.splitlines() if "###" in l or "ALL " in l or "[PASS]" in l or "built in" in l]
        quiet = {"typecheck": "no type errors", "lint": "no lint errors", "envignored": "git ignores .env"}
        line = last[-1].strip("# ") if last else (quiet.get(key, "finished without errors") if ok else "failed")
        results[key] = {"ok": ok, "line": re.sub(r"\x1b\[[0-9;]*m", "", line), "sec": round(time.time() - start),
                        "out": p.stdout or ""}
        print(f"  {'pass' if ok else 'FAIL'}  {key:12} {results[key]['sec']:>4}s  {results[key]['line']}")
    # The development-only buttons must be absent from the participant build.
    dist = ROOT / "dist" / "assets"
    found = sum(f.read_text(encoding="utf8", errors="replace").count("Fill feedback") for f in dist.glob("*.js")) if dist.exists() else -1
    results["devbuttons"] = {"ok": results["build"]["ok"] and found == 0,
                             "line": f'"Fill feedback" appears {found} times in dist/', "sec": 0}
    print(f"  {'pass' if results['devbuttons']['ok'] else 'FAIL'}  devbuttons        {results['devbuttons']['line']}")
LABEL["devbuttons"] = "build: no dev buttons"

# Numbers quoted in the text are read from the run, never written from memory.
_m = re.search(r"\((\d+) sentences\)", results.get("mcf", {}).get("out", ""))
MCF_SENTENCES = f"All {int(_m.group(1)):,} sentences" if _m else "Every sentence"

commit = subprocess.run("git log -1 --format=%h", shell=True, cwd=ROOT, capture_output=True, text=True).stdout.strip()
branch = subprocess.run("git rev-parse --abbrev-ref HEAD", shell=True, cwd=ROOT, capture_output=True, text=True).stdout.strip()


def const(file, name):
    src = (ROOT / "src" / "experiment" / file).read_text(encoding="utf8")
    m = re.search(rf'export const {name}\s*=\s*"([^"]+)"', src) or re.search(rf"export const {name}\s*=\s*([0-9.]+)", src)
    return m.group(1) if m else "?"


VERSIONS = [
    ("SHAPE_VERSION", const("dbShape.ts", "SHAPE_VERSION"), "the shape of the database record"),
    ("calibrationVersion", const("sensitivityCalibration.ts", "SENSITIVITY_CALIBRATION_VERSION"), "how Blocks 1-4 answers become the seven value scores"),
    ("PLANNER_VERSION", const("block5Planner.ts", "PLANNER_VERSION"), "how the option cards are ordered"),
    ("PREDICTION_VERSION", const("block5Prediction.ts", "PREDICTION_VERSION"), "the MPF's prediction rule"),
    ("MCF_VERSION", const("block5MCF.ts", "MCF_VERSION"), "the Moral Commitment Function"),
    ("RUNNING_VERSION", const("block5VciAll.ts", "RUNNING_VERSION"), "the hidden running values behind VCI_all"),
    ("Working minutes required", const("dbShape.ts", "REQUIRED_ACTIVE_MINUTES"), "for the $5 gift card, beside finishing the feedback"),
]

# ------------------------------------------------------------------------------------------------ the content
# Each item: (what is accurate now, why it can be trusted, [check keys], extra words for the "checked by" column)
SECTIONS = [
    ("1. Working time, visits and the gift-card numbers", [
        ("Working time counts only real work.",
         "It grows only while the study tab is on screen AND the person moved, typed, clicked or scrolled in the last "
         "90 seconds. Example from the test: 15 minutes of work, then a 31-minute break, gives 16.4 minutes "
         "(15 plus the 90-second grace), not 46.", ["visits"], ""),
        ("Visits are counted correctly.",
         "A new visit starts after more than 30 minutes away, or on another computer. A reload after 45 minutes away "
         "counts once, not twice. Three computers in a row are three visits.", ["visits"], ""),
        ("Time belongs to the person, not the computer.",
         "A second person on the same computer starts at zero. The same email in different capital letters is one "
         "person. An old record left in the browser from six days before is not taken over.", ["visits"], ""),
        ("Time moves with the person and never goes backwards.",
         "On another computer the minutes already worked come along. When two browsers send different totals, the "
         "server keeps the larger one.", ["visits", "resume"], ""),
        ("Nothing is added after the study is finished.",
         "Once the feedback is submitted, the minutes and the visits stop moving.", ["visits"], ""),
        ("Minutes before the email is typed are kept.",
         "The time on the consent page, before the email is known, is not lost.", ["visits"], ""),
        ("The total at the end is the real working time.",
         "The thank-you page shows the working minutes (rounded) and the number of visits when there was more than one, "
         "with no verdict about the gift card. The database headline says which ledger its total comes from.",
         ["visits", "dbshape"], "(D33)"),
        ("Two reading pages have no page time of their own.",
         "The insights page and the post-Block-4 profile page are left out of the per-page times on purpose (they "
         "measure reading speed), but their minutes are still inside the total.", ["dbshape"], "(D1-D6)"),
    ]),
    ("2. Saving the data and moving between computers", [
        ("Nothing is lost when the server is down.",
         "Every answer is saved in the browser first and sent afterwards, in order. A write the server refuses is set "
         "aside and logged instead of blocking everything behind it, and every section the browser sends is one the "
         "server accepts.", ["dbshape"], "(D44: every section accepted; the setting-aside is read in storage.ts)"),
        ("Continuing on another computer works.",
         "The server merges a participant's saved files instead of replacing them, so a tab left open on an old "
         "computer cannot wipe a newer run. The check replays the 23 September case that sent a finished participant "
         "back to Block 1.", ["resume"], ""),
        ("A finished study stays finished.",
         "After \"Study Completed\" the server refuses resume writes. Reloading the thank-you page shows the thank-you "
         "page, never the form again, so answers cannot be overwritten.", ["resume", "journey"], "(J8)"),
        ("New database fields reach records that were already saved.",
         "When the record's shape changes, SHAPE_VERSION changes, and each browser sends everything once more.",
         [], "read in the code (storage.ts)"),
        ("The database password stays private.",
         "The .env file is never committed, and the server hides the password in its logs and on /api/health.",
         ["envignored"], ""),
    ]),
    ("3. Blocks 1-4: the seven value scores", [
        ("Every value can reach 100.",
         "Each value is divided by its own ceiling, so none is capped below 100.", ["profile"], ""),
        ("Ties are decided fairly, and recorded.",
         "A tie is broken by a coin made from the participant's own answers (the same on every computer), and every "
         "tie is written down.", ["profile"], ""),
        ("A refusal is not a zero.",
         "For protecting the vulnerable and for group size, answering \"never\" to both sides is dropped instead of "
         "scoring 0. A value with nothing measured gets the neutral 50 and is flagged \"not measured\".",
         ["profile"], ""),
        ("Half a step gets half the credit.",
         "On group size, one click one step higher no longer makes \"reducing harm\" jump to 55 and become the #1 value.",
         ["profile"], ""),
        ("\"Never\" on directness and context is flagged.",
         "The score stays 0 (your choice, for clear analysis) and the value is marked \"not measured\".",
         ["profile"], ""),
        ("The donation signal is a share, not one click.",
         "Block 1 counts the share of refusals that were donations, so random pressing no longer earns the full signal.",
         ["profile"], ""),
        ("The scoring tables match their recipe.",
         "The tables that put every value on one ruler are rebuilt from 200,000 pretend participants by a saved recipe, "
         "and the check fails if a formula changes without its tables.", ["calibration"], ""),
        ("How Blocks 1-4 were answered is saved.",
         "Saying yes at the first step everywhere, answering very fast (median under 2 seconds), values not measured, "
         "and ties: all in analysis.blocks_1_to_4_checks, with a copy in major_info_and_scores.", ["dbshape"], "(D52)"),
        ("Block 4 is read correctly.",
         "\"Would you approve the policy?\" before any voice and after each, with confidence first and last, appears "
         "on the charts page in the words the participant saw.", ["journey"], "(J7)"),
    ]),
    ("4. Block 5: the scores", [
        ("The fit score.",
         "A share of what the participant asked for: 100 means the option meets every value they hold, 0 means it gives "
         "nothing. The raw shortfall is saved too, on one scale for everybody.", ["vci", "dbshape"], "(V16-V17, D54, D56)"),
        ("VCI (scenarios 1-4).",
         "Its weights are worked out, not chosen: choosing blindly gives exactly 50. Each choice is judged on the values "
         "the person brought into that scenario, never on values the choice itself moved.", ["vci"], ""),
        ("VCI_all (all six scenarios).",
         "Built on the hidden running values. Choosing blindly gives 50. Every saved running fit is rebuilt from the "
         "record and must agree with the saved one.", ["vciall", "dbshape"], "(D65)"),
        ("Stability.",
         "Counts how many pairs of values swapped places at the moments the person went against their best fit. It also "
         "says whether it measured anything at all (stability_was_measured).", ["stability", "dbshape"], "(D62)"),
        ("Performance.",
         "The share of what each scenario offered that the choices took. Only the four decisions count: the wish "
         "(scenario 5) and the veil (scenario 6) are left out.", ["twins", "dbshape"], "(D57)"),
        ("The position effect.",
         "A choice must move the fit number at least 3 times more than the menu alone does. It does: 5.4 times.",
         ["position"], ""),
        ("Every value move is recorded.",
         "Each move says what was asked for and what happened, including moves cut off at 0 or 100.",
         ["vci", "dbshape"], "(V18, D55)"),
        ("The keep rule and the clarification step (APA).",
         "Choosing your best fit moves nothing; a second-best choice is compared with the best fit. The APA page and "
         "its updates pass their own checks.", ["vci", "apa"], ""),
        ("Scenario 5 is only a wish.",
         "It is shown and scored on the values scenario 4 opened with, so wishing for the option you decided gives a gap "
         "of exactly 0, value by value and in performance.", ["twins"], ""),
        ("Scenario 6 tests the software, not the person.",
         "It never moves the values, and the prediction worked out again from the record equals what was on screen.",
         ["prediction", "dbshape"], "(D27, D32)"),
        ("The card order.",
         "Every order is saved with what made it, and the database rebuilds it from those saved inputs to prove it.",
         ["planner", "dbshape"], "(D53)"),
    ]),
    ("5. The major scores in the database", [
        ("major_info_and_scores is an exact copy.",
         "Each line is made by the same code as the section it comes from, and the check compares every line with its "
         "source on every build.", ["dbshape"], "(D49)"),
        ("The analysis sections check themselves.",
         "The MPF section recomputes scenario 6 and must match what was shown; VCI_all rebuilds every running fit; the "
         "card order is rebuilt from its inputs.", ["dbshape"], "(D27, D53, D65)"),
        ("Which feedback button was used is saved.",
         "analysis.results_page: the card, the bottom bar, or the bottom of the results or charts page, and whether the "
         "charts were opened first.", ["dbshape"], "(D66)"),
        ("One page shows every major score for every kind of pretend participant.",
         "docs/MAJOR_SCORES_DISTRIBUTION.md is written by npm run report:major-scores. Run it again after any change "
         "to an option number, a scoring rule, a step size, the planner or a scenario.", [], "a report, not a check"),
    ]),
    ("6. What participants see", [
        ("The MCF never gives a verdict or a number.",
         f"{MCF_SENTENCES} it can produce are generated and checked: no \"aligned\", \"best fit\" or \"should\", "
         "no digits, and every size word matches its gap.", ["mcf"], ""),
        ("Scenario 6 has no MCF and no \"Your values in this scenario\" panel.",
         "So the prediction test cannot become \"pick your value\".", ["mcf"], "(M11)"),
        ("The results page leads on to the feedback.",
         "\"Scenarios done · 1 step left\", the \"One last step\" card, the slim bottom bar, and Feedback marked \"next\" "
         "in the progress bar (which slides to it on a phone).", ["journey"], "(J9)"),
        ("The charts page matches the database.",
         "All six scenarios, VCI and VCI_all, the veil as its own gray bar, and the software's predictions: every "
         "number is the one the database stores.", ["journey"], "(J1-J10)"),
        ("The reflection views and stories pass their checks.",
         "The two ways of seeing a choice (CVR lenses) and the affected people's stories.", ["lenses", "people"], ""),
        ("The development buttons are not in the participant version.",
         "\"Restart from Block 1\" and \"Fill feedback\" exist only on your computer.", ["devbuttons"], ""),
        ("The code is clean.",
         "No type errors and no lint errors.", ["typecheck", "lint"], ""),
    ]),
    ("7. The scenarios and their option numbers", [
        ("Every option number the three blind raters questioned was reviewed.",
         "Fixes 6, 7, 7b and 7c; each changed number carries a comment quoting its card and the raters.",
         ["block5", "metrics"], ""),
        ("Each value has its own champion option.",
         "No option loses on every value, and the design checks hold: a performance measure does not repeat a value, "
         "two measures are not alike, and no two options share a number except the one stated pair.",
         ["block5", "metrics"], "(G1-G8)"),
        ("The chips on the cards follow the numbers.",
         "\"Fastest\", \"Least reliable\" and the rest are worked out from the numbers, and a tie shows the measure "
         "furthest from the average.", ["planner"], ""),
    ]),
    ("8. The deployment", [
        ("One folder is both the development copy and the server copy.",
         "Nothing has to be converted before a deployment. You deployed commit 044cf25 on 29 September 2026 and "
         "checked it on the remote server.", [], "your own check on the server"),
    ]),
]

OPEN = [
    ("Fix 1, the very last fix before launch",
     "The open option cards still print the fit number, one card sentence can reveal the #1 value, scenario 5's wish "
     "page compares the wish with \"what you said matters most\", and the intro page says \"Each option will show you "
     "how closely it matches them\". CLAUDE.md's \"no verdict or arithmetic is shown\" becomes true only after it. "
     "(Audit A1, A2, A6, A8.)", "Before launch, last"),
    ("The three blanks in the freeze note",
     "docs/PREREGISTRATION_FREEZE.md: the launch commit, the launch date, and the end of data collection.", "At launch"),
    ("The test records in the remote database",
     "The database holds test runs, and a record carries no stamp of the code version. Decide before launch whether "
     "to delete them or mark them. When analysing, always filter on status \"Study Completed\" and date records by "
     "completed_at.", "Before launch"),
    ("One full click-through on the remote server",
     "A fresh email, on a computer and on a phone, from consent to the thank-you page.", "Before launch"),
    ("The gift-card rule has no check of its own",
     "quality.compensation_eligible is simple code (completed, at least 35 working minutes, feedback not all the same "
     "answer, fewer than 3 blocks under 30 seconds), and only its rushed-block part is checked (D6). Look at "
     "quality on one real finished record.", "At the click-through"),
    ("Decisions still open (for you and your advisor)",
     "A3 (the card order read as a recommendation), A5 (your values drawn over the options), A9 (your value numbers on "
     "screen while choosing), B6 and E7 (difference scores against level scores), C2 and C8 (the thresholds' "
     "wording and the unused strictness), D3 (fast \"yes\" clicking gives a gain-first profile), E6 (an idea), "
     "G6 (one honest change of mind gets a random responder's Stability).", "Your choice"),
    ("Things to watch",
     "R4: three design checks sit close to their limits (G3 0.77 against 0.85, G4 -0.65 against 0.70, "
     "reversibility's average 50.4 against 50): test any new performance number against them. R5: what durability "
     "and reversibility mean in each scenario. R8: random responders get \"protecting the vulnerable\" as #1 about "
     "21 times in 100 (a fair share is 14), measured once on 24 September and never re-measured.", "Only if numbers change"),
]

LIMITS = [
    ("VCI_all contains VCI.", "Never correlate the two; use the difference (vci_all_minus_vci)."),
    ("The echo and the screen-against-yardstick gap.",
     "A wish for the decided option often scores higher on the running values (35 in 100), and 8 in 100 wishes for "
     "the best-looking card score below 100. You accepted both; they are stated."),
    ("Stability of 100 can mean \"never tested\".", "Use stability_was_measured, or report the groups apart."),
    ("Stability's level depends on the step sizes.", "Report Stability as group comparisons, never one person's level word."),
    ("The position headline cannot tell a real role-switcher from a random chooser.",
     "Report it as a description beside VCI, and lead with the scenario 4 / 5 pair."),
    ("Each role is one scenario.", "Role, subject and order are mixed together (HOW_TO_ANALYZE 4.4)."),
    ("Performance for one person is mostly luck of the options picked.", "Report performance for groups."),
    ("The first card is also the best-fit card for 50-62 in 100 steady people.", "Analyse position and fit together (HOW_TO_ANALYZE 4.7)."),
    ("The MPF's chances for scenarios 1-5 use the end-of-block VCI and Stability.", "This changes only how sharp they are, never which option leads."),
    ("Records made on different dates saw different screens.", "Never pool records across the dated changes in HOW_TO_ANALYZE 4.9."),
]

# ------------------------------------------------------------------------------------------------ the document
BLUE = RGBColor(0x1F, 0x38, 0x64)
TEXT = RGBColor(0x26, 0x26, 0x26)
GREY = RGBColor(0x59, 0x59, 0x59)
GREEN = RGBColor(0x1B, 0x7A, 0x3E)
RED = RGBColor(0xB9, 0x1C, 0x1C)
HEADER_FILL, GROUP_FILL, LINE, OK_FILL, BAD_FILL, OPEN_FILL = "DCE6F1", "F2F2F2", "BFBFBF", "E8F5EC", "FDE8E8", "FFF4E0"

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
sec.left_margin = sec.right_margin = Inches(0.75)
sec.top_margin = sec.bottom_margin = Inches(0.75)
normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
normal.font.size = Pt(10.5)
normal.font.color.rgb = TEXT


def para(text="", size=10.5, bold=False, color=TEXT, italic=False, after=4, before=0):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.space_before = Pt(before)
    if text:
        r = p.add_run(text)
        r.font.size, r.bold, r.italic = Pt(size), bold, italic
        r.font.color.rgb = color
    return p


def heading(text):
    h = para(text, size=14, bold=True, color=BLUE, before=14, after=4)
    h.paragraph_format.keep_with_next = True
    return h


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def borders(table):
    b = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{edge}")
        e.set(qn("w:val"), "single")
        e.set(qn("w:sz"), "4")
        e.set(qn("w:space"), "0")
        e.set(qn("w:color"), LINE)
        b.append(e)
    table._tbl.tblPr.append(b)


def cell_text(cell, text, bold=False, size=9.5, color=TEXT, italic=False):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(1)
    p.paragraph_format.space_before = Pt(1)
    r = p.add_run(text)
    r.font.size, r.bold, r.italic = Pt(size), bold, italic
    r.font.color.rgb = color
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def row_flags(row, header=False):
    tr_pr = row._tr.get_or_add_trPr()
    c = OxmlElement("w:cantSplit")
    c.set(qn("w:val"), "true")
    tr_pr.append(c)
    if header:
        h = OxmlElement("w:tblHeader")
        h.set(qn("w:val"), "true")
        tr_pr.append(h)


def new_table(headers, widths):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    borders(t)
    for i, h in enumerate(headers):
        cell_text(t.rows[0].cells[i], h, bold=True, color=BLUE, size=9.5)
        shade(t.rows[0].cells[i], HEADER_FILL)
    row_flags(t.rows[0], header=True)
    return t


def set_widths(t, widths):
    for i, w in enumerate(widths):
        t.columns[i].width = Inches(w)
    for r in t.rows:
        for i, w in enumerate(widths):
            r.cells[i].width = Inches(w)


def status_of(keys):
    """(symbol, color, fill) for a row: every named check passed, one failed, or none ran."""
    if not keys:
        return "•", GREY, None
    if not RUN:
        return "–", GREY, None
    if all(results.get(k, {}).get("ok") for k in keys):
        return "✔", GREEN, OK_FILL
    return "✘", RED, BAD_FILL


# front page
now = datetime.now()
para("VRDS Experiment 2", size=22, bold=True, color=BLUE, after=0)
para("What is accurate now, and what is still open", size=13, color=GREY, after=2)
para(f"For Waseem and Claude  ·  {now.strftime('%d %B %Y')}  ·  code at commit {commit} on {branch}", size=10, color=GREY, after=10)

if RUN:
    total = len(results)
    failed = [k for k, v in results.items() if not v["ok"]]
    p = para(size=11, after=6)
    r = p.add_run(f"All {total} checks passed" if not failed else f"{len(failed)} of {total} checks FAILED: {', '.join(LABEL[k] for k in failed)}")
    r.bold, r.font.size = True, Pt(12)
    r.font.color.rgb = GREEN if not failed else RED
    p.add_run(f"  (run {now.strftime('%d %B %Y at %H:%M')}, when this file was made).").font.color.rgb = GREY
else:
    para("The checks were NOT run for this copy (built with --no-run): the ticks are blank.", bold=True, color=RED)

para("How to read this file. Each row is one thing that works correctly now. \"Why you can trust it\" says it in plain "
     "words, with an example where one helps. \"Checked by\" names the check that stands over it; a green ✔ means that "
     "check passed in the run that made this file. A • means no automatic check covers it, and the column says how "
     "it was confirmed instead. Section 9 lists what is NOT settled yet, and section 10 the limits to state in the "
     "paper, which are not errors.", after=8)

t = new_table(["Version stamp", "Now", "What it marks"], [1.9, 2.6, 2.5])
for name, value, what in VERSIONS:
    r = t.add_row()
    row_flags(r)
    cell_text(r.cells[0], name, bold=True)
    cell_text(r.cells[1], value)
    cell_text(r.cells[2], what, color=GREY)
set_widths(t, [1.9, 2.6, 2.5])
para("Records made under two different versions of the same stamp must not be pooled.", size=9, color=GREY, italic=True, before=3)

# the checklists
W = [0.35, 1.95, 3.45, 1.25]
for title, items in SECTIONS:
    heading(title)
    t = new_table(["", "What is accurate now", "Why you can trust it", "Checked by"], W)
    for what, why, keys, extra in items:
        sym, col, fill = status_of(keys)
        r = t.add_row()
        row_flags(r)
        cell_text(r.cells[0], sym, bold=True, color=col, size=11)
        cell_text(r.cells[1], what, bold=True)
        cell_text(r.cells[2], why)
        by = ", ".join(LABEL[k] for k in keys)
        cell_text(r.cells[3], (by + (" " if by and extra else "") + extra) if (by or extra) else "", size=8.5, color=GREY)
        if fill:
            shade(r.cells[0], fill)
    set_widths(t, W)

heading("9. Still open: worth your attention")
para("These are NOT settled. Nothing here is broken in the running study; each is a decision, a task before launch, "
     "or a number to watch.", after=4)
t = new_table(["Item", "What it means", "When"], [1.8, 4.1, 1.1])
for item, what, when in OPEN:
    r = t.add_row()
    row_flags(r)
    cell_text(r.cells[0], item, bold=True)
    cell_text(r.cells[1], what)
    cell_text(r.cells[2], when, color=GREY)
    shade(r.cells[0], OPEN_FILL)
set_widths(t, [1.8, 4.1, 1.1])

heading("10. Limits to state in the paper (not errors)")
t = new_table(["Limit", "What to do"], [3.2, 3.8])
for lim, todo in LIMITS:
    r = t.add_row()
    row_flags(r)
    cell_text(r.cells[0], lim, bold=True)
    cell_text(r.cells[1], todo)
set_widths(t, [3.2, 3.8])

heading("11. The run that made this file")
if RUN:
    t = new_table(["Check", "Result", "Its last line", "Seconds"], [1.5, 0.8, 4.0, 0.7])
    for k, v in results.items():
        r = t.add_row()
        row_flags(r)
        cell_text(r.cells[0], LABEL[k], bold=True, size=9)
        cell_text(r.cells[1], "passed" if v["ok"] else "FAILED", color=GREEN if v["ok"] else RED, bold=True, size=9)
        cell_text(r.cells[2], v["line"], size=8.5, color=GREY)
        cell_text(r.cells[3], str(v["sec"]), size=8.5, color=GREY)
    set_widths(t, [1.5, 0.8, 4.0, 0.7])
para("To make this file again with fresh results (about five minutes):", before=8, after=2)
para("python tools/make_accuracy_checklist_docx.py docs/VRDS_Accuracy_Checklist.docx", size=9.5, color=BLUE, after=2)
para("Where to read more: CLAUDE.md (every rule and check), Generated Outputs/HOW_TO_READ_MY_DATABASE.md (every field), "
     "Generated Outputs/HOW_TO_ANALYZE_MY_DATA.md (what may be claimed, and the dated screen changes in 4.9), and "
     "docs/FRESH_EYE_AUDIT.md (every finding, its status and the Log).", size=9.5, color=GREY)

doc.save(OUT)
print(f"written {OUT}")
