"""build_tables.py: the analysis tables, from a CODED records file (17 November 2026).

Part 3 of PLAN_Analysis_code.md. It reads a coded file (participants_ai_safe.json: every Prolific ID replaced by
P001, P002, ...), keeps the records the registration includes, and builds the tables every registered test reads:

    P   one row per participant: condition, the scores, the covariates, the robustness flags, the Blocks 1-3 rungs,
        the scenario-6 test
    S   one row per participant x scenario (six each): first pick, final choice, labels, performance captured,
        shortfall, departure, whether the condition's page opened
    O   one row per participant x decision scenario (1-4) x option (six each): the choice model of C7
    V   one row per value move (description only)

Every derived number is RECOMPUTED here with the formulas of the OSF Variables page (Indices 2, 4, 6, 7, 8, 9, 10),
from the stored profiles and the launch option numbers (option_numbers_deploy-v9.json), and checked against what the
study's own code saved, which is rounded. The tests use the exact values; the self-checks prove they are the same
numbers. Nothing here decides an analysis rule: every rule is quoted from the registration where it is used.

The tables never hold a Prolific ID: a record whose ID looks like a real one (24 letters a-f and digits) is refused.
"""
from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
OPTIONS_FILE = HERE / "option_numbers_deploy-v9.json"
REAL_PROLIFIC_ID = re.compile(r"^[0-9a-f]{24}$", re.IGNORECASE)
CONDITIONS = ["CVR+APA", "CVR_Only", "APA_Only", "Baseline"]
HELP_CONDITIONS = {"CVR+APA", "CVR_Only", "APA_Only"}
MISFIT = {"misaligned", "strongly_misaligned"}
GOOD_FIT = {"aligned", "weakly_aligned"}
FAST_SCENARIO_MS = 15_000          # OSF: "two or more scenarios decided in under 15 seconds"
FAST_ANSWER_SECONDS = 2            # OSF: "median under 2 seconds between answers"
STRAIGHTLINE_MIN_RATINGS = 8       # OSF: "the same answer to every feedback rating (at least 8 ratings)"


def js_sum(values) -> float:
    """Plain left-to-right addition, as JavaScript's reduce does it. Python's built-in sum() of floats has used a more
    precise (compensated) addition since Python 3.12, which can differ in the last binary digit, and that digit decides an
    exact tie or an exact half. Every sum the study's code makes is therefore repeated here the study's way."""
    acc = 0.0
    for v in values:
        acc += v
    return acc


def js_round(x: float) -> int:
    """Math.round of JavaScript: halves go up. The study's code rounds this way; Python's round() does not."""
    return int(math.floor(x + 0.5))


