"use client";

import {
  isCondGroup,
  type CondGroup,
  type OmittableSection,
  type Problem,
  type QueryState,
  type Section as SectionName,
} from "@/lib/sql/query-state";
import { CondGroupEditor } from "./cond-group";
import { Dictionary } from "./dictionary";
import { FromClause, JoinsClause } from "./from-joins";
import { GroupByClause, HavingClause } from "./group-having";
import { LimitClause, OrderByClause } from "./order-limit";
import { Section } from "./section";
import { SelectClause } from "./select-list";

const countOff = (items: { off?: boolean }[]) => items.filter((item) => item.off).length;

function countGroupOff(group: CondGroup): number {
  return group.items.reduce((sum, item) => sum + (item.off ? 1 : isCondGroup(item) ? countGroupOff(item) : 0), 0);
}

type Props = {
  state: QueryState;
  problems: Problem[];
  onChange: (state: QueryState) => void;
};

export function Builder({ state, problems, onChange }: Props) {
  const patch = (next: Partial<QueryState>) => onChange({ ...state, ...next });
  const of = (section: SectionName) => problems.filter((problem) => problem.section === section);
  // Props do checkbox "omitir" no cabeçalho do bloco.
  const omit = (section: OmittableSection) => {
    const current = state.omit ?? [];
    return {
      omitted: current.includes(section),
      onToggleOmit: () =>
        patch({ omit: current.includes(section) ? current.filter((item) => item !== section) : [...current, section] }),
    };
  };

  return (
    <Dictionary state={state}>
    <div className="flex flex-col gap-2">
      <Section title="FROM" problems={of("from")}>
        <FromClause state={state} onChange={patch} />
      </Section>
      <Section title={`JOINS (${state.joins.length})`} problems={of("joins")} off={countOff(state.joins)} {...omit("joins")}>
        <JoinsClause state={state} onChange={patch} />
      </Section>
      <Section title="SELECT" problems={of("select")} off={countOff(state.select)} {...omit("select")}>
        <SelectClause state={state} onChange={patch} />
      </Section>
      <Section title="WHERE" problems={of("where")} off={countGroupOff(state.where)} {...omit("where")}>
        <CondGroupEditor group={state.where} onChange={(where) => patch({ where })} />
      </Section>
      <Section title="GROUP BY" problems={of("groupBy")} {...omit("groupBy")}>
        <GroupByClause state={state} onChange={patch} />
      </Section>
      <Section title="HAVING" problems={of("having")} off={countGroupOff(state.having)} {...omit("having")}>
        <HavingClause state={state} onChange={patch} />
      </Section>
      <Section title="ORDER BY" problems={of("orderBy")} off={countOff(state.orderBy)} {...omit("orderBy")}>
        <OrderByClause state={state} onChange={patch} />
      </Section>
      <Section title="LIMITE" problems={of("limit")} {...omit("limit")}>
        <LimitClause state={state} onChange={patch} />
      </Section>
    </div>
    </Dictionary>
  );
}
