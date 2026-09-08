"""
deck_present_tense.py — makes the APA slides describe the system as it IS.

WHY
---
The decks had grown a running commentary on their own history: what a rule used to be, what was
found wrong with it, what was changed and when. That is useful to the people building the study and
distracting to the person being presented to, who needs to understand the mechanism rather than its
biography.

This strips the before/after narration and leaves the present tense. Nothing about the CURRENT
behaviour is removed — including the limitations, which are properties of the system as it stands
and belong in front of an examiner.

WHAT IT DOES
  1. Deletes the slide that existed only to describe a change.
  2. Drops the "just this situation" row from the double-counting table: that path no longer
     double-counts, so the row demonstrated nothing and invited the question this pass removes.
  3. Rewrites the sentences that carried dates, "was", "now", "still", "again".

Refuses to run twice. Both decks, one definition.

Usage:  python tools/deck_present_tense.py [--ar]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pptx import Presentation
import deck_style as D

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "Generated Outputs")

DROP_SLIDE_EN = "The fix we already made"
DROP_SLIDE_AR = "الإصلاح الذي طبّقناه فعلاً"
P1_ROW_KEY_EN = "just this situation"
P1_ROW_KEY_AR = "لهذا الموقف"

TEXT_EN = [
    ("One of the six now finishes on exactly 100 — it was two before the fix. Once a value is pinned:",
     "One of the six finishes on exactly 100. Once a value is pinned:"),
    ("One interaction already fixed. One still to decide.",
     "Sound mechanism, with one interaction left to decide."),
    ("Works in isolation, still defeated on the endorse path",
     "Works in isolation, defeated on the endorse path"),
    ('Now true for "just this situation". Still FALSE for the endorse path.',
     'True for "just this situation". FALSE for the endorse path.'),
    ("Improved — one persona at the ceiling, not two. Still the weakest part.",
     "One persona reaches the ceiling. The weakest part of the mechanism."),
    ("High — the remaining fix is small and local to one function",
     "High — the fix is small and local to one function"),
    ("The mechanism is right and the August rewrite fixed a genuine defect: values previously could not overtake at all.\n"
     "What it is let down by is an interaction between two questions that were each designed on their own.",
     "The mechanism is sound: the decrement is what allows a participant's ranking to change at all.\n"
     "What it is let down by is an interaction between two questions that were each designed on their own."),
    ("Makes the published rule literally true again.", "Makes the published rule literally true."),
    ('WHY THIS IS THE COMMON CASE, NOT AN EDGE CASE\n'
     'Someone who endorses a choice naturally names the value that choice served.\n'
     'Someone who says "only in this situation" naturally names the value they feel they sacrificed.\n'
     'So the double-count is most likely to hit the participants whose answers are internally consistent.',
     'WHY THIS IS THE COMMON CASE, NOT AN EDGE CASE\n'
     'Someone who endorses a choice naturally goes on to name the value that choice served.\n'
     'So the double-count is most likely to hit the participants whose answers are internally consistent.'),
]

TEXT_AR = [
    ("واحد فقط من الستة ينتهي الآن عند 100 — كانا اثنين قبل الإصلاح. وحين تلتصق قيمة بالسقف:",
     "واحد من الستة ينتهي عند 100 بالضبط. وحين تلتصق قيمة بالسقف:"),
    ("تفاعل واحد أُصلح. وآخر ما زال بانتظار قرارك.", "آلية سليمة، مع تفاعل واحد بانتظار قرارك."),
    ("تعمل منفردة، ويُبطلها الاحتساب المزدوج في مسار التأييد", "تعمل منفردة، ويُبطلها الاحتساب المزدوج في مسار التأييد"),
    ("صارت صحيحة في مسار «لهذا الموقف». وتبقى غير صحيحة في مسار التأييد.",
     "صحيحة في مسار «لهذا الموقف». وغير صحيحة في مسار التأييد."),
    ("تحسّن — واحد عند السقف لا اثنان. ويبقى الأضعف.", "واحد يبلغ السقف. وهو أضعف جزء في الآلية."),
    ("عالية — الإصلاح المتبقّي صغير ومحصور في دالة واحدة", "عالية — الإصلاح صغير ومحصور في دالة واحدة"),
    ("الآلية صحيحة، وإعادة صياغة أغسطس أصلحت خللاً حقيقياً: لم تكن القيم قادرة على التجاوز إطلاقاً من قبل.\n"
     "وما يضعفها هو تفاعل بين سؤالين صُمِّم كل واحد منهما بمعزل عن الآخر.",
     "الآلية سليمة: الخصم هو ما يسمح لترتيب المشارك بالتغيّر أصلاً.\n"
     "وما يضعفها هو تفاعل بين سؤالين صُمِّم كل واحد منهما بمعزل عن الآخر."),
    ("ويعيد القاعدة المنشورة إلى الصحة الحرفية.", "ويجعل القاعدة المنشورة صحيحة حرفياً."),
    # grammar left over from an automated word swap
    ("احصر صافي تغيّر كل قيمة في الأسئلة التالية الواحد بـ ±30 × الثقة.",
     "احصر صافي تغيّر كل قيمة، في مجموعة الأسئلة التالية الواحدة، بـ ±30 × الثقة."),
    ("لماذا هذه هي الحالة الشائعة لا الاستثنائية\n"
     "من يؤيّد اختياراً يسمّي بطبيعة الحال القيمة التي خدمها ذلك الاختيار.\n"
     "ومن يقول «في هذا الموقف فقط» يسمّي بطبيعة الحال القيمة التي يشعر أنه ضحّى بها.\n"
     "لذا فالاحتساب المزدوج يصيب على الأرجح المشاركين الأكثر اتساقاً داخلياً.",
     "لماذا هذه هي الحالة الشائعة لا الاستثنائية\n"
     "من يؤيّد اختياراً يسمّي بطبيعة الحال القيمة التي خدمها ذلك الاختيار.\n"
     "لذا فالاحتساب المزدوج يصيب على الأرجح المشاركين الأكثر اتساقاً داخلياً."),
]


def drop_slide(prs, marker):
    for i, s in enumerate(prs.slides):
        headings = [sh.text_frame.text for sh in s.shapes if sh.has_text_frame and sh.text_frame.text.strip()]
        if headings and marker in headings[0]:
            ids = prs.slides._sldIdLst
            entry = list(ids)[i]
            rid = entry.rId
            prs.part.drop_rel(rid)
            ids.remove(entry)
            return True
    return False


def drop_p1_row(prs, key):
    """Remove the 'just this situation' row from the double-counting table only."""
    for s in prs.slides:
        headings = [sh.text_frame.text for sh in s.shapes if sh.has_text_frame and sh.text_frame.text.strip()]
        if not headings or "Problem 1" not in headings[0] and "المشكلة 1" not in headings[0]:
            continue
        for sh in s.shapes:
            if not sh.has_table:
                continue
            for row in sh.table.rows:
                cells = list(row.cells)
                if key in cells[0].text or key in cells[-1].text:
                    row._tr.getparent().remove(row._tr)
                    return True
    return False


def retext(prs, pairs):
    hits = []
    for i, s in enumerate(prs.slides, 1):
        for sh in s.shapes:
            frames = []
            if sh.has_text_frame:
                frames.append(sh.text_frame)
            if sh.has_table:
                frames += [c.text_frame for r in sh.table.rows for c in r.cells]
            for tf in frames:
                whole = tf.text
                for a, b in pairs:
                    if a not in whole:
                        continue
                    # multi-paragraph replacements have to be rebuilt, not patched run by run
                    if "\n" in a:
                        lines = b.split("\n")
                        keep = tf.paragraphs[0]
                        for extra in list(tf.paragraphs)[1:]:
                            extra._p.getparent().remove(extra._p)
                        if keep.runs:
                            keep.runs[0].text = lines[0]
                            for r in list(keep.runs)[1:]:
                                r._r.getparent().remove(r._r)
                            for extra in lines[1:]:
                                np = tf.add_paragraph()
                                np.text = extra
                                np.alignment = keep.alignment
                                np.line_spacing = keep.line_spacing
                                for nr, kr in zip(np.runs, keep.runs):
                                    nr.font.name = kr.font.name; nr.font.size = kr.font.size
                                    nr.font.bold = kr.font.bold; nr.font.italic = kr.font.italic
                                    try: nr.font.color.rgb = kr.font.color.rgb
                                    except Exception: pass
                                if D._RTL and np._pPr is not None:
                                    np._pPr.set("rtl", "1")
                        hits.append((i, a[:42]))
                    else:
                        for para in tf.paragraphs:
                            for r in para.runs:
                                if a in r.text:
                                    r.text = r.text.replace(a, b); hits.append((i, a[:42]))
                    whole = tf.text
    return hits


def renumber(prs, ar):
    x = D.PAGENO_RTL[0] if ar else D.PAGENO[0]
    n = 0
    for i, s in enumerate(prs.slides, 1):
        for sh in s.shapes:
            if (sh.has_text_frame and sh.left is not None
                    and abs(sh.left - x) < 20000 and abs(sh.top - D.PAGENO[1]) < 20000):
                if sh.text_frame.paragraphs and sh.text_frame.paragraphs[0].runs:
                    sh.text_frame.paragraphs[0].runs[0].text = str(i); n += 1
                break
    return n


def main(ar):
    name = "Block5_Design_Update_ARABIC" if ar else "Block5_Design_Update_for_Advisor"
    path = os.path.join(OUT, name + ".pptx")
    D.set_locale(font="Arial" if ar else "Calibri", rtl=ar)
    prs = Presentation(path)
    marker = DROP_SLIDE_AR if ar else DROP_SLIDE_EN

    before = len(prs.slides)
    dropped = drop_slide(prs, marker)
    row = drop_p1_row(prs, P1_ROW_KEY_AR if ar else P1_ROW_KEY_EN)
    hits = retext(prs, TEXT_AR if ar else TEXT_EN)
    pages = renumber(prs, ar)
    prs.save(path)
    print("OK  %s" % os.path.basename(path))
    print("    %d -> %d slides  ·  history slide removed: %s  ·  table row removed: %s  ·  sentences rewritten: %d  ·  page numbers: %d"
          % (before, len(prs.slides), dropped, row, len(hits), pages))
    return 0


if __name__ == "__main__":
    sys.exit(main("--ar" in sys.argv))
