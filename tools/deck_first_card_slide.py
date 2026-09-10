"""
deck_first_card_slide.py — adds "What the first card actually carries" to the planner section.

WHY THIS SLIDE EXISTS
---------------------
The planner orders the cards by a trade-off comparison, so the top card is not guaranteed to be the
best-fitting one. That reads as a fault the first time anyone sees it, and the natural next question
is "shouldn't the first card be the aligned one?".

The answer is a number, and it belongs on a slide rather than in a conversation: the top card IS
aligned about half the time, the best-fitting option is almost never buried, and the whole point of
the planner is a gate requiring the two orders to disagree.

Measured over 3,000 randomly generated profiles run through the shipped labelOptions and
plannerRank on all five scenarios. The separation figure is from `npm run validate:planner`.

Refuses to run twice. Both decks, one definition.

Usage:  python tools/deck_first_card_slide.py [--ar]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pptx import Presentation
import deck_style as D
from deck_style import head, box, table, blank, MARGIN_L, CONTENT_W, PANEL, BLUE, ORANGE, GREEN

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "Generated Outputs")
IN = lambda v: int(v * 914400)
L, W = MARGIN_L, CONTENT_W

MARK_EN = "What the first card actually carries"
MARK_AR = "ماذا تحمل البطاقة الأولى فعلياً"
AFTER_EN = "How the six cards get their order"
AFTER_AR = "كيف تحصل البطاقات الست على ترتيبها"


def build(prs, ar):
    s = blank(prs)
    if ar:
        head(s, MARK_AR, "الترتيب مقارنة مفاضلات، لا ترتيب مطابقة. وهذا ما يعنيه ذلك عملياً.", 0)
        table(s, L, IN(1.80), int(W * 0.46), [
            ["تسمية البطاقة الأولى", "النسبة"],
            ["متوافق", "51%"],
            ["متوافق جزئياً", "28%"],
            ["مخالف", "19%"],
            ["مخالف بشدة", "3%"],
        ], [0.62, 0.38], row_h=[IN(0.44)] + [IN(0.46)] * 4, size=14)
        box(s, L + int(W * 0.52), IN(1.80), int(W * 0.48), IN(2.30),
            "الخيار الأفضل مطابقةً لا يُدفن أبداً\n\n"
            "البطاقة 1 أو 2  —  84% من الحالات\n"
            "أول ثلاث بطاقات  —  95.5%\n"
            "البطاقات 4 إلى 6  —  أقل من 5%",
            fill=GREEN, size=15, bold=True)
        box(s, L, IN(4.35), W, IN(1.35),
            "بوابة الفصل:  يجب ألا تتطابق البطاقة الأولى للمخطِّط مع الأولى في التوافق أكثر من 50%. وهي الآن 49%.\n"
            "وهذا سبب وجود المخطِّط أصلاً: لو كانت البطاقة الأولى هي الأفضل مطابقةً في العادة، لأصبح «اختار البطاقة الأولى»\n"
            "و«اختار ما يناسب قيمه» حدثاً واحداً، ولتعذّر تفسير أيٍّ منهما بعد ذلك.",
            fill=PANEL, size=14)
        box(s, L, IN(5.90), W, IN(0.72),
            "بطاقة أولى مكتوب عليها «مخالف» هي التصميم وهو يعمل، لا خلل فيه — وتحدث لواحد من كل خمسة ملفات تقريباً.",
            fill=ORANGE, size=15, bold=True)
        box(s, L, IN(6.75), W, IN(0.40),
            "مقيسة على 3000 ملف عشوائي عبر الشيفرة الحقيقية  ·  رقم البوابة من npm run validate:planner",
            fill=BLUE, size=11)
    else:
        head(s, MARK_EN, "The order is a trade-off comparison, not a fit ranking. Here is what that means in practice.", 0)
        table(s, L, IN(1.80), int(W * 0.46), [
            ["The first card is labeled", "Share"],
            ["Aligned", "51%"],
            ["Weakly aligned", "28%"],
            ["Misaligned", "19%"],
            ["Strongly misaligned", "3%"],
        ], [0.62, 0.38], row_h=[IN(0.44)] + [IN(0.46)] * 4, size=14)
        box(s, L + int(W * 0.52), IN(1.80), int(W * 0.48), IN(2.30),
            "THE BEST-FITTING OPTION IS NEVER BURIED\n\n"
            "Card #1 or #2   —   84% of the time\n"
            "Top three         —   95.5%\n"
            "Cards 4 to 6    —   under 5%",
            fill=GREEN, size=15, bold=True)
        box(s, L, IN(4.35), W, IN(1.35),
            "THE SEPARATION GATE:  planner #1 == alignment #1 must be no more than 50%. It currently reports 49%.\n"
            "That gate is why the planner exists. If the top card were usually the best-fitting one, \"chose the first card\"\n"
            "and \"chose the option that fits me\" would be the SAME EVENT, and neither could be interpreted afterward.",
            fill=PANEL, size=14)
        box(s, L, IN(5.90), W, IN(0.72),
            "A first card reading \"Misaligned\" is the design working, not a fault. It happens to about one profile in five.",
            fill=ORANGE, size=15, bold=True)
        box(s, L, IN(6.75), W, IN(0.40),
            "Measured over 3,000 random profiles through the shipped code  ·  gate figure from npm run validate:planner",
            fill=BLUE, size=11)
    return s


def move_after(prs, marker):
    ids = prs.slides._sldIdLst
    entries = list(ids)
    target = None
    for i, s in enumerate(prs.slides):
        heads = [sh.text_frame.text for sh in s.shapes if sh.has_text_frame and sh.text_frame.text.strip()]
        if heads and marker in heads[0]:
            target = i
            break
    if target is None:
        return False
    mine = entries[-1] if len(entries) == len(list(ids)) else list(ids)[-1]
    mine = list(ids)[-1]
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
                    sh.text_frame.paragraphs[0].runs[0].text = str(i)
                    n += 1
                break
    return n


def main(ar):
    name = "Block5_Design_Update_ARABIC" if ar else "Block5_Design_Update_for_Advisor"
    path = os.path.join(OUT, name + ".pptx")
    D.set_locale(font="Arial" if ar else "Calibri", rtl=ar)
    prs = Presentation(path)
    marker = MARK_AR if ar else MARK_EN
    if any(marker in sh.text_frame.text for s in prs.slides for sh in s.shapes if sh.has_text_frame):
        print("REFUSING: %s already has the slide." % os.path.basename(path))
        return 1
    before = len(prs.slides)
    build(prs, ar)
    placed = move_after(prs, AFTER_AR if ar else AFTER_EN)
    pages = renumber(prs, ar)
    prs.save(path)
    print("OK  %s   %d -> %d slides  ·  placed after the card-order slide: %s  ·  pages: %d"
          % (os.path.basename(path), before, len(prs.slides), placed, pages))
    return 0


if __name__ == "__main__":
    sys.exit(main("--ar" in sys.argv))
