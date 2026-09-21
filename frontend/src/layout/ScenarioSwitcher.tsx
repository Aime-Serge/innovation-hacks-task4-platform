"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { replaceUrl } from "@/lib/navigation";
import { storeScenario, useScenario } from "@/providers/scenario";
import { t } from "@/i18n";
import { Scenario } from "@/schemas";
import { Select } from "@/ui/Input";

/**
 * FR-22: switch between the nine fixture scenarios. Shown in every build
 * unless NEXT_PUBLIC_SCENARIO_SWITCHER=off (ADR-009: reviewers need it live).
 */
export function ScenarioSwitcher() {
  const current = useScenario();
  const pathname = usePathname();
  const params = useSearchParams();

  if (process.env["NEXT_PUBLIC_SCENARIO_SWITCHER"] === "off") return null;

  const change = (value: string) => {
    const scenario = Scenario.parse(value);
    storeScenario(scenario);
    const next = new URLSearchParams(params.toString());
    next.set("scenario", scenario);
    replaceUrl(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="scenario-switcher" className="sr-only sm:not-sr-only text-xs text-muted">
        {t("layout.scenario")}
      </label>
      <Select
        id="scenario-switcher"
        value={current}
        onChange={(event) => change(event.target.value)}
        className="h-8 text-xs"
      >
        {Scenario.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </div>
  );
}
