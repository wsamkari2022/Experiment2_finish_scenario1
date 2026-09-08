"""
restructure_advisor_deck.py — reorders the advisor deck into one story, and adds three slides.

WHY THIS EXISTS
---------------
The deck was built by appending three times: the original talk, then the scenario replacement, then
the APA audit. Read end to end it contradicts itself — slide 16 showed the new five scenarios
eighteen slides before slide 34 announced that two had been replaced, and slide 12 promised the
profile moves "always by a fixed amount" thirty slides before the audit explained that it doesn't
quite. Nothing was wrong with the slides; the ORDER was wrong.

WHAT IT DOES
------------
1. Builds three new slides (see NEW_SLIDES below).
2. Reorders every slide into six parts plus an appendix.
3. Renumbers the page numbers to match the new positions.
4. Rebuilds the contents slide.
5. Replaces jargon with plainer words throughout.

Slides are MOVED, never rebuilt, so every existing table, colour and wording survives untouched.

Runs against the English deck by default, or the Arabic deck with --ar, from the same order
definition — the two decks have drifted apart before and this is what stops it happening again.

Usage:  python tools/restructure_advisor_deck.py [--ar]
"""
import sys, os, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pptx import Presentation
from pptx.enum.text import PP_ALIGN
import deck_style as D
from deck_style import (head, box, table, blank, MARGIN_L, CONTENT_W,
                        PANEL, BLUE, ORANGE, GREEN, TEAL, INK, WHITE, MUTED)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "..", "Generated Outputs")
IN = lambda v: int(v * 914400)
L, W = MARGIN_L, CONTENT_W

# ── THE ORDER ────────────────────────────────────────────────────────────────────────────────────
# Numbers are positions in the 54-slide deck as it stands. "N1".."N3" are the new slides.
# Every one of the 54 appears exactly once; the script asserts that before touching anything.
ORDER = [
    # Part 0 — Where we are
    1, "N1", 2,
    # Part 1 — The problem, and how the cards are ordered
    3, 4, 5, 6, 7, 8, 9,
    # Part 2 — What the participant sees, and what happens after a choice
    11, 10, 28, 29, 30, 31,
    # Part 3 — How one choice changes the numbers  (the CVR slides above lead straight into this)
    "N2", "N3", 12, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52,
    # Part 4 — The five scenarios
    34, 35, 16, 36, 37, 40, 41,
    # Part 5 — What we measure
    17, 18, 19, 20, 21, 22, 24, 25, 26, 27, 23, 38, 39,
    # Part 6 — What it costs, and what we are asking you
    42, 53, 32, 54, 33,
    # Appendix
    13, 14, 15,
]

# ── PLAINER WORDS ────────────────────────────────────────────────────────────────────────────────
# Applied to every run of text in the deck. Longest keys first so "the clarification" wins over
# "clarification". Case-sensitive on purpose: replacing "Stance" would break a measure's name.
PLAIN_EN = [
    ("the clarification", "the follow-up questions"),
    ("clarification", "follow-up questions"),
    ("the incumbent", "the value that was on top"),
    ("incumbent", "the value that was on top"),
    ("the modal participant", "the most common answer pattern"),
    ("the modal answer", "the most common answer"),
    ("modal case", "most common case"),
    ("stacking", "double-counting"),
    ("stack", "add together"),
    ("saturation", "getting stuck at 100"),
    ("vignette", "short story"),
    ("(LEAP-like)", ""),
]
PLAIN_AR = [
    ("التوضيح", "الأسئلة التالية"),
    ("التراكم", "الاحتساب المزدوج"),
    ("الإشباع", "الالتصاق بالسقف"),
]

# Repairs applied AFTER the swaps above. A blind word swap occasionally produces something that is
# plainer but not English ("the resulting getting stuck at 100 rate"); these fix the sentence rather
# than reverting the word.
REPAIR_EN = [
    ("the resulting getting stuck at 100 rate together",
     "how often values end up stuck at 100, together"),
]
REPAIR_AR = [
    # "التوضيح" is masculine singular; "الأسئلة التالية" is feminine plural, so the verb has to
    # agree. A word-for-word swap cannot know that, which is why this pass exists.
    ("كل رقم يمكن أن يطبّقه الأسئلة التالية", "كل رقم يمكن أن تطبّقه الأسئلة التالية"),
]

