// The Step tab: after each step, what changed and which rules looked at it
// (docs/design/story-tooling.md §D1). Facts and quests are the panel's own two views; the rules are
// the explainer's report (POST /why), asked as the step arrives rather than on request.
import { useEffect, useRef, useState } from 'react';
import { ask } from './author.ts';
import type { Heard, State } from './book.ts';
import { Heading } from './sections.tsx';
import { changedFacts, changedQuests, looked, pairViews, type Paired, type Report } from './step.ts';
import { Facts, Quests, Rules } from './steprows.tsx';

const BUDGET = 400; // steps: past this the replay's cost is the story, so the notice replaces the answer
const SLOW_MS = 2000; // a report slower than this is printed as slow; it is not hidden

type Told = { at: string; told?: Report; ms?: number; error?: string };

/** The report for one step, asked once as the step arrives. */
function useStepReport(state: State | undefined, at: string, trace: () => Promise<string[]>) {
  const [report, setReport] = useState<Told>();
  const ordinal = state?.steps.length ?? 0;
  useEffect(() => {
    if (!state || ordinal === 0 || ordinal > BUDGET) return;
    let live = true;
    const began = performance.now();
    void trace()
      .then((rows) => ask('why', { trace: rows }))
      .then(
        (r) =>
          live &&
          setReport(
            r.ok
              ? { at, told: r.told as Report, ms: Math.round(performance.now() - began) }
              : { at, error: String(r.told) },
          ),
        (err: Error) => live && setReport({ at, error: err.message }),
      );
    return () => void (live = false);
  }, [at, ordinal]); // eslint-disable-line react-hooks/exhaustive-deps
  return report?.at === at ? report : undefined;
}

/** The two views D1 compares: the `state` the Book posted before the step and the one after. */
function useViews(state: State | undefined, at: string) {
  const seen = useRef<Paired>({});
  if (state) seen.current = pairViews(seen.current, at, { facts: state.facts, quests: state.shown.quests });
  return seen.current;
}

type Props = { state?: State | undefined; trace: () => Promise<string[]>; heard?: Heard | undefined };

/** What the last step changed, and every rule whose trigger matched it. */
export function Step({ state, trace, heard }: Props) {
  const ordinal = state?.steps.length ?? 0;
  const at = `${state?.hash}:${ordinal}`;
  const told = useStepReport(state, at, trace);
  const views = useViews(state, at);

  if (!ordinal) return <p className="text-sm text-muted-foreground">Take a step in the Book first.</p>;
  if (ordinal > BUDGET)
    return (
      <p className="text-sm text-muted-foreground">
        Why is off past {BUDGET} steps; jump to a checkpoint. The replay re-runs the whole path each step.
      </p>
    );
  return (
    <div className="space-y-3 text-sm">
      <Head told={told} ordinal={ordinal} />
      <Facts facts={changedFacts(views.before, views.after)} />
      <Quests quests={changedQuests(views.before, views.after)} />
      <Rules report={looked(told?.told)} heard={heard} />
    </div>
  );
}

const Head = ({ told, ordinal }: { told?: Told; ordinal: number }) => (
  <div>
    <Heading>
      Step {ordinal}
      {told?.told ? ` · ${told.told.command} ${told.told.outcome}` : ''}
    </Heading>
    {told?.error ? <p className="text-destructive">{told.error}</p> : null}
    {told?.ms !== undefined ? (
      <p className="font-mono text-xs text-muted-foreground">
        asked in {told.ms} ms{told.ms > SLOW_MS ? ' (slow)' : ''}
      </p>
    ) : null}
  </div>
);