# ---------------------------------------------------------------------------------------------------------- the menus
class Menus:
    """The launch option numbers, and the registered formulas on them."""

    def __init__(self, path: Path = OPTIONS_FILE):
        f = json.loads(path.read_text(encoding="utf8"))
        if f.get("launch_tag") != "deploy-v9" or f.get("src_differs_from_launch_tag") is not False:
            raise SystemExit("option_numbers_deploy-v9.json is not the launch file.")
        self.policy = f["policy_value_keys"]
        self.metric_keys = f["metric_keys"]
        self.t_flat = float(f["prediction_temperature_flat"])
        self.t_sharp = float(f["prediction_temperature_sharp"])
        self.label_weights = {int(n): w for n, w in f["label_weights"].items()}
        self.scenarios = f["scenarios"]
        self.by_id = {s["id"]: s for s in self.scenarios}
        self.order = [s["id"] for s in self.scenarios]
        self.option = {(s["id"], o["id"]): o for s in self.scenarios for o in s["options"]}

    # Index 2: option fit
    def shortfall(self, u: dict, opt: dict) -> float:
        return js_sum((u[k] / 100.0) * max(0.0, u[k] - opt["values"][k]) for k in self.policy)

    def most_possible(self, u: dict) -> float:
        return js_sum((u[k] / 100.0) * u[k] for k in self.policy)

    def fit(self, u: dict, opt: dict) -> float:
        most = self.most_possible(u)
        if most <= 0:
            return 100.0
        return min(100.0, max(0.0, 100.0 * (1.0 - self.shortfall(u, opt) / most)))

    def delivery(self, u: dict, opt: dict) -> float:
        return js_sum((u[k] / 100.0) * opt["values"][k] for k in self.policy)

    def ranking(self, scenario_id: str, u: dict) -> list[str]:
        """The options from best to worst fit: shortfall, then what is delivered (more first), then id (labelOptions)."""
        opts = self.by_id[scenario_id]["options"]
        return [o["id"] for o in sorted(opts, key=lambda o: (self.shortfall(u, o), -self.delivery(u, o), o["id"]))]

    @staticmethod
    def label_of_rank(index: int, n: int) -> str:
        """rankLabel: 1st Aligned, 2nd Weakly aligned, the rest split in two (first half rounded up Misaligned)."""
        if index < 1:
            return "aligned"
        if index < 2:
            return "weakly_aligned"
        remaining = n - 2
        return "misaligned" if (index - 2) < math.ceil(remaining / 2) else "strongly_misaligned"

    def weight(self, level: str, n: int) -> float:
        return float(self.label_weights[n][level])

    # Index 6: performance captured
    def composite(self, opt: dict) -> float:
        return js_sum(opt["metrics"][k] for k in self.metric_keys) / len(self.metric_keys)

    def captured(self, scenario_id: str, option_id: str) -> float:
        opts = self.by_id[scenario_id]["options"]
        comps = [self.composite(o) for o in opts]
        lo, hi = min(comps), max(comps)
        if hi - lo <= 0:
            return 50.0
        return ((self.composite(self.option[(scenario_id, option_id)]) - lo) / (hi - lo)) * 100.0   # capturedOf's order

    # Index 7: departure share
    def distance(self, u: dict, opt: dict) -> float:
        return js_sum(abs(u[k] - opt["values"][k]) for k in self.policy) / len(self.policy)

    def departure(self, scenario_id: str, option_id: str, u: dict) -> float:
        opts = self.by_id[scenario_id]["options"]
        ds = [self.distance(u, o) for o in opts]
        lo, hi = min(ds), max(ds)
        if hi - lo <= 0:
            return 50.0
        return ((self.distance(u, self.option[(scenario_id, option_id)]) - lo) / (hi - lo)) * 100.0   # positionRows' order

    def menu_mean_departure(self, scenario_id: str, u: dict) -> float:
        return float(np.mean([self.departure(scenario_id, o["id"], u) for o in self.by_id[scenario_id]["options"]]))

    # Index 10: the Moral Prediction Function
    def temperature(self, vci: float, stability: float) -> float:
        c = (min(1.0, max(0.0, vci / 100.0)) + min(1.0, max(0.0, stability / 100.0))) / 2.0
        c = min(1.0, max(0.0, c))
        return self.t_flat - c * (self.t_flat - self.t_sharp)

    def mpf(self, scenario_id: str, u: dict, temperature: float) -> dict:
        """p for every option, and the top pick (ties as in labelOptions: what is delivered, then id)."""
        opts = self.by_id[scenario_id]["options"]
        fits = {o["id"]: -self.shortfall(u, o) for o in opts}
        top = max(fits.values())
        w = {i: math.exp((f - top) / temperature) for i, f in fits.items()}
        total = js_sum(w[o["id"]] for o in opts)
        p = {i: w[i] / total for i in w}
        order = sorted(opts, key=lambda o: (-p[o["id"]], -self.delivery(u, o), o["id"]))
        return {"p": p, "top": order[0]["id"], "order": [o["id"] for o in order]}


# ---------------------------------------------------------------------------------------------------------- reading
@dataclass
class Checks:
    """Every self-check: how many values were compared, and every disagreement (field, participant, detail)."""
    compared: dict = field(default_factory=dict)
    problems: list = field(default_factory=list)
    unreadable: dict = field(default_factory=dict)

    def ok(self, name: str, good: bool, who: str, detail: str = "") -> None:
        self.compared[name] = self.compared.get(name, 0) + 1
        if not good:
            self.problems.append({"check": name, "participant": who, "detail": detail})

    def missing(self, name: str, who: str) -> None:
        self.unreadable.setdefault(name, []).append(who)


def get(d, dotted: str, default=None):
    cur = d
    for part in dotted.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return default
        cur = cur[part]
    return cur