# The closing slide, rewritten: the APA decision is now the live question and belongs first.
QUESTIONS_EN = chr(10).join([
    "1.   The APA counts two of its answers twice, so a consistent participant moves +45 rather",
    "      than the +30 we publish. Do we cap it at " + chr(177) + "30, or leave it and report it?   (Part 3)",
    "",
    "2.   Position Effect is now built. Should it also appear on the summary page,",
    "      or stay on the charts page only?",
    "",
    "3.   In scenarios 1 and 2, three options land within 4 points on performance.",
    "      Is that a useful control, or should the spread be widened?",
])
QUESTIONS_AR = chr(10).join([
    "1.   آلية APA تحتسب إجابتين مرتين، فيتحرّك المشارك المتّسق بـ+45 لا بـ+30 المنشورة.",
    "      هل نضع سقفاً عند " + chr(177) + "30، أم نتركها ونُبلِغ عنها؟   (الجزء 3)",
    "",
    "2.   أثر الموقع مُنفّذ الآن. هل يظهر في صفحة الملخص أيضاً،",
    "      أم يبقى في صفحة الرسوم وحدها؟",
    "",
    "3.   في السيناريوين 1 و 2، ثلاثة خيارات تقع داخل 4 نقاط في الأداء.",
    "      هل هذا ضبط مفيد، أم نوسّع الفارق؟",
])


