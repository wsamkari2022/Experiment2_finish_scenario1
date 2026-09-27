"""make_feedback_questions_docx.py — docs/VRDS_Experiment2_Feedback_Questions.docx, every feedback question for review.

WHY. The researcher asked (27 September 2026) for a file showing every existing feedback question, so it can be
reviewed, edited and added to. The questions are read straight from src/experiment/feedbackTypes.ts - the list the
feedback page renders - so the document shows exactly the words participants read, in the order they read them.
The section titles and intro sentences are the ones on the page (UserFeedbackPage.tsx). The script stops if the
number of questions in a list is not what it expects, so a changed list cannot slip through unnoticed.

Run:  python tools/make_feedback_questions_docx.py docs/VRDS_Experiment2_Feedback_Questions.docx
"""
import re
import sys
from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Inches, Cm

OUT = sys.argv[1]
SRC = (Path(__file__).resolve().parent.parent / "src" / "experiment" / "feedbackTypes.ts").read_text(encoding="utf8")


def block(name):
    """The text of one exported array in feedbackTypes.ts."""
    start = SRC.index(f"export const {name}")
    open_at = SRC.index("[", SRC.index("=", start))
    return SRC[open_at:SRC.index("];", open_at)]


Q = re.compile(r'\{\s*code:\s*"([^"]+)",\s*type:\s*"(likert|yesno|open)",\s*text:\s*"((?:[^"\\]|\\.)*)"'
               r'(?:,\s*likertLow:\s*"([^"]*)",\s*likertHigh:\s*"([^"]*)")?\s*\}')
W = re.compile(r'\{\s*code:\s*"([^"]+)",\s*subscale:\s*"(\w+)",\s*reverse:\s*(true|false),\s*text:\s*"((?:[^"\\]|\\.)*)"\s*\}')
O = re.compile(r'\{\s*code:\s*"(OE_\w+)",\s*text:\s*"((?:[^"\\]|\\.)*)"\s*\}')

def questions(name):
    return [dict(code=m[0], type=m[1], text=m[2], low=m[3], high=m[4]) for m in Q.findall(block(name))]

CVR, DUAL, APA = questions("CVR_QUESTIONS"), questions("DUAL_VIEW_QUESTIONS"), questions("APA_QUESTIONS")
TOOLS, CLOSERS = questions("TOOL_RATINGS"), questions("TOOL_CLOSERS")
WELL = [dict(code=m[0], subscale=m[1], reverse=m[2] == "true", text=m[3]) for m in W.findall(block("WELLBEING_ITEMS"))]
OPEN = [dict(code=m[0], text=m[1]) for m in O.findall(block("WELLBEING_OPEN_ENDED"))]
EXPECTED = {"CVR": (CVR, 8), "DUAL": (DUAL, 2), "APA": (APA, 8), "TOOLS": (TOOLS, 6), "CLOSERS": (CLOSERS, 3),
            "WELL": (WELL, 24), "OPEN": (OPEN, 5)}
for label, (items, n) in EXPECTED.items():
    if len(items) != n:
        sys.exit(f"feedbackTypes.ts changed: {label} has {len(items)} questions, this script expects {n} - check and update")

BLUE = RGBColor(0x1F, 0x38, 0x64)
TEXT = RGBColor(0x26, 0x26, 0x26)
GREY = RGBColor(0x59, 0x59, 0x59)
HEADER_FILL, GROUP_FILL, LINE = "DCE6F1", "F2F2F2", "BFBFBF"

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
sec.left_margin = sec.right_margin = Inches(0.8)
sec.top_margin = sec.bottom_margin = Inches(0.8)
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


def cell_text(cell, text, bold=False, size=10, color=TEXT, italic=False):
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


def table(headers, rows, widths, code_column=False):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    borders(t)
    for i, h in enumerate(headers):
        cell_text(t.rows[0].cells[i], h, bold=True, color=BLUE)
        shade(t.rows[0].cells[i], HEADER_FILL)
    row_flags(t.rows[0], header=True)
    for row in rows:
        r = t.add_row()
        row_flags(r)
        if isinstance(row, tuple) and row[0] == "GROUP":
            merged = r.cells[0].merge(r.cells[-1])
            cell_text(merged, row[1], bold=True, color=BLUE)
            shade(merged, GROUP_FILL)
            for par in merged.paragraphs:
                par.paragraph_format.keep_with_next = True
            continue
        for i, v in enumerate(row):
            if i == 0 and code_column:
                cell_text(r.cells[i], v.replace("_", "_​"), bold=True, size=8.5)  # wraps at "_" only
            else:
                cell_text(r.cells[i], v, bold=(i == 0), size=9.5 if i != 1 else 10)
    for i, w in enumerate(widths):
        t.columns[i].width = Inches(w)
    for r in t.rows:
        if len({id(c._tc) for c in r.cells}) == 1:
            continue
        for i, w in enumerate(widths):
            r.cells[i].width = Inches(w)
    return t


def answer(q):
    """Short on purpose: each section's intro already gives the scale's two ends."""
    if q["type"] == "likert":
        if not q["low"]:
            return "1–7 agreement"
        if q["low"].lower() == "not helpful":
            return "1–7 helpfulness"
        return f"1–7: {q['low'].lower()} → {q['high'].lower()}"
    return "Yes / No" if q["type"] == "yesno" else "Open text"


COLS = ["Code", "Question, as participants read it", "Answer", "Your comments or new wording"]
WIDTHS = [1.1, 3.1, 1.3, 1.4]