def policy_of(dimensions, keys) -> dict | None:
    if not isinstance(dimensions, list):
        return None
    by = {d.get("key"): d.get("score") for d in dimensions if isinstance(d, dict)}
    if any(not isinstance(by.get(k), (int, float)) for k in keys):
        return None
    return {k: float(by[k]) for k in keys}


def load_records(path: Path) -> list[dict]:
    text = Path(path).read_text(encoding="utf8").strip()
    if text.startswith("["):
        docs = json.loads(text)
    else:
        docs = [json.loads(line) for line in text.splitlines() if line.strip()]
    for d in docs:
        pid = d.get("prolific_pid")
        if isinstance(pid, str) and REAL_PROLIFIC_ID.match(pid.strip()):
            raise SystemExit("This file holds a real-looking Prolific ID. Use the coded copy (participants_ai_safe.json).")
        if isinstance(d.get("email"), str) and "@" in d["email"]:
            raise SystemExit("This file holds an email address. Use the coded copy (participants_ai_safe.json).")
    return docs


def select(docs: list[dict]) -> tuple[list[dict], dict]:
    """The registered sample (OSF page 6, 'Data inclusion and exclusion'), with every record left out counted by reason."""
    kept, left_out = [], {}
    for d in docs:
        reason = None
        if d.get("status") != "Study Completed":
            reason = "did not complete the study"
        elif d.get("condition_source") in ("address", "random_offline"):
            reason = "a test session (condition from the web address, or made without the server)"
        elif d.get("condition_type") not in CONDITIONS:
            reason = "no condition on record"
        if reason:
            left_out[reason] = left_out.get(reason, 0) + 1
        else:
            kept.append(d)
    return kept, left_out