def build_new(prs, ar):
    """The three added slides, returned in N1, N2, N3 order. Page numbers are fixed up later."""
    made = []

    # ── N1 · what changed since we last met ──────────────────────────────────────────────────
    s = blank(prs); made.append(s)
    if ar:
        head(s, "ما الذي تغيّر منذ لقائنا الأخير", "خمسة أشياء. التفاصيل في الأجزاء التالية.", 0)
        table(s, L, IN(1.85), W, [
            ["ما الذي تغيّر", "أين تجده"],
            ["سيناريوهان اسْتُبدلا — صار عندنا زوج مكان العمل (4 و5)", "الجزء 4"],
            ["أربعة مقاييس جديدة — الموقف، وثلاثة مقاييس المرآة", "الجزء 5"],
            ["دقّقنا آلية APA: القاعدة صحيحة، لكن سؤالين قد يُحتسبان مرتين", "الجزء 3"],
            ["صفحة تمهيدية قبل كل سيناريو، ليصل الدور قبل الخيارات", "الجزء 6"],
            ["كل ما عدا ذلك واجهة فقط — لم يُمسّ أي مقياس", "الجزء 6"],
        ], [0.68, 0.32], row_h=[IN(0.46)] + [IN(0.62)] * 5, size=14)
        box(s, L, IN(5.55), W, IN(0.85),
            "لم نغيّر شيئاً في الحسابات بعد التدقيق. الإصلاحان المقترحان معروضان في الجزء 3، والقرار قرارك.",
            fill=BLUE, size=14)
    else:
        head(s, "What changed since we last met", "Five things. The detail is in the parts that follow.", 0)
        table(s, L, IN(1.85), W, [
            ["What changed", "Where it is"],
            ["Two scenarios replaced — we now have the workplace pair (4 and 5)", "Part 4"],
            ["Four new measures — Stance, and three mirror measures", "Part 5"],
            ["We audited the APA: the rule is right, but two questions can count twice", "Part 3"],
            ["A new page before every scenario, so the role lands before the options", "Part 6"],
            ["Everything else is interface only — no measure was touched", "Part 6"],
        ], [0.68, 0.32], row_h=[IN(0.46)] + [IN(0.62)] * 5, size=14)
        box(s, L, IN(5.55), W, IN(0.85),
            "We changed nothing in the maths after the audit. The two proposed fixes are shown in Part 3, and the decision is yours.",
            fill=BLUE, size=14)

    # ── N2 · one participant, step by step ───────────────────────────────────────────────────
    s = blank(prs); made.append(s)
    if ar:
        head(s, "مشارك واحد، خطوة بخطوة", "أرقام حقيقية من الشيفرة نفسها. شغّل: npm run apa:walkthrough", 0)
    else:
        head(s, "One participant, step by step", "Real numbers, straight from the code. Run: npm run apa:walkthrough", 0)
    rows_en = [
        ["1 · Before", "how much is gained 79   ·   how many are helped 66   ·   reducing harm 60   ·   protecting the vulnerable 30"],
        ["2 · They choose", "\"Seal your flat and shelter until the plume passes\"   —   labelled STRONGLY MISALIGNED"],
        ["3 · Why that label", "It serves reducing harm. It gives up how much is gained — the value they hold highest."],
        ["4 · The reflection page opens", "The CONTEXT view: the same rule somewhere else. A community member speaks."],
        ["5 · They change their mind", "They do not keep the option."],
        ["6 · They tell us what they meant", "\"I chose it for this situation\"  ·  they name PROTECTING THE VULNERABLE  ·  sure: 5"],
        ["7 · After", "how much is gained 69   ·   how many are helped 66   ·   reducing harm 65   ·   protecting the vulnerable 60"],
    ]
    rows_ar = [
        ["1 · قبل", "مقدار المكسب 79   ·   عدد المستفيدين 66   ·   تقليل الضرر 60   ·   حماية الضعفاء 30"],
        ["2 · يختار", "«أغلق شقتك وابقَ حتى تمرّ السحابة»   —   التسمية: مخالف بشدة"],
        ["3 · لماذا هذه التسمية", "يخدم تقليل الضرر، ويتخلّى عن مقدار المكسب — وهي القيمة الأعلى لديه."],
        ["4 · تفتح صفحة التأمّل", "منظور السياق: القاعدة نفسها في مكان آخر. ويتحدّث أحد أفراد المجتمع."],
        ["5 · يغيّر رأيه", "لا يبقي على الخيار."],
        ["6 · يخبرنا بما قصده", "«اخترته لهذا الموقف»  ·  ويسمّي حماية الضعفاء  ·  درجة التأكد: 5"],
        ["7 · بعد", "مقدار المكسب 69   ·   عدد المستفيدين 66   ·   تقليل الضرر 65   ·   حماية الضعفاء 60"],
    ]
    table(s, L, IN(1.80), W, [["الخطوة", "ما يحدث"] if ar else ["Step", "What happens"]] + (rows_ar if ar else rows_en),
          [0.26, 0.74], row_h=[IN(0.40)] + [IN(0.60)] * 7, size=13)
    box(s, L, IN(6.35), W, IN(0.52),
        "حماية الضعفاء ارتفعت 30 نقطة. ومقدار المكسب نزل 10. لم يعودا في الترتيب نفسه."
        if ar else
        "Protecting the vulnerable went up 30 points. How much is gained came down 10. They are no longer in the same order.",
        fill=ORANGE, size=14, bold=True)

    # ── N3 · the payoff ──────────────────────────────────────────────────────────────────────
    s = blank(prs); made.append(s)
    if ar:
        head(s, "والسيناريو التالي لم يعد كما كان", "السيناريو 2 لم يتغيّر فيه شيء. ما تغيّر هو ما يعتقده النظام عن هذا المشارك.", 0)
    else:
        head(s, "And the next scenario is not the same", "Nothing about scenario 2 changed. What changed is what the system believes about this participant.", 0)
    opts_en = [
        ["Take your household's assigned place in the convoy", "Aligned", "Aligned", ""],
        ["Take the closed ridge road", "Misaligned", "Strongly misaligned", "CHANGED"],
        ["Give your car seats to the two frame users", "Strongly misaligned", "Strongly misaligned", ""],
        ["Fill every seat in the car with neighbours", "Misaligned", "Misaligned", ""],
        ["Take your household to the concrete school", "Strongly misaligned", "Misaligned", "CHANGED"],
        ["Leave immediately on the main highway", "Weakly aligned", "Weakly aligned", ""],
    ]
    opts_ar = [
        ["خذ مكان أسرتك المخصّص في القافلة", "متوافق", "متوافق", ""],
        ["اسلك طريق التلّ المغلق", "مخالف", "مخالف بشدة", "تغيّرت"],
        ["اترك مقاعد سيارتك لمستخدمَي الإطار", "مخالف بشدة", "مخالف بشدة", ""],
        ["املأ كل مقعد بالجيران", "مخالف", "مخالف", ""],
        ["خذ أسرتك إلى المدرسة الخرسانية", "مخالف بشدة", "مخالف", "تغيّرت"],
        ["غادر فوراً على الطريق السريع", "متوافق جزئياً", "متوافق جزئياً", ""],
    ]
    table(s, L, IN(1.90), W,
          [(["الخيار الستة في السيناريو 2", "قبل", "بعد", ""] if ar else
            ["The six options in scenario 2", "Label BEFORE", "Label AFTER", ""])] + (opts_ar if ar else opts_en),
          [0.44, 0.22, 0.22, 0.12], row_h=[IN(0.44)] + [IN(0.52)] * 6, size=13)
    box(s, L, IN(5.45), W, IN(1.15),
        "خياران من الستة يحملان الآن تسمية مختلفة، وترتيب البطاقات تغيّر أيضاً.\n"
        "هذا هو ما يفعله البلوك الخامس: اختيار واحد، وصفحة تأمّل، وسؤالان — فيتغيّر ما يُعرض على المشارك بعد ذلك."
        if ar else
        "Two of the six now carry a different label, and the card order changed as well.\n"
        "This is what Block 5 does: one choice, one reflection page, two questions — and what the participant is shown next is different.",
        fill=GREEN, size=15, bold=True)

    return made


