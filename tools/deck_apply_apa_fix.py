"""
deck_apply_apa_fix.py — brings the advisor decks in line with the 7 Sept 2026 APA change.

WHAT CHANGED IN THE STUDY
-------------------------
Q1's "just this situation" answer no longer adds +10 to the value the option sacrificed. The
direction was faithful — that answer literally says the sacrificed value matters more — but it was
self-defeating: Q2 subtracts 20 from whichever value is top and reads "top" AFTER Q1, so the +10
promoted the value straight into the path of its own decrement.

WHAT THIS SCRIPT DOES
---------------------
1. Corrects every slide that still states the old rule or a number derived from it.
2. Inserts one new slide after "Problems 2 and 3" showing the measurement and the decision.
3. Renumbers.

Refuses to run twice. Works on both decks from one definition (--ar for Arabic).

Usage:  python tools/deck_apply_apa_fix.py [--ar]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pptx import Presentation
from pptx.enum.text import PP_ALIGN
import deck_style as D
from deck_style import head, box, table, blank, MARGIN_L, CONTENT_W, PANEL, BLUE, ORANGE, GREEN

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "Generated Outputs")
IN = lambda v: int(v * 914400)
L, W = MARGIN_L, CONTENT_W

MARKER_EN = "The fix we already made"
MARKER_AR = "الإصلاح الذي طبّقناه فعلاً"
AFTER_EN = "Problems 2 and 3"
AFTER_AR = "المشكلتان 2 و3"

# ── exact corrections, applied run by run ────────────────────────────────────────────────────────
FIX_EN = [
    ("+5 served   ·   +10 sacrificed", "+5 served   ·   nothing else  (the +10 was removed)"),
    ("harm 60→100 (+40), gained −15", "harm 60→90 (+30), gained −15"),
    ("Two of the six personas finished on exactly 100.",
     "One of the six now finishes on exactly 100 — it was two before the fix."),
    ("7 / 10", "8 / 10"),
    ("Weak — two of six personas hit the ceiling",
     "Improved — one persona at the ceiling, not two. Still the weakest part."),
    ("Currently FALSE for the likely modal participant — most serious item",
     "Now true for \"just this situation\". Still FALSE for the endorse path."),
    ("Works in isolation, defeated by double-counting in combination",
     "Works in isolation, still defeated on the endorse path"),
    ("High — both fixes are small and local to one function",
     "High — the remaining fix is small and local to one function"),
    ("Sound mechanism, let down by an interaction between two questions designed separately.",
     "One interaction already fixed. One still to decide."),
]
FIX_AR = [
    ("+5 للمخدومة   ·   +10 للمُضحّى بها", "+5 للمخدومة   ·   ولا شيء غير ذلك (أُزيل الـ+10)"),
    ("تقليل الضرر 60←100 (+40)، المكسب −15", "تقليل الضرر 60←90 (+30)، المكسب −15"),
    ("اثنان من الستة انتهيا عند 100 بالضبط.", "واحد فقط من الستة ينتهي الآن عند 100 — كانا اثنين قبل الإصلاح."),
    ("7 / 10", "8 / 10"),
    ("ضعيف — اثنان من ستة بلغا السقف", "تحسّن — واحد عند السقف لا اثنان. ويبقى الأضعف."),
    ("غير صحيحة حالياً لدى النمط الأرجح — وهذا أخطر بند",
     "صارت صحيحة في مسار «لهذا الموقف». وتبقى غير صحيحة في مسار التأييد."),
    ("تعمل منفردة، ويُبطلها الاحتساب المزدوج عند الاجتماع", "تعمل منفردة، ويُبطلها الاحتساب المزدوج في مسار التأييد"),
    ("عالية — كلا الإصلاحين صغير ومحصور في دالة واحدة", "عالية — الإصلاح المتبقّي صغير ومحصور في دالة واحدة"),
    ("آلية سليمة، أضعفها تفاعل بين سؤالين صُمِّم كل منهما على حدة.", "تفاعل واحد أُصلح. وآخر ما زال بانتظار قرارك."),
]

# the +10 row on the Problem 1 table
ROWFIX_EN = [("+10 × w", "0  (was +10)"), ("+40 × w", "+30 × w  (fixed)")]
ROWFIX_AR = [("‏+10 × w", "0  (كان +10)"), ("‏+40 × w", "‏+30 × w  (أُصلح)")]


def correct(prs, pairs):
    n = 0
    def walk(tf):
        nonlocal n
        for para in tf.paragraphs:
            for r in para.runs:
                for a, b in pairs:
                    if a in r.text:
                        r.text = r.text.replace(a, b); n += 1
    for s in prs.slides:
        for sh in s.shapes:
            if sh.has_text_frame:
                walk(sh.text_frame)
            if sh.has_table:
                for row in sh.table.rows:
                    for c in row.cells:
                        walk(c.text_frame)
    return n


def fix_problem1_row(prs, ar):
    """Only the 'just this situation' ROW of the Problem 1 table — the endorse row must not change."""
    key = "just this situation" if not ar else "لهذا الموقف"
    pairs = ROWFIX_AR if ar else ROWFIX_EN
    done = 0
    for s in prs.slides:
        for sh in s.shapes:
            if not sh.has_table:
                continue
            for row in sh.table.rows:
                cells = list(row.cells)
                if key not in cells[0].text and key not in cells[-1].text:
                    continue
                for c in cells:
                    for para in c.text_frame.paragraphs:
                        for r in para.runs:
                            for a, b in pairs:
                                if a in r.text:
                                    r.text = r.text.replace(a, b); done += 1
    return done


def build_slide(prs, ar):
    s = blank(prs)
    if ar:
        head(s, MARKER_AR, "سؤالك عن الـ+10 كشف خللاً حقيقياً — لكن ليس في الاتجاه.", 0)
        box(s, L, IN(1.80), W, IN(0.92),
            "الاتجاه كان صحيحاً. الإجابة تقول على الشاشة: «إجمالاً، [القيمة المُضحّى بها] ما زالت تهمّني أكثر»\n"
            "فالمشارك يناقض اختياره ويعيد تأكيد تلك القيمة. رفعها كان أميناً لما قاله.",
            fill=BLUE, size=14)
        box(s, L, IN(2.88), W, IN(0.62),
            "لكنه كان يُبطل نفسه: السؤال الثاني يخصم 20 من القيمة الأعلى، ويقرأ «الأعلى» بعد السؤال الأول.",
            fill=ORANGE, size=15, bold=True)
        table(s, L, IN(3.66), W, [
            ["الزيادة على المُضحّى بها", "يوافق الملف ما قاله", "ملتصق عند 0/100", "الخصم يقع عليها"],
            ["+10  (السابق)", "71.9%", "14.3%", "25.7%"],
            ["+5", "78.5%", "13.2%", "24.2%"],
            ["0  (المعتمد الآن)", "79.5%", "12.0%", "22.0%"],
            ["−5  (جُرِّب ورُفض)", "75.8%", "10.6%", "20.2%"],
        ], [0.34, 0.24, 0.21, 0.21], row_h=[IN(0.42)] + [IN(0.40)] * 4, size=13)
        box(s, L, IN(5.72), W, IN(1.00),
            "‏2500 مشارك محاكى. الـ+10 كان يرفع القيمة إلى القمة في 87.6% من الحالات، فيقع الخصم عليها: +10 ثم −20 = خسارة 10.\n"
            "القرار: 0. السؤال الأول يسجّل ما فعلوه، والثاني يسجّل ما يريدونه.  ·  أثر جانبي: سقف Stability انتقل 56 ← 57.",
            fill=GREEN, size=13, bold=True)
    else:
        head(s, MARKER_EN, "Your question about the +10 found a real defect — but not in the direction.", 0)
        box(s, L, IN(1.80), W, IN(0.92),
            "THE DIRECTION WAS RIGHT. On screen the answer reads \"overall, [sacrificed] still matters more to me\" —\n"
            "the participant is contradicting their own choice and reasserting that value. Raising it was faithful.",
            fill=BLUE, size=14)
        box(s, L, IN(2.88), W, IN(0.62),
            "But it undid itself: Q2 subtracts 20 from whichever value is top, and it reads \"top\" AFTER Q1 has run.",
            fill=ORANGE, size=15, bold=True)
        table(s, L, IN(3.66), W, [
            ["Bump on the sacrificed value", "Profile ends up agreeing", "Pinned at 0/100", "The −20 lands on it"],
            ["+10  (what we had)", "71.9%", "14.3%", "25.7%"],
            ["+5", "78.5%", "13.2%", "24.2%"],
            ["0  (what we now use)", "79.5%", "12.0%", "22.0%"],
            ["−5  (tested, rejected)", "75.8%", "10.6%", "20.2%"],
        ], [0.34, 0.24, 0.21, 0.21], row_h=[IN(0.42)] + [IN(0.40)] * 4, size=13)
        box(s, L, IN(5.72), W, IN(1.00),
            "2,500 simulated participants. The +10 promoted the value to top 87.6% of the time, so the −20 hit it: +10 then −20 = a net loss of 10.\n"
            "Decision: 0. Q1 records what they DID, Q2 records what they WANT.  ·  Knock-on: the Stability ceiling moved 56 → 57.",
            fill=GREEN, size=13, bold=True)
    return s


def move_after(prs, slide, title_marker):
    """Move the freshly-appended slide to sit directly after the slide whose heading matches."""
    ids = prs.slides._sldIdLst
    entries = list(ids)
    target = None
    for i, s in enumerate(prs.slides):
        headings = [sh.text_frame.text for sh in s.shapes if sh.has_text_frame and sh.text_frame.text.strip()]
        if headings and title_marker in headings[0]:
            target = i
            break
    if target is None:
        return False
    mine = entries[-1]
    ids.remove(mine)
    ids.insert(target + 1, mine)
    return True


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
    marker = MARKER_AR if ar else MARKER_EN

    prs = Presentation(path)
    if any(marker in sh.text_frame.text for s in prs.slides for sh in s.shapes if sh.has_text_frame):
        print("REFUSING: %s already has the fix slide." % os.path.basename(path))
        return 1

    before = len(prs.slides)
    rows = fix_problem1_row(prs, ar)          # must run BEFORE the general pass
    fixed = correct(prs, FIX_AR if ar else FIX_EN)
    slide = build_slide(prs, ar)
    placed = move_after(prs, slide, AFTER_AR if ar else AFTER_EN)
    pages = renumber(prs, ar)

    prs.save(path)
    print("OK  %s" % os.path.basename(path))
    print("    %d -> %d slides  ·  corrections: %d  ·  problem-1 row: %d  ·  new slide placed: %s  ·  page numbers: %d"
          % (before, len(prs.slides), fixed, rows, placed, pages))
    return 0


if __name__ == "__main__":
    sys.exit(main("--ar" in sys.argv))