# ---------------------------------------------------------------------------------------------------------- the tables
def build(docs: list[dict], menus: Menus | None = None) -> dict:
    menus = menus or Menus()
    included, left_out = select(docs)
    chk = Checks()
    P, S, O, V = [], [], [], []

    for d in included:
        who = str(d.get("prolific_pid") or d.get("participant_id"))
        cond = d["condition_type"]
        b5 = get(d, "blocks.block5_emergency_scenarios", {}) or {}
        rows = b5.get("scenarioResults") or []
        u0 = policy_of(get(b5, "originalProfile.dimensions"), menus.policy)
        mpf_rows = {r.get("scenario_id"): r for r in (get(d, "analysis.mpf_predictions_every_scenario.by_scenario") or [])}
        pct_rows = {r.get("scenario_id"): r for r in (get(d, "analysis.mpf_prediction_percentages.by_scenario") or [])}
        align_rows = {r.get("scenario_id"): r for r in (get(d, "analysis.alignment_records.by_scenario") or [])}
        pos_rows = {r.get("scenario_id"): r for r in (get(d, "analysis.position_effect.by_scenario") or [])}
        card_rows = {r.get("scenario_id"): r for r in (get(d, "analysis.card_order_by_scenario.by_scenario") or [])}
        move_rows = {r.get("scenario_id"): r for r in (get(d, "analysis.value_moves_asked_for_and_made.by_scenario") or [])}
        if u0 is None:
            chk.missing("originalProfile", who)
        if len(rows) != 6:
            chk.missing("six scenario rows", who)

        vci_stored = get(d, "headline.consistency_score")
        stab_stored = get(d, "headline.stability_score")
        vci_b5, stab_b5 = b5.get("vci"), b5.get("stability")
        temperature = menus.temperature(vci_b5, stab_b5) if isinstance(vci_b5, (int, float)) and isinstance(stab_b5, (int, float)) else None

        weights4, departures5 = [], {}
        for i, r in enumerate(rows):
            sid = r.get("scenarioId")
            if sid not in menus.by_id:
                chk.missing("a known scenario id", who)
                continue
            sc = menus.by_id[sid]
            n = len(sc["options"])
            order = menus.order.index(sid) + 1
            tel = r.get("telemetry") or {}
            mrow = mpf_rows.get(sid, {})
            u_open = mrow.get("profile_used_values")
            u_open = {k: float(u_open[k]) for k in menus.policy} if isinstance(u_open, dict) and all(
                isinstance(u_open.get(k), (int, float)) for k in menus.policy) else None
            if u_open is None:
                chk.missing("profile_used_values", who)
            final_id = r.get("selectedOptionId")
            pt = r.get("predictionTest") or {}
            first_id = pt.get("firstChoiceOptionId") if sid == "veil_emergency_reserve_rule" and pt else r.get("firstChoiceOptionId")
            ranked = r.get("rankedOptionIds") or []
            level_stored = r.get("alignmentLevel")
            # The label of an option = its place in the ranking of the profile the scenario opened with.
            label_of = {oid: menus.label_of_rank(k, n) for k, oid in enumerate(ranked)}
            final_label = label_of.get(final_id)
            first_label = label_of.get(first_id)
            chk.ok("final label from the saved ranking = saved label", final_label == level_stored, who,
                   f"{sid}: {final_label} vs {level_stored}")
            if u_open is not None:
                exact_rank = menus.ranking(sid, u_open)
                chk.ok("saved ranking = ranking recomputed from the opening profile", exact_rank == ranked, who, sid)
                s_first = menus.shortfall(u_open, menus.option[(sid, first_id)]) if (sid, first_id) in menus.option else None
                s_final = menus.shortfall(u_open, menus.option[(sid, final_id)])
                stored_s = r.get("matchShortfall")
                chk.ok("final shortfall recomputed = saved (2 decimals)",
                       isinstance(stored_s, (int, float)) and abs(js_round(s_final * 100) / 100 - stored_s) < 1e-9, who, sid)
            else:
                s_first = s_final = None
            # Index 6
            cap_final = menus.captured(sid, final_id)
            cap_first = menus.captured(sid, first_id) if (sid, first_id) in menus.option else None
            chk.ok("performance captured recomputed = saved (rounded)", js_round(cap_final) == r.get("performanceCaptured"), who, sid)
            # The condition's page, from the page's own counters
            page_opened = (tel.get("cvrVisits", 0) or 0) > 0 or (tel.get("apaVisits", 0) or 0) > 0 \
                or (tel.get("baselineConfirmVisits", 0) or 0) > 0
            # Index 7 (scenarios 1-5 the final choice; scenario 6 the rule chosen before the prediction, for B5)
            dep = dep_adj = None
            if u0 is not None:
                chosen_for_departure = first_id if sid == "veil_emergency_reserve_rule" else final_id
                dep = menus.departure(sid, chosen_for_departure, u0)
                dep_adj = dep - menus.menu_mean_departure(sid, u0)
                if sid in pos_rows:
                    chk.ok("departure recomputed = saved (rounded)", js_round(dep) == pos_rows[sid].get("departure_share"), who, sid)
                if order <= 5:
                    departures5[order] = dep
            if sc["scored"] and level_stored in menus.label_weights[n]:
                weights4.append(menus.weight(level_stored, n))
            # The first choice in two other places
            if sid in pct_rows and sid != "veil_emergency_reserve_rule":
                chk.ok("first choice = mpf_prediction_percentages' first choice",
                       pct_rows[sid].get("their_first_choice_option_id") == first_id, who, sid)
            # MPF probabilities (Index 10), checked against the saved ones
            mpf_now = mpf_before = None
            if temperature is not None and u_open is not None and u0 is not None:
                chk.ok("prediction temperature recomputed = saved", abs(temperature - float(mrow.get("sharpness_setting", -1))) < 1e-9, who, sid)
                mpf_now = menus.mpf(sid, u_open, temperature)
                mpf_before = menus.mpf(sid, u0, temperature)
                saved = {o.get("option_id"): o.get("mpf_chance_percent") for o in mrow.get("by_option") or []}
                same = all(js_round(mpf_now["p"][oid] * 1000) / 10 == saved.get(oid) for oid in mpf_now["p"])
                chk.ok("prediction chances recomputed = saved (1 decimal)", same, who, sid)
                chk.ok("prediction top pick recomputed = saved", mpf_now["top"] == mrow.get("most_expected_option_id"), who, sid)
            card = card_rows.get(sid, {})
            positions = {c.get("option_id"): c.get("position") for c in card.get("cards_from_first_to_last") or []}
            S.append({
                "pid": who, "condition": cond, "order": order, "scenario_id": sid, "role": sc["decision_role"],
                "decision": bool(sc["scored"]), "n_options": n,
                "first_id": first_id, "final_id": final_id, "changed": first_id != final_id,
                "first_label": first_label, "final_label": level_stored,
                "first_misfit": first_label in MISFIT, "final_good_fit": level_stored in GOOD_FIT,
                "page_opened": page_opened,
                "reflection_visits": tel.get("cvrVisits", 0) or 0, "clarification_visits": tel.get("apaVisits", 0) or 0,
                "rejection_page_visits": tel.get("cvrRejectionVisits", 0) or 0,
                "confirm_misfit_visits": tel.get("baselineConfirmVisits", 0) or 0,
                "confirm_good_fit_visits": tel.get("baselineGoodFitConfirmVisits", 0) or 0,
                "how_sure_asked": ("howSureOnConfirm" in r) or ("baselineConfirm" in r),
                "captured_first": cap_first, "captured_final": cap_final,
                "shortfall_first": s_first, "shortfall_final": s_final,
                "departure": dep, "departure_menu_adjusted": dep_adj,
                "time_ms": r.get("timeMs"),
                "card_position_first": positions.get(first_id),
                "mpf_p_first_updated": None if mpf_now is None else mpf_now["p"].get(first_id),
                "mpf_hit_first_updated": None if mpf_now is None else mpf_now["top"] == first_id,
                "mpf_p_first_before": None if mpf_before is None else mpf_before["p"].get(first_id),
                "mpf_hit_first_before": None if mpf_before is None else mpf_before["top"] == first_id,
            })
            # The choice model (C7): every option of a decision scenario, chosen = the first pick
            if sc["scored"] and u0 is not None:
                for o in sc["options"]:
                    O.append({
                        "pid": who, "condition": cond, "scenario_id": sid, "stratum": f"{who}|{sid}",
                        "option_id": o["id"], "chosen": int(o["id"] == first_id),
                        "position": positions.get(o["id"]),
                        "captured": menus.captured(sid, o["id"]),
                        "fit_before": menus.fit(u0, o),
                        "mpf_p_updated": None if mpf_now is None else mpf_now["p"][o["id"]],
                        "mpf_top_updated": None if mpf_now is None else mpf_now["top"] == o["id"],
                        "mpf_p_before": None if mpf_before is None else mpf_before["p"][o["id"]],
                        "mpf_top_before": None if mpf_before is None else mpf_before["top"] == o["id"],
                    })
            for m in (move_rows.get(sid, {}).get("moves") or []):
                V.append({"pid": who, "condition": cond, "scenario_id": sid, **{k: v for k, v in m.items() if not isinstance(v, (dict, list))}})

        # Index 4: VCI, exact
        vci_exact = (js_sum(weights4) / 4) * 100.0 if len(weights4) == 4 else None   # computeVCI's order
        chk.ok("VCI recomputed = saved (rounded)", vci_exact is not None and js_round(vci_exact) == vci_stored, who,
               f"{vci_exact} vs {vci_stored}")
        # Index 8: the wish gap (B6), on the values scenario 4 opened with
        srow = {r.get("scenarioId"): r for r in rows}
        s4, s5 = srow.get("care_rota_reduction"), srow.get("care_rota_receiving")
        wish_gap = None
        if s4 and s5 and s4.get("alignmentLevel") in menus.label_weights[6] and s5.get("alignmentLevel") in menus.label_weights[6]:
            wish_gap = 100 * menus.weight(s5["alignmentLevel"], 6) - 100 * menus.weight(s4["alignmentLevel"], 6)
            stored_gap = get(d, "analysis.position_effect.decided_versus_wished.responsibility_gap")
            chk.ok("wish gap recomputed = saved", isinstance(stored_gap, (int, float)) and abs(js_round(wish_gap) - stored_gap) <= 0, who,
                   f"{wish_gap} vs {stored_gap}")
            chk.ok("the wish was scored on scenario 4's opening values", s5.get("scoredOnProfileOf") == "care_rota_reduction", who)
        # Position spread (B7): the largest minus the smallest departure over scenarios 1-5
        spread = (max(departures5.values()) - min(departures5.values())) if len(departures5) == 5 else None
        stored_spread = get(d, "analysis.position_effect.overall_effect")
        if spread is not None and isinstance(stored_spread, (int, float)):
            chk.ok("position spread recomputed = saved (within 1 point: the saved one is made of rounded parts)",
                   abs(spread - stored_spread) <= 1.0, who, f"{spread} vs {stored_spread}")

        # Index 9: Block 1 place spread; the positive-control rungs
        def money_rung(place):
            t = get(d, f"blocks.block1_money.thresholds.threshold_{place}")
            if not isinstance(t, dict):
                return None
            return t.get("thresholdAmountIndex") if t.get("accepted") else 8
        rungs = {p: money_rung(p) for p in ("sidewalk", "wealthy", "shelter")}
        place_spread = (max(rungs.values()) - min(rungs.values())) if all(v is not None for v in rungs.values()) else None

        def trolley_rung(which):
            t = get(d, f"blocks.block2_trolley.{which}")
            if not isinstance(t, dict):
                return None
            return t.get("thresholdIndex") if t.get("accepted") else 8
        ai = get(d, "blocks.block3_ai_workforce.thresholds") or {}

        def ai_rung(cell):
            t = next((v for k, v in ai.items() if isinstance(v, dict) and v.get("groupTypeKey") == cell[0]
                      and v.get("groupSizeKey") == cell[1]), None)
            if t is None:
                return None
            return t.get("thresholdGainIndex") if t.get("accepted") else 6
        low = [ai_rung(("low_buffer", s)) for s in ("small", "medium", "large")]
        high = [ai_rung(("high_buffer", s)) for s in ("small", "medium", "large")]

        # Scenario 6 (the T table lives inside P: one row per participant)
        s6 = get(d, "analysis.scenario6_mpf_test") or {}
        s6p = s6.get("participant") or {}
        s6m = s6.get("mpf_prediction") or {}
        by_rule = {x.get("rule"): x.get("mpf_chance_percent") for x in s6m.get("by_rule") or []}
        top_rule = s6m.get("most_expected_rule")
        first_rule = s6p.get("rule_chosen_before_seeing_the_guess")
        final_rule = s6p.get("rule_chosen_in_the_end")
        s6row = srow.get("veil_emergency_reserve_rule") or {}
        pt = s6row.get("predictionTest") or {}
        top_p_exact = None
        if pt.get("shownProbabilities"):
            top_entry = next((x for x in pt["shownProbabilities"] if x.get("optionId") == pt.get("predictedTopOptionId")), None)
            top_p_exact = top_entry.get("probability") if top_entry else None
            chk.ok("scenario 6: the saved test agrees with the row (first rule, top rule, hit)",
                   pt.get("firstChoiceOptionId") == first_rule and pt.get("predictedTopOptionId") == top_rule
                   and bool(pt.get("predictionWasRight")) == bool(s6p.get("mpf_guessed_right")), who)

        # Feedback (Index 11), saved by the study's own computeWellbeing
        wb = get(d, "blocks.feedback_answers.feedback.wellbeing") or {}
        subs = wb.get("subscales") or {}
        ratings = feedback_ratings(get(d, "blocks.feedback_answers.feedback"))
        straight = len(ratings) >= STRAIGHTLINE_MIN_RATINGS and len(set(ratings)) == 1
        pattern_share = get(d, "analysis.feedback_answer_patterns.share_of_the_most_common_answer")
        pattern_n = get(d, "analysis.feedback_answer_patterns.ratings_counted")
        chk.ok("straightlining from the raw ratings = feedback_answer_patterns",
               straight == (pattern_share == 1 and isinstance(pattern_n, int) and pattern_n >= STRAIGHTLINE_MIN_RATINGS), who)

        # The robustness flags (OSF page 6), each from its own record
        fast_blocks = get(d, "analysis.blocks_1_to_4_checks.answered_very_fast")
        n_fast_scen = sum(1 for r in rows if isinstance(r.get("timeMs"), (int, float)) and r["timeMs"] < FAST_SCENARIO_MS)
        chk.ok("scenarios under 15 s recounted = saved", n_fast_scen == get(d, "quality.scenarios_under_15_seconds"), who)
        att = get(d, "analysis.attention_checks.checks") or []
        att_wrong = any(c.get("correct") is False for c in att) if att else None
        att_answered = sum(1 for c in att if c.get("correct") is not None)

        gender_raw = d.get("gender")
        gender3 = "female" if gender_raw == "Female" else "male" if gender_raw == "Male" else "other_or_prefer_not"
        P.append({
            "pid": who, "condition": cond, "help": cond in HELP_CONDITIONS,
            "cvr": cond in ("CVR+APA", "CVR_Only"), "apa": cond in ("CVR+APA", "APA_Only"),
            "age": d.get("age"), "gender": gender_raw, "gender3": gender3,
            "active_minutes": get(d, "active_time.total_active_minutes"),
            "completed_at": d.get("completed_at"),
            "vci": vci_exact, "vci_saved": vci_stored,
            "stability": stab_stored, "stability_measured": get(d, "headline.stability_was_measured"),
            "stability_order": get(d, "headline.value_order_stability"),
            "stability_difference": get(d, "headline.value_difference_stability"),
            "performance": get(d, "headline.performance_captured"),
            "wellbeing": wb.get("wellbeingComposite"), "satisfaction": subs.get("decisionSatisfaction"),
            "value_congruence": subs.get("valueCongruence"),
            "wish_gap": wish_gap, "position_spread": spread, "place_spread": place_spread,
            "money_sidewalk": rungs["sidewalk"], "money_wealthy": rungs["wealthy"], "money_shelter": rungs["shelter"],
            "trolley_lever": trolley_rung("leverThreshold"), "trolley_bridge": trolley_rung("bridgeThreshold"),
            "ai_low_buffer_mean": float(np.mean(low)) if all(v is not None for v in low) else None,
            "ai_high_buffer_mean": float(np.mean(high)) if all(v is not None for v in high) else None,
            "s6_first_rule": first_rule, "s6_final_rule": final_rule, "s6_top_rule": top_rule,
            "s6_hit": s6p.get("mpf_guessed_right"),
            "s6_top_p": top_p_exact if top_p_exact is not None else (by_rule.get(top_rule) / 100 if by_rule.get(top_rule) is not None else None),
            "s6_p_first": next((x.get("probability") for x in pt.get("shownProbabilities") or [] if x.get("optionId") == first_rule), None),
            "s6_sounds_like_me": s6p.get("does_this_sound_like_me_1_to_7"),
            "s6_changed": s6p.get("changed_after_seeing_the_guess"),
            "flag_fast_blocks": fast_blocks, "flag_fast_scenarios": n_fast_scen >= 2,
            "flag_straightlined": straight, "flag_straightlined_saved_flag": get(d, "quality.straightlined_feedback"),
            "flag_attention_wrong": att_wrong, "attention_checks_answered": att_answered,
        })

    P_df, S_df, O_df, V_df = pd.DataFrame(P), pd.DataFrame(S), pd.DataFrame(O), pd.DataFrame(V)
    return {"P": P_df, "S": S_df, "O": O_df, "V": V_df, "checks": chk, "left_out": left_out,
            "read": len(docs), "included": len(included)}