def rebuild_contents(slide, ar):
    """Replace the old eight-topic contents with the six parts."""
    for sh in list(slide.shapes):
        sh._element.getparent().remove(sh._element)
    if ar:
        head(slide, "ماذا يغطّي هذا العرض", "ستة أجزاء وملحق. فكرة واحدة في كل شريحة.", 0)
        items = [("1", "المشكلة وترتيب البطاقات", "مثال الرحلة · شجرة القرار · كيف تُرتَّب الخيارات الستة"),
                 ("2", "ما يراه المشارك وما يحدث بعد اختياره", "المجموعات الثلاث · صفحة التأمّل · المنظوران"),
                 ("3", "كيف يغيّر اختيار واحد الأرقام", "مشارك واحد خطوة بخطوة · قواعد APA · نتائج التدقيق"),
                 ("4", "السيناريوهات الخمسة", "ما استُبدل · الموقع · زوج مكان العمل"),
                 ("5", "ما الذي نقيسه", "أثر الموقع · الأداء · الموقف · المرآة"),
                 ("6", "الكلفة وما نطلبه منك", "ما خسرناه · ما حسّنّاه · أسئلة مفتوحة"),
                 ("م", "ملحق", "المخطط العكسي — فكرة لم ننفّذها")]
    else:
        head(slide, "What this deck covers", "Six parts and an appendix. One idea per slide.", 0)
        items = [("1", "The problem, and how the cards are ordered", "Your flight example · the decision tree · how six options get their order"),
                 ("2", "What the participant sees, and what happens next", "The three groups · the reflection page · both views"),
                 ("3", "How one choice changes the numbers", "One participant step by step · the APA rules · what our audit found"),
                 ("4", "The five scenarios", "What was replaced · your position · the workplace pair"),
                 ("5", "What we measure", "Position Effect · Performance · Stance · the mirror"),
                 ("6", "What it costs, and what we ask you", "What we gave up · what we improved · open questions"),
                 ("A", "Appendix", "The inverse planner — an idea we did not build")]
    y = IN(1.72); step = IN(0.72)
    for i, (num, title, sub) in enumerate(items):
        box(slide, (L + W - IN(0.58)) if ar else L + IN(0.05), y + i * step, IN(0.52), IN(0.52),
            num, fill=TEAL, size=15, bold=True, color=WHITE)
        tb = slide.shapes.add_textbox(L + IN(0.75) if not ar else L, y + i * step - IN(0.03),
                                      W - IN(1.45), IN(0.32))
        tb.text_frame.text = title
        D._fmt(tb.text_frame, 15, bold=True, color=INK, align=PP_ALIGN.LEFT)
        tb2 = slide.shapes.add_textbox(L + IN(0.75) if not ar else L, y + i * step + IN(0.28),
                                       W - IN(1.45), IN(0.30))
        tb2.text_frame.text = sub
        D._fmt(tb2.text_frame, 12, color=MUTED, align=PP_ALIGN.LEFT)


def plainer(prs, pairs):
    """Swap jargon for plainer words in every run of text. Returns what it changed."""
    changed = []
    def walk(tf, where):
        for para in tf.paragraphs:
            for r in para.runs:
                original = r.text
                for a, b in pairs:
                    if a in r.text:
                        r.text = r.text.replace(a, b)
                if r.text != original:
                    changed.append((where, original.strip()[:48], r.text.strip()[:48]))
    for i, s in enumerate(prs.slides, 1):
        for sh in s.shapes:
            if sh.has_text_frame:
                walk(sh.text_frame, i)
            if sh.has_table:
                for row in sh.table.rows:
                    for c in row.cells:
                        walk(c.text_frame, i)
    return changed