# --------------------------------------------------------------------------------------------- front
today = date.today()
para("VRDS Experiment 2", size=22, bold=True, color=BLUE, after=0)
para("The feedback questions participants answer at the end of the study", size=12.5, color=GREY, after=2)
para(f"Waseem Samkari  ·  {today.strftime('%B %Y')}", size=10, color=GREY, after=10)
para("These are the questions participants answer at the end of the study, in the order they see them. Please feel "
     "free to edit any wording, mark a question to remove, or add a comment in the last column. The last page is for "
     "new questions you would suggest.", after=8)

table(["Section", "Shown to", "Questions", "Answer types"], [
    ["1. The reflection step (CVR)", "Participants who met a reflection", f"{len(CVR)} (+{len(DUAL)} if they opened the second view)", "1–7 agreement, yes / no, one open question"],
    ["2. The clarification step (APA)", "Participants who used the clarification step", f"{len(APA)}", "1–7 agreement, yes / no, one open question"],
    ["3. The tools and the experiment design", "Everyone", f"{len(TOOLS) + len(CLOSERS)}", "1–7 helpfulness, yes / no, one open question"],
    ["4. How this experience was for you", "Everyone", f"{len(WELL)} statements + {len(OPEN)} optional open questions", "1–7 agreement; open text"],
], [2.1, 1.9, 1.5, 1.4])

# --------------------------------------------------------------------------------------------- 1 CVR
heading("1. The reflection step (CVR)")
para("What participants read first: “In some scenarios, after you chose an option that went against your usual values, "
     "you saw a short reflection: the same decision re-framed, plus the perspective of an affected person. These "
     "questions are about that step.”", size=9.5, color=GREY, italic=True, after=4).paragraph_format.keep_with_next = True
rows = [[q["code"], q["text"], answer(q), ""] for q in CVR]
rows.append(("GROUP", "Only for participants who opened the second view"))
rows += [[q["code"], q["text"], answer(q), ""] for q in DUAL]
table(COLS, rows, WIDTHS, code_column=True)

# --------------------------------------------------------------------------------------------- 2 APA
heading("2. The clarification step (APA)")
para("What participants read first: “In some scenarios you went through a short value-clarification step that asked "
     "which value you wanted the system to weight, then showed you the options that fit it. These questions are about "
     "that step.”", size=9.5, color=GREY, italic=True, after=4).paragraph_format.keep_with_next = True
table(COLS, [[q["code"], q["text"], answer(q), ""] for q in APA], WIDTHS, code_column=True)

# --------------------------------------------------------------------------------------------- 3 tools
heading("3. The tools and the experiment design")
para("What participants read first: “How helpful was each tool you saw while making your decisions? (1 = not helpful, "
     "7 = very helpful)”", size=9.5, color=GREY, italic=True, after=4).paragraph_format.keep_with_next = True
rows = [("GROUP", "How helpful was each tool?")]
rows += [[q["code"], q["text"], answer(q), ""] for q in TOOLS]
rows.append(("GROUP", "Closing questions"))
rows += [[q["code"], q["text"], answer(q), ""] for q in CLOSERS]
table(COLS, rows, WIDTHS, code_column=True)

# --------------------------------------------------------------------------------------------- 4 well-being
heading("4. How this experience was for you")
para("What participants read first: “Please rate how much you agree with each statement (1 = strongly disagree, 7 = "
     "strongly agree). Every statement is required.”", size=9.5, color=GREY, italic=True, after=4).paragraph_format.keep_with_next = True
SUBSCALE = {
    "learningInsight": "Learning insight", "decisionSatisfaction": "Decision satisfaction",
    "decisionRegret": "Decision regret", "valueCongruence": "Value congruence",
    "decisionConfidence": "Decision confidence", "cognitiveBurden": "Cognitive burden",
    "perceivedSupport": "Perceived support and autonomy", "overallWellbeing": "Overall well-being",
}
PART_A = ["learningInsight", "decisionSatisfaction", "decisionRegret", "valueCongruence", "decisionConfidence"]
para("(R) = scored in reverse (8 − answer), so a higher score always means better well-being. Each subscale is the mean "
     "of its statements; the well-being composite is the mean of seven subscales (all except learning insight).",
     size=9, color=GREY, after=4).paragraph_format.keep_with_next = True
rows = []
current = None
for item in WELL:
    part = "Part A — Learning & decisions" if item["subscale"] in PART_A else "Part B — Your experience & well-being"
    label = f"{part}:  {SUBSCALE[item['subscale']]}"
    if label != current:
        rows.append(("GROUP", label))
        current = label
    rows.append([item["code"] + (" (R)" if item["reverse"] else ""), item["text"], "1–7 agreement", ""])
rows.append(("GROUP", "Open questions (optional)"))
rows += [[o["code"], o["text"], "Open text", ""] for o in OPEN]
table(COLS, rows, WIDTHS, code_column=True)

# --------------------------------------------------------------------------------------------- new questions
doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
heading("5. Questions you would add")
para("I would welcome any new question you think the study should ask.", after=6)
t = table(["#", "New question", "Section", "Answer type", "Why it would help"],
          [[str(i), "", "", "", ""] for i in range(1, 9)], [0.35, 2.55, 1.1, 1.0, 1.9])
for r in t.rows[1:]:
    r.height = Cm(1.5)
para("Thank you for your time.", before=12, after=0)
para("Waseem", bold=True, after=0)

doc.core_properties.title = "VRDS Experiment 2 - Feedback questions"
doc.core_properties.author = "Waseem Samkari"
doc.save(OUT)
print("saved", OUT, "|", sum(len(v[0]) for v in EXPECTED.values()), "questions")
