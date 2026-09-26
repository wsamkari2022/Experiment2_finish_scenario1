# Run notes - blind rater (Claude Opus)

Date: 2026-09-26

## Model

The organizer, both probe agents and both raters ran on **Claude Opus 5.5** (model ID `claude-opus-5-5`). No model parameter was passed to any agent, so each one ran on the organizer's own model. Both raters named themselves in their answers: `"claude-opus-5-5 (Opus 5.5)"` (value rater) and `"claude-opus-5-5"` (performance rater).

## Probe result

Both probes **PASSED**. The replies are saved word for word in `probe_result.md`.

- `blind-value-rater`: PASSED on all three rules. Its only tool was SubagentHandback, it wrote COULD NOT READ and never gave the probe word, and it saw only Claude Code's standard blocks. Its one tool call was SubagentHandback.
- `blind-measure-rater`: PASSED on all three rules, the same way. Its one tool call was SubagentHandback.

## How the sheets were sent

Each prompt was the required first line, a blank line, then the whole sheet. I first wrote each prompt to a scratch file and checked it by script against the sheet on disk. Both were identical, character for character: sheet.md (26,403 characters) and sheet_measures.md (34,250 characters). Nothing was added, cut or reordered.

## Runs

- **Value rater (`blind-value-rater`)**: ran **once**. `answer.json` passed all three checks: it is valid JSON, its `sheet_check_code` is `maple-river-64` (matching sheet.md), and it has scenarios 2, 3 and 4 with all 4 values and all 6 letters A-F in every ranking and scores list. No rerun was needed. It reported `used_any_tool: false` and `opened_any_file: false`, and its only tool call was SubagentHandback.
- **Performance rater (`blind-measure-rater`)**: ran **once**. `answer_measures.json` passed all three checks: it is valid JSON, its `sheet_check_code` is `harvest-bridge-51` (matching sheet_measures.md), and it has scenarios 1, 2, 3 and 4 with all 5 measures and all 6 letters A-F in every ranking and scores list. No rerun was needed. It reported `used_any_tool: false` and `opened_any_file: false`, and its only tool call was SubagentHandback.

Both answers were saved unchanged, with only the ```json fence removed.

## Value rater - `unclear` (copied as is)

- Scenario 2, C (Give your car seats to the two residents with walkers): for 'How many are helped', the two residents would have left on the lift bus anyway. They get out sooner, not in addition, so the count of 'more people out' is unclear.
- Scenario 2, B (Take your household to the concrete school on the hill): for 'How much is gained', the household shelters in place and never gets out of the valley. The value is worded as 'gets out', so it is unclear how to score an option that does not leave.
- Scenario 3, A (Hold some doses back for the patients nobody reaches): the card does not say how the doses that are not held back are allocated. That affects its harm, gain and helped scores.
- Scenario 3, D (Treat the 20 who others depend on): 'How many are helped' explicitly counts lives saved through people others depend on, but the card gives no direct survival comparison with E or B.
- Scenario 4, E (Redraw the routes to cut the driving): the card does not say whose visits the remaining 100 cut hours come from, so it is unclear who bears them.

## Value rater - `comments` (copied as is)

- Scenario 4, 'Reducing harm' ('cut lands where someone else can step in') almost restates Option B's mechanism. B scores high even though its card says families 'absorb work they never agreed to'.
- Scenario 4, D: protecting the 50 who live alone means the cut falls on clients who do have someone at home. That partly fits the 'Reducing harm' definition, even though the card stresses the scheduling disruption.
- Scenario 2, A vs F on 'How much is gained': both are very fast. F's card calls itself 'the fastest', while A is timed at 'forty minutes' on a lane with engines coming down. I ranked them as a near tie.
- Scenario 3, F's card says it leaves fewer alive at year end 'than under any other rule here'. I used that to put F below A and C on gain and helped, even though A may leave doses unused.

## Performance rater - `unclear` (copied as is)

- Scenario 1, F (Drive out on the industrial service road), durability: the card says 'the streets behind you follow' (a way out that stays open) but also that the road 'takes everyone else past the leak'. The two point in opposite directions.
- Scenario 1, D (Drive the community shuttle), resources: it uses the only shuttle, but mostly to carry other people. It is unclear whether that counts as using the supply or leaving it for others.
- Scenario 2, A (Take the closed ridge road), reversibility: the card does not say whether your own car could turn back on the ridge road. 'time nobody can give back' refers to the crews.
- Scenario 2, C (Take your household to the concrete school), resources: 'a crew comes back into the valley' could mean crew time spent because of you, or a sweep that happens anyway.
- Scenario 3, all options, reversibility: once given, every dose is final. I separated the options mainly by whether the patients deferred can still be treated next month, and by C's held block.

## Performance rater - `comments` (copied as is)

- Scenario 1's speed and reliability measures ask about getting 'out', but A does not travel at all. I rated it by time spent inside the plume.
- Scenario 3's speed and resources cards say little about the time or staff cost of each selection method. I inferred it from how complex the method is (a draw, a register, a sort, a score, a model).
- Scenario 4, resources: none of the cards gives a budget figure except F ('strongest financial position') and A (300 driving hours saved), so the order below the top two is partly inferred.
