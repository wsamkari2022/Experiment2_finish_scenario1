"""
build_advisor_apa_slides.py — appends the APA audit section to the English advisor deck.

Appends only; nothing existing is touched. Re-running would append a second copy, so it checks for
its own marker slide first and refuses.

Source of the content: docs/BLOCK5_APA_AUDIT.md
Reproduce the numbers:   npm run apa:personas

Usage:  python tools/build_advisor_apa_slides.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pptx import Presentation
from pptx.util import Emu
from pptx.enum.text import PP_ALIGN
from deck_style import (head, box, table, blank, MARGIN_L, CONTENT_W,
                        PANEL, BLUE, ORANGE, GREEN, LILAC, PALE_TEAL, TEAL,
                        INK, WHITE, MUTED, GREEN_INK, RED_INK, AMBER_INK)

DECK = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    "..", "..", "..", "Generated Outputs",
                    "Block5_Design_Update_for_Advisor.pptx")
MARKER = "The APA, audited"

IN = lambda v: int(v * 914400)
L, W = MARGIN_L, CONTENT_W


def build(prs):
    n = len(prs.slides)

    # ---------------------------------------------------------------- 1 · what and why
    n += 1; s = blank(prs)
    head(s, MARKER, "The rule is correct. What a participant experiences is not the same thing.", n)
    box(s, L, IN(1.85), W, IN(0.95),
        "THE RULE, IN ONE SENTENCE\n"
        "+30 to the value you name  ·  −20 to the value currently on top  ·  all of it scaled 0.6–1.0 by how sure you say you are",
        fill=ORANGE, size=15)
    box(s, L, IN(3.00), int(W * 0.485), IN(1.15),
        "This is TRUE of the code.\n18 automated checks assert it, and all pass.\n(npm run verify:apa)",
        fill=GREEN, size=14)
    box(s, L + int(W * 0.515), IN(3.00), int(W * 0.485), IN(1.15),
        "It is NOT the whole story.\nTwo of the questions can add to the same value,\nand the 0–100 clamp then hides the excess.",
        fill=ORANGE, size=14)
    box(s, L, IN(4.40), W, IN(1.30),
        "So we ran six participants — identical starting profile, six different sets of answers — through the real code\n"
        "and looked at what the NEXT scenario would see. Four of the six came out ranked differently.\n"
        "Nothing has been changed in response yet. The proposed fixes are on the last slide of this section.",
        fill=PANEL, size=14)

    # ---------------------------------------------------------------- 2 · the questions
    n += 1; s = blank(prs)
    head(s, "What the APA actually asks", "Reached only when a participant refuses their first choice after the vignette.", n)
    table(s, L, IN(1.85), W, [
        ["", "What is asked", "Answers"],
        ["Q1", "When you made this choice, which is closer to the truth?",
         "I do put X above Y  ·  just this situation  ·  not sure"],
        ["Q2", "Pick the one value you most want the system to weight for you\n+ How sure are you about your answers on this page? (1–5)",
         "one of the four values, plus 1–5"],
        ["Q3", "Which view most changed your mind?  (only if they opened the second lens)",
         "Directness  ·  Context"],
        ["—", "Whether they switched after meeting the affected person",
         "NOT asked — observed"],
    ], [0.07, 0.55, 0.38], row_h=[IN(0.45), IN(0.6), IN(0.85), IN(0.6), IN(0.55)], size=13)
    box(s, L, IN(5.30), W, IN(0.75),
        "Q3 is conditional, so most participants answer three things, not four.\n"
        "The stakeholder measure is behavioural on purpose — people are poor judges of what moved them.",
        fill=BLUE, size=14)

    # ---------------------------------------------------------------- 3 · the exact rules
    n += 1; s = blank(prs)
    head(s, "The exact rules", "Every number the clarification can apply.", n)
    table(s, L, IN(1.75), W, [
        ["Trigger", "Effect"],
        ["Q1 = I do put X above Y", "+15 to the value the option served   ·   −10 to the value it sacrificed"],
        ["Q1 = just this situation", "+5 served   ·   +10 sacrificed"],
        ["Q1 = not sure", "nothing"],
        ["Q2 — the value they name", "+30, and −20 to whichever value is currently top"],
        ["Q2 — confidence 1 → 5", "multiplies everything above by 0.6 · 0.7 · 0.8 · 0.9 · 1.0"],
        ["Switched after the person", "±25 — deliberately NOT scaled by confidence"],
        ["Q3 — the lens named", "+20 to that lens"],
    ], [0.33, 0.67], row_h=IN(0.44), size=13)
    box(s, L, IN(5.55), W, IN(0.95),
        "Two details an examiner will ask about:\n"
        "The −20 is SKIPPED when the value they name is already top — agreeing with yourself is never punished.\n"
        "\"Currently top\" is read AFTER Q1 has been applied, so Q1 can change where the −20 lands.",
        fill=PANEL, size=13, align=PP_ALIGN.LEFT)

    # ---------------------------------------------------------------- 4 · confidence
    n += 1; s = blank(prs)
    head(s, "What the confidence rating does", "A value starting at 0, with no stacking.", n)
    table(s, L + IN(2.4), IN(2.0), IN(6.9), [
        ["You answer", "That value becomes"],
        ["1 — not sure", "18"],
        ["2", "21"],
        ["3", "24"],
        ["4", "27"],
        ["5 — very sure", "30"],
    ], [0.5, 0.5], row_h=IN(0.46), size=14)
    box(s, L, IN(5.15), W, IN(1.15),
        "This table is asserted by npm run verify:apa, so it cannot drift from the code without a test failing.\n"
        "The rating was added because it was previously collected, stored, and used by nothing at all.\n"
        "It works exactly as intended — until the stacking on the next slides defeats it.",
        fill=GREEN, size=14)

    # ---------------------------------------------------------------- 5 · the six runs
    n += 1; s = blank(prs)
    head(s, "Six participants, same start, different answers", "Identical starting profile, so every difference is caused only by their answers.", n)
    box(s, L, IN(1.80), W, IN(0.62),
        "START for all six:   gained 79  ·  helped 66  ·  harm 60  ·  vulnerable 30        "
        "They refused an option that SERVES \"how much is gained\" and SACRIFICES \"reducing harm\".",
        fill=BLUE, size=13)
    table(s, L, IN(2.60), W, [
        ["", "Their answers", "What moved", "What the NEXT scenario sees"],
        ["A", "endorse · sure 5 · names vulnerable · switched",
         "vulnerable 30→60 (+30), gained −5, harm −10", "ORDER CHANGED"],
        ["B", "endorse · NOT SURE 1 · names gained (already top)",
         "gained 79→100 (+21)", "unchanged"],
        ["C", "just-this-time · sure 5 · names harm · switched",
         "harm 60→100 (+40), gained −15", "ORDER CHANGED"],
        ["D", "not sure · mid 3 · names helped",
         "helped 66→90 (+24), gained −16", "ORDER CHANGED"],
        ["E", "not sure · sure 5 · names vulnerable · switched",
         "vulnerable +30, gained 79→59 (−20)", "ORDER CHANGED"],
        ["F", "just-this-time · NOT SURE 1 · names vulnerable",
         "vulnerable 30→48 (+18), gained −9", "unchanged"],
    ], [0.05, 0.36, 0.36, 0.23], row_h=IN(0.47), size=12)
    box(s, L, IN(6.15), W, IN(0.52),
        "Four of six re-ranked — and the alignment label shown in the next scenario is read off that ORDER, not the raw scores.",
        fill=PANEL, size=13)

    # ---------------------------------------------------------------- 6 · what works
    n += 1; s = blank(prs)
    head(s, "What works", "The August rewrite fixed a real defect, and the evidence says so.", n)
    ys = IN(1.90); gap = IN(1.12)
    for i, (t, d) in enumerate([
        ("The ordering actually changes",
         "Before the rewrite a value at 0 could not overtake values at 100 by addition alone — stating a priority changed nothing 3 times in 4. It now lifts the named value 59% of the time."),
        ("Low confidence gives a small move",
         "Persona F answered \"1 — not sure\" and moved 18 points with no re-ranking. That is the rating doing its job."),
        ("Naming your current top never costs you",
         "The decrement is skipped, so Persona B receives no penalty for agreeing with themselves."),
        ("The framing measures stay clean",
         "The lens and stakeholder dimensions move independently of the four policy values."),
    ]):
        box(s, L, ys + i * gap, IN(3.55), IN(0.95), t, fill=GREEN, size=14, bold=True)
        box(s, L + IN(3.75), ys + i * gap, W - IN(3.75), IN(0.95), d, fill=PANEL, size=13, align=PP_ALIGN.LEFT)

    # ---------------------------------------------------------------- 7 · problem 1
    n += 1; s = blank(prs)
    head(s, "Problem 1 — the two questions stack", "And it happens to the participants who answer most consistently.", n)
    box(s, L, IN(1.80), W, IN(0.78),
        "Nothing stops Q1's bump and Q2's bump landing on the SAME value. When they do, they add.",
        fill=ORANGE, size=16, bold=True)
    table(s, L, IN(2.80), W, [
        ["Answer pattern", "Q1 gives", "Q2 gives", "Actually applied"],
        ["Endorses the option AND names the value it served   (Persona B)", "+15 × w", "+30 × w", "+45 × w"],
        ["Says \"just this situation\" AND names the value sacrificed   (Persona C)", "+10 × w", "+30 × w", "+40 × w"],
    ], [0.55, 0.15, 0.15, 0.15], row_h=[IN(0.45), IN(0.62), IN(0.62)], size=13)
    box(s, L, IN(4.55), W, IN(1.55),
        "WHY THIS IS THE COMMON CASE, NOT AN EDGE CASE\n"
        "Someone who endorses a choice naturally names the value that choice served.\n"
        "Someone who says \"only in this situation\" naturally names the value they feel they sacrificed.\n"
        "So the double-count is most likely to hit the participants whose answers are internally consistent.",
        fill=PANEL, size=14)
    box(s, L, IN(6.25), W, IN(0.50),
        "Consequence: the documented constant \"+30\" is not the applied one for a large share of participants.",
        fill=ORANGE, size=13, bold=True)

    # ---------------------------------------------------------------- 8 · problems 2 and 3
    n += 1; s = blank(prs)
    head(s, "Problems 2 and 3", "The rating gets overridden, and the ceiling hides the rest.", n)
    box(s, L, IN(1.80), W, IN(0.55), "PROBLEM 2 — \"not sure\" produced the maximum possible score",
        fill=ORANGE, size=16, bold=True)
    box(s, L, IN(2.45), W, IN(1.25),
        "Persona B answered confidence 1 — NOT SURE — and finished that value at 100 / 100.\n"
        "+45 × 0.6  =  +27, which is larger than a fully confident participant's un-stacked +30 × 1.0.\n"
        "The least sure answer produced a bigger move than the most sure one.",
        fill=PANEL, size=14)
    box(s, L, IN(3.90), W, IN(0.55), "PROBLEM 3 — the ceiling swallows the signal",
        fill=ORANGE, size=16, bold=True)
    box(s, L, IN(4.55), W, IN(1.55),
        "Two of the six personas finished on exactly 100. Once a value is pinned:\n"
        "further endorsement of it is invisible  ·  the ranking loses resolution at the top, where alignment labels are decided\n"
        "·  Stability under-reports later drift, because a pinned value cannot move.\n"
        "This compounds the already-recorded finding that ~13% of values finish a run pinned at 0 or 100.",
        fill=PANEL, size=14)
    box(s, L, IN(6.25), W, IN(0.50),
        "Minor: the ±25 stakeholder move is unscaled and large — two non-switches pin a participant at the floor.",
        fill=BLUE, size=13)

    # ---------------------------------------------------------------- 9 · rating
    n += 1; s = blank(prs)
    head(s, "Rating of the current logic", "Sound mechanism, let down by an interaction between two questions designed separately.", n)
    box(s, L, IN(1.85), IN(2.7), IN(1.35), "7 / 10", fill=TEAL, size=48, bold=True, color=WHITE)
    table(s, L + IN(2.95), IN(1.85), W - IN(2.95), [
        ["", "Assessment"],
        ["Mechanism", "Sound — the decrement is what lets order change, and it demonstrably does"],
        ["Confidence rating", "Works in isolation, defeated by stacking in combination"],
        ["Documentation honesty", "Currently FALSE for the likely modal participant — most serious item"],
        ["Saturation", "Weak — two of six personas hit the ceiling"],
        ["Fixability", "High — both fixes are small and local to one function"],
    ], [0.28, 0.72], row_h=[IN(0.40)] + [IN(0.46)] * 5, size=13)
    box(s, L, IN(5.30), W, IN(1.00),
        "The mechanism is right and the August rewrite fixed a genuine defect: values previously could not overtake at all.\n"
        "What it is let down by is an interaction between two questions that were each designed on their own.",
        fill=PANEL, size=14)

    # ---------------------------------------------------------------- 10 · fixes
    n += 1; s = blank(prs)
    head(s, "Two proposed fixes — NOT implemented", "Both live in applyApaUpdates(). Your call, not ours.", n)
    box(s, L, IN(1.85), int(W * 0.485), IN(0.55), "FIX 1 — cap the total move", fill=GREEN, size=16, bold=True)
    box(s, L, IN(2.50), int(W * 0.485), IN(1.85),
        "Clamp each value's NET change for one clarification to ±30 × confidence.\n\n"
        "Kills Problems 1 and 2 together.\n"
        "Makes the published rule literally true again.\n"
        "One clamp, applied once, easy to state in the write-up.",
        fill=PANEL, size=14)
    box(s, L + int(W * 0.515), IN(1.85), int(W * 0.485), IN(0.55), "FIX 2 — don't double-count", fill=BLUE, size=16, bold=True)
    box(s, L + int(W * 0.515), IN(2.50), int(W * 0.485), IN(1.85),
        "Where Q1 and Q2 name the same value, take the LARGER of the two bumps rather than the sum.\n\n"
        "More surgical — leaves untouched every case where the two questions name different values.\n"
        "Slightly harder to describe in a sentence.",
        fill=PANEL, size=14)
    box(s, L, IN(4.60), W, IN(0.62),
        "RECOMMENDED: Fix 1. One line, makes the published rule true, and trivial to describe to an examiner.",
        fill=ORANGE, size=15, bold=True)
    box(s, L, IN(5.38), W, IN(1.00),
        "AFTER EITHER FIX, RE-RUN:   npm run verify:apa   then   npm run validate:block5\n"
        "Gate A-APA-3 encodes the published table (18/21/24/27/30). Both fixes leave the un-stacked path alone, so it should still pass —\n"
        "if it fails, the fix changed more than intended. The full suite matters because Stability's churn ceiling (56) was calibrated on current APA behaviour.",
        fill=PANEL, size=13)

    # ---------------------------------------------------------------- 11 · examiner line
    n += 1; s = blank(prs)
    head(s, "What to say to an examiner", "A checked rule with a known flaw beats a clean rule nobody tested.", n)
    box(s, L, IN(2.05), W, IN(2.10),
        "\"The profile update applies fixed constants, identical for every participant, so it cannot bias a\n"
        "between-participant comparison. We audited its behaviour across six answer patterns and found that\n"
        "two of the questions can reinforce the same value, so the effective increment for an internally\n"
        "consistent participant is larger than the nominal one. We report the nominal rule, the audited\n"
        "behaviour, and the resulting saturation rate together.\"",
        fill=BLUE, size=16, italic=True)
    box(s, L, IN(4.50), W, IN(1.25),
        "This is a STRONGER position than a clean rule that had never been checked.\n"
        "It is also the same standard already applied elsewhere in the project: the drift check was reported as gone\n"
        "rather than quietly weakened, and the headroom scaling was removed for exactly this reason in August.",
        fill=PANEL, size=14)

    # ---------------------------------------------------------------- 12 · everything else
    n += 1; s = blank(prs)
    head(s, "What else changed since the last deck", "Interface and instrumentation. None of it touches a measure.", n)
    table(s, L, IN(1.80), W, [
        ["Change", "Why"],
        ["A full-screen INTRO PAGE before every scenario — scene, situation, role, employer principle.\nThe options are deliberately absent.",
         "Position is what Block 5 varies. On the combined page a participant could start comparing options before taking in who they were.\nContinue is disabled 6s; time is stored as introSeconds."],
        ["A MORPH TRANSITION from the intro to the scenario page.",
         "The cards travel and shrink into the sidebar, so the material just read stays present.\nBuilt as FLIP, not View Transitions (Firefox). prefers-reduced-motion is honoured."],
        ["The EMPLOYER PRINCIPLE CARD rebuilt — slate letterhead, large quote, company's value in bold amber italic.\nIt now shows NO numbers.",
         "It previously showed the participant's frozen score beside the company's, while the card below showed their LIVE score —\ntwo different numbers for the same person on one screen. \"The one you rated lowest\" could also become false."],
        ["The scenario page no longer opens part-way down.",
         "The page behind the intro kept its own scrollbar, so reading the intro scrolled it. It is now frozen, and reset to top\nBEFORE the morph measures — a scrolled page would send the cards to the wrong place."],
        ["Confidence moved to Question 2. \"How many are harmed\" renamed \"Reducing harm\" everywhere.",
         "The rating now sits under the value it scales. The arithmetic was NOT changed.\nThe old value name described the problem; the new one describes the choice."],
    ], [0.40, 0.60], row_h=[IN(0.40)] + [IN(0.92)] * 5, size=11, head_size=13)
    return len(prs.slides)


if __name__ == "__main__":
    prs = Presentation(DECK)
    existing = [sh.text_frame.text for s in prs.slides for sh in s.shapes if sh.has_text_frame]
    if any(MARKER in t for t in existing):
        print("REFUSING: the deck already contains the APA audit section.")
        sys.exit(1)
    before = len(prs.slides)
    after = build(prs)
    prs.save(DECK)
    print("OK  %s\n    %d slides -> %d slides (%d added)" % (os.path.basename(DECK), before, after, after - before))
