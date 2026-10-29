"use client";

import type { Problem, QueryState, Section as SectionName } from "@/lib/sql/query-state";
import { CondGroupEditor } from "./cond-group";
import { FromClause, JoinsClause } from "./from-joins";
import { GroupByClause, HavingClause } from "./group-having";
import { LimitClause, OrderByClause } from "./order-limit";
import { Section } from "./section";
import { SelectClause } from "./select-list";

type Props = {
  state: QueryState;
  problems: Problem[];
  onChange: (state: QueryState) => void;
};

export function Builder({ state, problems, onChange }: Props) {
  const patch = (next: Partial<QueryState>) => onChange({ ...state, ...next });
  const of = (section: SectionName) => problems.filter((problem) => problem.section === section);

  return (
    <div className="flex flex-col gap-2">
      <Section title="FROM" problems={of("from")}>
        <FromClause state={state} onChange={patch} />
      </Section>
      <Section title={`JOINS (${state.joins.length})`} problems={of("joins")}>
        <JoinsClause state={state} onChange={patch} />
      </Section>
      <Section title="SELECT" problems={of("select")}>
        <SelectClause state={state} onChange={patch} />
      </Section>
      <Section title="WHERE" problems={of("where")}>
        <CondGroupEditor group={state.where} onChange={(where) => patch({ where })} />
      </Section>
      <Section title="GROUP BY" problems={of("groupBy")}>
        <GroupByClause state={state} onChange={patch} />
      </Section>
      <Section title="HAVING" problems={of("having")}>
        <HavingClause state={state} onChange={patch} />
      </Section>
      <Section title="ORDER BY" problems={of("orderBy")}>
        <OrderByClause state={state} onChange={patch} />
      </Section>
      <Section title="LIMITE" problems={of("limit")}>
        <LimitClause state={state} onChange={patch} />
      </Section>
    </div>
  );
}
