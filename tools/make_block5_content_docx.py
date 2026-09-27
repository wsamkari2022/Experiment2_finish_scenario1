"""make_block5_content_docx.py — docs/Block5_All_Options_and_Reflections.docx from the Block 5 export.

WHY. The Word file is how Block 5 is read on paper and edited, and it was first built on 23 September 2026 by a
script that was never saved. After the option numbers and several card words changed (26 September 2026), it was
out of date. This rebuilds it with the same layout (a colored section per scenario; tables A card, B the two
reflection views, C the two people who may speak) and adds, at the researcher's request (27 September 2026), each
option's performance: the five numbers, the place of each among the scenario's options, the overall place and
0-100 score, and the chips the card shows. Every word and number comes from tools/export_block5_content.cjs,
which reads the study's own compiled modules, so the document cannot drift from what participants see.

Run:  node tools/export_block5_content.cjs block5_content.json
      python tools/make_block5_content_docx.py block5_content.json docs/Block5_All_Options_and_Reflections.docx
"""
import json
import sys
from datetime import date

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

SRC, OUT = sys.argv[1], sys.argv[2]
DATA = json.load(open(SRC, encoding="utf8"))

SCENARIO_COLORS = ["0F6F6C", "9A5B12", "3B4A9C", "2F6F3F", "7A3B6B", "3A5566"]
DARK, MUTED, BODY = "1A1D21", "6B7479", "40484E"
LABEL_FILL, ASK_FILL, LINE = "F1F4F6", "F8FAFB", "D9DDE0"
ROLE_WORDS = {"decider": "a decision", "recipient": "a wish", "predicted": "a test of the model"}
POSITION_WORDS = {"self": "self", "self_and_group": "self and group", "others": "others",
                  "under_authority": "under authority", "receiving_end": "receiving end",
                  "behind_the_veil": "behind the veil"}

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
sec.left_margin = sec.right_margin = Inches(0.75)
sec.top_margin = sec.bottom_margin = Inches(0.7)
normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
normal.font.size = Pt(10)


def rgb(hex_):
    return RGBColor.from_string(hex_)


def para(text="", size=10, bold=False, color=BODY, italic=False, after=4, before=0, style=None):
    p = doc.add_paragraph(style=style) if style else doc.add_paragraph()
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.space_before = Pt(before)
    if text:
        r = p.add_run(text)
        r.font.size, r.bold, r.italic = Pt(size), bold, italic
        r.font.color.rgb = rgb(color)
    return p


def note(text):
    """The small grey line between two tables that says how one leads to the next. It stays on the same page as the
    table it introduces."""
    p = para(text, size=8.5, color=MUTED, before=2, after=2)
    p.paragraph_format.keep_with_next = True
    return p


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def table_frame(table, border):
    tbl_pr = table._tbl.tblPr
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    tbl_pr.append(layout)
    b = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{edge}")
        e.set(qn("w:val"), "single")
        e.set(qn("w:sz"), "4")
        e.set(qn("w:space"), "0")
        e.set(qn("w:color"), border)
        b.append(e)
    tbl_pr.append(b)
    mar = OxmlElement("w:tblCellMar")
    for side, w in (("top", 100), ("bottom", 100), ("left", 180), ("right", 180)):
        e = OxmlElement(f"w:{side}")
        e.set(qn("w:w"), str(w))
        e.set(qn("w:type"), "dxa")
        mar.append(e)
    tbl_pr.append(mar)


def no_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    c = OxmlElement("w:cantSplit")
    c.set(qn("w:val"), "true")
    tr_pr.append(c)