def feedback_ratings(feedback) -> list[int]:
    """Every 1-7 rating the participant gave on the feedback page: the tool ratings, the 24 statements and the reflection and
    clarification ratings. The study's computed subscale means are NOT ratings and are left out (see quality note below)."""
    if not isinstance(feedback, dict):
        return []
    out = []
    for section in ("cvr", "apa", "decisionSupport"):
        for v in (feedback.get(section) or {}).values():
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                out.append(int(v))
    for v in (get(feedback, "wellbeing.items") or {}).values():
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            out.append(int(v))
    return out


def self_check_report(tables: dict) -> list[str]:
    chk: Checks = tables["checks"]
    lines = [f"Records read: {tables['read']}; included: {tables['included']}."]
    for reason, n in tables["left_out"].items():
        lines.append(f"Left out: {n} ({reason}).")
    for name, n in chk.compared.items():
        bad = sum(1 for p in chk.problems if p["check"] == name)
        lines.append(f"{'OK  ' if bad == 0 else 'FAIL'} {name}: {n - bad} of {n} agree.")
    for name, who in chk.unreadable.items():
        lines.append(f"UNREADABLE {name}: {len(who)} participant(s).")
    return lines


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python analysis/build_tables.py <participants_ai_safe.json>")
    t = build(load_records(Path(sys.argv[1])))
    print("\n".join(self_check_report(t)))
    for k in ("P", "S", "O", "V"):
        print(f"{k}: {len(t[k])} rows, {len(t[k].columns)} columns")
