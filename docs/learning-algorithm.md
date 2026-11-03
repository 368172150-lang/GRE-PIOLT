# Learning algorithms

Phase 2 implements daily planning/calendar utilities. Phase 3 implements a tested SM-2 vocabulary variant. Phase 4 adds exact practice grading; Phase 5 implements real-record analytics and rule-based next-session recommendations.

## Phase 2 rules

1. Use the configured IANA timezone to derive an ISO calendar date. The cloud clock is read after obtaining the user's settings row lock; local mode reads its browser clock inside a Web Lock. Each mutation carries an expected date and fails if the date changed.
2. Allocate at most 35% of the budget to due reviews, at 0.5 minutes per word. This is capped by the actual due count; no due records means no fabricated review task.
3. Allocate up to 30% of the budget to new words, at 1 minute each, capped by the user's configured new-word goal.
4. Reserve 3 minutes for one mistake/reflection task. Distribute the remaining budget 60/40 toward the weaker Verbal/Quant module, with 3 minutes per Verbal question and 2 per Quant question. With fewer than three answers for a module, use the default Verbal-first allocation. Tie-breaking is deterministic.
5. Recent means the last 30 days of stored attempts. Weak question type requires at least three attempts per type; sort by error rate, then sample count, then question-type name. Manual task toggles do not create attempts or mastery.
6. Add an automatic overall time target matching the daily budget. It contributes zero additional estimated minutes: it measures total time, rather than adding another study block. It completes only when saved time reaches the target.
7. Today's plan remains stable unless the user explicitly replans before check-in. Keep manually completed tasks only if their new target does not increase; recompute the time target from saved time. Checked-in plans are immutable.

Pure modules: dates.ts, planner.ts and study.ts. SQL: study_plan_spec and study_action in migration 002. Integer-ratio arithmetic avoids JavaScript floating-point floors diverging from PostgreSQL numeric arithmetic. Integration tests compare 18 planner combinations.

Streaks are consecutive unique calendar dates, not 24-hour intervals. Today's streak may continue from yesterday until today's deadline; gaps reset the current streak. Stored local dates are never reinterpreted after timezone changes. Travel can skip dates; returning to an existing date reuses its plan/check-in. No historical backfill is accepted.

The tests cover local midnight, DST repeated/skipped hours, leap/year boundaries, duplicates, no data, ownership, caps and stale actions. See phase2-verification.md for actual execution limits.

The planner uses heuristic costs rather than measured individual pace, and low sample counts can make weakness estimates noisy. It currently chooses a module based on error rate and shows a weak type; it does not claim machine learning, predicted GRE scores or an optimized curriculum. Large histories will need paginated queries and server aggregates. Missing future learning modules produce truthful empty signals, while offline study remains manually trackable.

## Phase 3 SM-2 variant

The pure scheduleReview function starts EF at 2.5. Successful intervals are 1 day, then 6 days, then ceil(previous interval × previous EF), bounded to 1–365 days. The updated EF is max(1.3, round(previous EF + 0.1 − (5 − q) × (0.08 + (5 − q) × 0.02), 2)). Integer hundredths avoid binary floating-point ceilings diverging from PostgreSQL numeric arithmetic.

Failed recall (q < 3) resets the consecutive-success count, increments lapses and schedules the next calendar day. This variant does not implement minute-scale same-session relearning. Card ratings map to 0/3/4/5; quizzes map to 4 for correct and 1 for incorrect. Mastered requires at least three consecutive successes and a gap of at least 15 days; it is an application state, not a GRE score claim.

Only first learning, due review or a failed answer changes the schedule. Correct premature practice is logged as extra without advancing it. Repeated request IDs do not create new events; a stale progress revision is rejected. The queue sorts by due date and stable word order, then fills the remaining frozen daily new-word allowance. It never randomizes away due items.

Due dates use calendar arithmetic in the configured timezone. UTC due_at remains for compatibility but local due_date drives Phase 3 review selection. Favorite-only rows remain new and never inflate mastered/due counts. A word counts once toward a daily new/review task, even if practiced repeatedly. Learning words never fabricates time entries.

The SQL and TypeScript implementations match across 360 combinations, including all qualities, lapse/floor/cap cases and a ceiling-sensitive 25 × 2.2 product. Choice distractors avoid shared Chinese glosses, explicit synonyms and overlapping tags. This improves ambiguity control but is not a substitute for editorial review of a larger vocabulary bank.

Reference: [SuperMemo's algorithm history](https://www-beta.supermemo.com/en/articles/history). Code, source content and product adaptations are independently authored. [Phase 3 guide](phase3-guide.md) explains the limits and manual checks.

Phase 5: use recent accuracy, mistake frequency, difficulty and review load to create explainable rule-based recommendations. Treat sparse history as unknown rather than a zero score. Thresholds, cold-start limitations and sample-size bias are documented in the Phase 5 and release guides.


## Phase 4 update

Practice grading compares unordered exact choice sets, ordered blank groups and exact rational values. Timed deadlines persist; retries use request UUIDs and revision checks. Different questions attempted today complete daily Verbal/Quant tasks; reviewed mistakes complete reflection tasks. Accuracy and weak types derive from actual recent attempts; wall-clock question duration does not create focus minutes.

See [Phase 4 guide](phase4-guide.md), [verification](phase4-verification.md) and [content review](content-review.md).


## Phase 5 update

Phase 5 analytical aggregation retains stored study dates and uses inclusive calendar ranges ending today. Practice accuracy excludes missing days, does not combine time logs with question elapsed time, and includes repeat answers with sample sizes. Current vocabulary distribution is independent of the selected historical range. Recommendation priorities, sample thresholds, difficulty and budget allocation are documented in phase5-guide.md; recommendations never create progress or overwrite daily plans.

See [Phase 5 guide](phase5-guide.md) and [verification](phase5-verification.md).
