"""
deck_style.py — the house style of the Block 5 advisor decks, in one place.

WHY THIS EXISTS
---------------
Every previous slide added to these decks was built by a throwaway script that carried its own copy
of the colours, margins and font sizes. Two of them drifted (a page-number counter that assumed
every slide used the same header helper, and a title bar 5,000 EMU narrower than the slide). This
module is the single definition, extracted by reading the shipped deck rather than by guessing.

Every constant below was measured from Block5_Design_Update_for_Advisor.pptx.
"""
from pptx.util import Emu, Pt
from pptx.oxml.ns import qn
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

# ---- geometry, in EMU, exactly as the deck uses them --------------------------------------------
SLIDE_W = 12191695
SLIDE_H = 6858000
MARGIN_L = 640080          # 0.70 in
CONTENT_W = 10927080       # 11.95 in
HEAD_H = 868680            # 0.95 in
SUB_Y = 1051560
SUB_W = 10972800
PAGENO = (11338560, 6419088, 548640, 274320)
PAGENO_RTL = (365760, 6419088, 548640, 274320)   # mirrored to the left edge in the Arabic deck

# ---- palette, by frequency in the shipped deck --------------------------------------------------
INK = RGBColor(0x1F, 0x29, 0x37)        # body text
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
TEAL = RGBColor(0x17, 0x60, 0x7B)       # title bar + table headers
PANEL = RGBColor(0xF1, 0xF3, 0xF5)      # neutral panel
MUTED = RGBColor(0x5B, 0x66, 0x73)      # subtitle
FAINT = RGBColor(0xD5, 0xD9, 0xDE)      # page number
BLUE = RGBColor(0xDA, 0xE3, 0xF3)       # light blue box
ORANGE = RGBColor(0xF4, 0xB1, 0x83)     # callout
GREEN = RGBColor(0xC5, 0xE0, 0xB4)      # "this works"
GREEN_INK = RGBColor(0x2E, 0x7D, 0x32)
RED_INK = RGBColor(0xC0, 0x00, 0x00)
LILAC = RGBColor(0xE4, 0xA8, 0xDE)
PALE_TEAL = RGBColor(0xCF, 0xE3, 0xEB)
AMBER_INK = RGBColor(0xD9, 0x77, 0x06)
FONT = "Calibri"

# ---- locale ------------------------------------------------------------------------------------
# The Arabic deck is the SAME deck mirrored: Arial, rtl="1" on every paragraph, right-aligned text,
# the page number moved to the left edge, and table columns in reverse order. Rather than keep a
# second copy of this module (which is how the English and Arabic decks drifted apart last time),
# the locale is a switch and every helper below honours it.
_FONT = FONT
_RTL = False


def set_locale(font="Calibri", rtl=False):
    """Switch the whole module between the English and Arabic decks. Call once, before building."""
    global _FONT, _RTL
    _FONT, _RTL = font, rtl


def _mirror(align):
    """LEFT and RIGHT swap meaning in a right-to-left deck; CENTER is unchanged."""
    if not _RTL:
        return align
    if align == PP_ALIGN.LEFT:
        return PP_ALIGN.RIGHT
    if align == PP_ALIGN.RIGHT:
        return PP_ALIGN.LEFT
    return align


def _fmt(tf, size, bold=False, italic=False, color=INK, align=PP_ALIGN.LEFT, line=105):
    """Apply the house run/paragraph formatting to every paragraph in a text frame."""
    for p in tf.paragraphs:
        p.alignment = _mirror(align)
        p.line_spacing = line / 100.0
        if _RTL:
            # python-pptx has no API for this; rtl lives on the paragraph properties element.
            p._pPr.set("rtl", "1") if p._pPr is not None else p._p.get_or_add_pPr().set("rtl", "1")
        for r in p.runs:
            r.font.name = _FONT
            r.font.size = Pt(size)
            r.font.bold = bold
            r.font.italic = italic
            r.font.color.rgb = color