def repair(prs, pairs):
    """Exact-string fixes for sentences the plain-words pass left ungrammatical."""
    n = 0
    def walk(tf):
        nonlocal n
        for para in tf.paragraphs:
            for r in para.runs:
                for a, b in pairs:
                    if a in r.text:
                        r.text = r.text.replace(a, b); n += 1
    for s_ in prs.slides:
        for sh in s_.shapes:
            if sh.has_text_frame:
                walk(sh.text_frame)
            if sh.has_table:
                for row in sh.table.rows:
                    for c in row.cells:
                        walk(c.text_frame)
    return n


def refresh_closing(prs, ar):
    """Update the title date, and put the live APA decision at the top of the open questions."""
    for sh in prs.slides[0].shapes:                       # title slide byline
        if sh.has_text_frame and "2026" in sh.text_frame.text:
            for para in sh.text_frame.paragraphs:
                for r in para.runs:
                    r.text = r.text.replace("August 2026", "September 2026")
    # Found by its heading, not by position: the appendix now sits after it, and an earlier version
    # of this function looked at the last slide and silently updated nothing.
    marker = "أسئلة مفتوحة" if ar else "Open questions"
    for slide in prs.slides:
        heading = next((sh.text_frame.text for sh in slide.shapes
                        if sh.has_text_frame and sh.text_frame.text.strip()), "")
        if marker not in heading:
            continue
        for sh in slide.shapes:
            if sh.has_text_frame and sh.text_frame.text.strip().startswith(("1.", chr(1633))):
                tf = sh.text_frame
                tf.text = QUESTIONS_AR if ar else QUESTIONS_EN
                D._fmt(tf, 16, color=INK, align=PP_ALIGN.LEFT, line=120)
                return True
    return False


def renumber(prs, ar):
    """Set every page-number box to its slide's new position. Identified by its corner, not a counter."""
    x_expected = D.PAGENO_RTL[0] if ar else D.PAGENO[0]
    fixed = 0
    for i, s in enumerate(prs.slides, 1):
        for sh in s.shapes:
            if (sh.has_text_frame and sh.left is not None
                    and abs(sh.left - x_expected) < 20000 and abs(sh.top - D.PAGENO[1]) < 20000):
                tf = sh.text_frame
                if tf.paragraphs and tf.paragraphs[0].runs:
                    tf.paragraphs[0].runs[0].text = str(i)
                    fixed += 1
                break
    return fixed


def reorder(prs, order, new_slides):
    """Move slides into `order`. Slides are moved, never copied or rebuilt."""
    ids = prs.slides._sldIdLst
    entries = list(ids)                       # current order, 1-based positions
    new_ids = {id(s): e for s, e in zip(new_slides, entries[-len(new_slides):])}
    key = {"N%d" % (i + 1): new_ids[id(s)] for i, s in enumerate(new_slides)}
    target = []
    for item in order:
        target.append(key[item] if isinstance(item, str) else entries[item - 1])
    for e in list(ids):
        ids.remove(e)
    for e in target:
        ids.append(e)


def main(ar):
    name = "Block5_Design_Update_ARABIC" if ar else "Block5_Design_Update_for_Advisor"
    path = os.path.join(OUT, name + ".pptx")
    D.set_locale(font="Arial" if ar else "Calibri", rtl=ar)

    prs = Presentation(path)
    n = len(prs.slides)
    if n != 54:
        print("REFUSING: expected 54 slides, found %d. Has this already been restructured?" % n)
        return 1

    nums = [i for i in ORDER if isinstance(i, int)]
    assert sorted(nums) == list(range(1, 55)), "ORDER must use each of the 54 slides exactly once"

    new_slides = build_new(prs, ar)
    reorder(prs, ORDER, new_slides)
    # the contents slide is at position 3 after the reorder
    rebuild_contents(prs.slides[2], ar)
    swaps = plainer(prs, PLAIN_AR if ar else PLAIN_EN)
    repaired = repair(prs, REPAIR_AR if ar else REPAIR_EN)
    closed = refresh_closing(prs, ar)
    fixed = renumber(prs, ar)

    prs.save(path)
    print("OK  %s" % os.path.basename(path))
    print("    %d slides -> %d   ·   page numbers: %d   ·   wording swaps: %d   ·   repairs: %d   ·   closing slide: %s"
          % (n, len(prs.slides), fixed, len(swaps), repaired, "updated" if closed else "NOT FOUND"))
    for where, a, b in swaps[:12]:
        print("      slide %-3s %-50s -> %s" % (where, a, b))
    return 0


if __name__ == "__main__":
    sys.exit(main("--ar" in sys.argv))