def write(cell, text, size=9.5, bold=False, color=BODY, italic=False, keep=False):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.keep_with_next = keep
    r = p.add_run(text)
    r.font.size, r.bold, r.italic = Pt(size), bold, italic
    r.font.color.rgb = rgb(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    return p


def new_table(cols, widths, border=LINE):
    t = doc.add_table(rows=0, cols=cols)
    t.autofit = False
    table_frame(t, border)
    t._widths = widths
    return t


def add_row(t, keep=False):
    row = t.add_row()
    no_split(row)
    for i, w in enumerate(t._widths):
        row.cells[i].width = Inches(w)
    return row


def bar(text, fill, size, keep=True):
    """A one-cell colored bar with white bold text (the scenario and option headers)."""
    t = new_table(1, [7.0], border=fill)
    c = add_row(t).cells[0]
    write(c, text, size=size, bold=True, color="FFFFFF", keep=keep)
    shade(c, fill)
    return t


def pairs(rows, color, widths=(1.45, 5.55), size=9.5):
    """A two-column label | text table; the last row does not keep with the next paragraph."""
    t = new_table(2, list(widths))
    for i, (label, text) in enumerate(rows):
        r = add_row(t)
        write(r.cells[0], label, size=9, bold=True, color=color, keep=True)
        shade(r.cells[0], LABEL_FILL)
        write(r.cells[1], text, size=size, keep=i < len(rows) - 1)
    return t


def perf_rows(perf):
    """Three rows for table A: the five measures, the overall standing, and what the card prints."""
    measures = "  ·  ".join(f"{m['label']} {m['score']} ({m['place']})" for m in perf["measures"])
    overall = (f"Average {perf['overallMean']:g}  ·  {perf['overallPlace']} options  ·  {perf['captured']} on this "
               f"scenario's own 0–100 scale (0 = its weakest option, 100 = its strongest)")
    card = "  ·  ".join([f"Performance {perf['overallPlace']}"] + perf["chips"])
    return [("Performance (0–100)", measures), ("Overall performance", overall), ("On the card", card)]


# ------------------------------------------------------------------------------------------ the front page
today = date.today()
para("VRDS Experiment 2", size=10, bold=True, color=MUTED, after=0)
para("Block 5 — every scenario, every option, every reflection", size=20, bold=True, color=DARK, after=2)
para(f"The full text a participant reads, with every option's performance, laid out for reading and editing  ·  "
     f"updated {today.day} {today.strftime('%B %Y')}", size=10, color=MUTED, after=8)
bar("How to read this document", "3A5566", 11, keep=True)
para("Each scenario has its own color and its own section. Inside a section you will find, in this order:",
     size=10, before=6, after=3)
for text in [
    "The scenario — the scene, the situation right now, and the participant's role. These three are on screen above "
    "every option. Then what the four values and the five performance measures mean in that scenario.",
    "Then each option in turn, as three connected tables: A the option card as it appears on screen, with its four "
    "value numbers and its performance; B the two reflection views; and C the two people who may speak afterwards.",
]:
    p = para(style="List Bullet", after=2)
    r = p.add_run(text)
    r.font.size = Pt(9.5)
    r.font.color.rgb = rgb(BODY)
para("How the three tables connect: the participant reads the card (A) and chooses. If that choice sits poorly "
     "against the values they showed in Blocks 1–4, the study opens ONE of the two views in table B — never both. "
     "After they answer it, ONE of the two people in table C speaks: the one it hurt if they keep the choice, the one "
     "it would have helped if they change it.", size=9.5, before=4, after=4)
para("Performance: each option has five numbers from 0 to 100, and higher is better on all five (Resources spared is "
     "higher when less is used). The place beside each number (for example \"2nd of 6\") is its rank among the options "
     "of the same scenario. \"On the card\" is exactly what the option card shows under \"How it performs\".",
     size=9.5, after=4)
para("Scenario 5 is a wish rather than a decision, and scenario 6 is a test of the model rather than of the "
     "participant. Neither runs a reflection, so their options have tables A only, and scenario 6 shows no performance. "
     "The opening line of every story in table C has three versions — someone you have only just met, known about a "
     "year, or known twenty years — chosen by the participant's own score; the version printed here is the first.",
     size=9.5, color=MUTED, after=4)
para("What is new since the 23 September version: the option numbers and several card words were revised on "
     "26 September 2026 after a blind content review of every option, and each option's performance is shown.",
     size=9.5, color=MUTED, after=4)

# ------------------------------------------------------------------------------------------ the scenarios
for si, s in enumerate(DATA):
    color = SCENARIO_COLORS[si % len(SCENARIO_COLORS)]
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    bar(f"Scenario {s['number']}  ·  {s['title']}", color, 14)
    para(f"{len(s['options'])} options  ·  {ROLE_WORDS.get(s['decisionRole'], s['decisionRole'])}  ·  "
         f"whose cost it is: {POSITION_WORDS.get(s['stakePosition'], s['stakePosition'])}",
         size=9, color=MUTED, before=3, after=4)
    pairs([("The scene", s["scene"]), ("The situation right now", s["situation"]), ("Your role", s["role"])], color)

    if s.get("valueMeanings"):
        note("What the four values mean in this scenario (the panel \"Your values in this scenario\"):")
        pairs([(v["value"], v["meaning"]) for v in s["valueMeanings"]], color, size=9)
    if s.get("showsPerformance"):
        note("What the five performance measures mean in this scenario:")
        pairs([(m["label"], m["meaning"]) for m in s["measureMeanings"]], color, size=9)
    else:
        note("This scenario shows no performance numbers: its rules are standing principles, not actions.")

    note(f"↓  The participant sees all {len(s['options'])} option cards below, above the same boxes.")
    method_label = s.get("methodLabel") or "How it is done"
    for o in s["options"]:
        bar(f"Option {s['number']}.{o['number']}   {o['title']}", color, 10.5)
        rows = [("Summary", o["summary"])]
        if o.get("method"):
            rows.append((method_label, o["method"]))
        rows += [("You gain", o["gains"]), ("You give up", o["givesUp"]), ("Moral question", o["moralTension"])]
        rows.append(("The four values", "  ·  ".join(f"{k}: {v}" for k, v in o["values"].items())))
        if o.get("performance"):
            rows += perf_rows(o["performance"])
        pairs(rows, color)

        if not o["views"]:
            note("—  No reflection runs in this scenario, so this option has no views and no stakeholder.")
            continue

        note("↓  If this choice fits their values poorly, ONE of these two views opens — never both.")
        v1, v2 = o["views"]
        t = new_table(3, [1.15, 2.92, 2.92])
        head = add_row(t)
        write(head.cells[0], " ", size=8.5, bold=True, color=DARK, keep=True)
        shade(head.cells[0], LABEL_FILL)
        for ci, v in ((1, v1), (2, v2)):
            write(head.cells[ci], f"VIEW {ci} — {v['heading']}", size=8.5, bold=True, color="FFFFFF", keep=True)
            shade(head.cells[ci], color)
        lines = [("What the choice does", v1["body"], v2["body"])]
        for p1, p2 in zip(v1["points"], v2["points"]):
            lines.append((p1["label"], p1["text"], p2["text"]))
        if v1["closing"] or v2["closing"]:
            lines.append(("Then", v1["closing"], v2["closing"]))
        lines.append(("It then asks", v1["question"], v2["question"]))
        for li, (label, a, b) in enumerate(lines):
            r = add_row(t)
            last = li == len(lines) - 1
            write(r.cells[0], label, size=8.5, bold=True, color=color, keep=not last)
            shade(r.cells[0], LABEL_FILL)
            for ci, txt in ((1, a), (2, b)):
                write(r.cells[ci], txt, size=9, keep=not last)
                if last:
                    shade(r.cells[ci], ASK_FILL)

        note("↓  Whichever view they saw, one person speaks next — chosen by their answer to it.")
        t = new_table(2, [1.45, 5.55])
        for li, (lead, sub, text) in enumerate([("If they KEEP this choice", "the person it hurt", v1["hurt"]),
                                                  ("If they CHANGE their mind", "the person it would have helped", v1["need"])]):
            r = add_row(t)
            p = write(r.cells[0], lead, size=8.5, bold=True, color=color, keep=li == 0)
            sub_run = p.add_run("\n" + sub)
            sub_run.font.size, sub_run.italic = Pt(7.5), True
            sub_run.font.color.rgb = rgb(MUTED)
            shade(r.cells[0], LABEL_FILL)
            write(r.cells[1], text, size=9, keep=li == 0)

doc.core_properties.title = "Block 5 — every scenario, every option, every reflection"
doc.core_properties.author = "Waseem Samkari"
doc.save(OUT)
print("saved", OUT)