def head(slide, title, subtitle, page_no):
    """
    Title bar + subtitle + page number.

    `page_no` is passed in rather than counted here: an earlier version kept its own counter and
    silently drifted as soon as one slide was built without this helper.
    """
    from pptx.enum.shapes import MSO_SHAPE
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W, HEAD_H)
    bar.fill.solid(); bar.fill.fore_color.rgb = TEAL
    bar.line.fill.background(); bar.shadow.inherit = False
    tf = bar.text_frame
    tf.text = title
    if _RTL:
        tf.margin_right = 502920; tf.margin_left = 274320
    else:
        tf.margin_left = 502920
    tf.margin_top = 91440
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    _fmt(tf, 26 if _RTL else 28, bold=True, color=WHITE, align=PP_ALIGN.LEFT)

    if subtitle:
        tb = slide.shapes.add_textbox(MARGIN_L, SUB_Y, SUB_W, 457200)
        tb.text_frame.word_wrap = True
        tb.text_frame.text = subtitle
        _fmt(tb.text_frame, 16 if _RTL else 17, italic=True, color=MUTED, line=115)

    x, y, w, h = PAGENO_RTL if _RTL else PAGENO
    pn = slide.shapes.add_textbox(x, y, w, h)
    pn.text_frame.text = str(page_no)
    _fmt(pn.text_frame, 11, color=FAINT, align=PP_ALIGN.RIGHT, line=115)


def box(slide, x, y, w, h, text, fill=PANEL, size=15, bold=False, color=INK,
        align=PP_ALIGN.CENTER, rounded=True, italic=False):
    """A filled callout. Text is centred and vertically middled, as everywhere else in the deck."""
    from pptx.enum.shapes import MSO_SHAPE
    shape = MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE
    sh = slide.shapes.add_shape(shape, x, y, w, h)
    sh.fill.solid(); sh.fill.fore_color.rgb = fill
    sh.line.fill.background(); sh.shadow.inherit = False
    tf = sh.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = 128016 if _RTL else 109728
    tf.margin_top = tf.margin_bottom = 54864
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    lines = text.split("\n")
    tf.text = lines[0]
    for extra in lines[1:]:
        tf.add_paragraph().text = extra
    _fmt(tf, size, bold=bold, italic=italic, color=color, align=align)
    return sh


def table(slide, x, y, w, rows, col_w, row_h=None, size=13, head_size=13):
    """
    A table in the deck's style: teal header, Calibri, dark body text.

    `rows[0]` is the header. `col_w` is a list of inch fractions of `w` that must sum to 1.0.
    """
    if _RTL:
        rows = [list(reversed(r)) for r in rows]
        col_w = list(reversed(col_w))
    n_r, n_c = len(rows), len(rows[0])
    row_h = row_h or [Emu(365760)] * n_r
    if isinstance(row_h, int):
        row_h = [row_h] * n_r
    total_h = sum(row_h)
    gf = slide.shapes.add_table(n_r, n_c, x, y, w, total_h)
    t = gf.table
    for i, frac in enumerate(col_w):
        t.columns[i].width = Emu(int(w * frac))
    for i, h in enumerate(row_h):
        t.rows[i].height = Emu(h)
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            cell = t.cell(ri, ci)
            cell.text = str(val)
            cell.margin_left = cell.margin_right = 100584
            cell.margin_top = cell.margin_bottom = 41148
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            if ri == 0:
                cell.fill.solid(); cell.fill.fore_color.rgb = TEAL
                _fmt(cell.text_frame, head_size, bold=True, color=WHITE,
                     align=PP_ALIGN.LEFT, line=110 if _RTL else 105)
            else:
                _fmt(cell.text_frame, size, color=INK,
                     align=PP_ALIGN.LEFT, line=110 if _RTL else 105)
    return t


def blank(prs):
    """A slide on the Blank layout — every content slide in these decks uses it."""
    layout = next(l for l in prs.slide_layouts if l.name == "Blank")
    return prs.slides.add_slide(layout)
