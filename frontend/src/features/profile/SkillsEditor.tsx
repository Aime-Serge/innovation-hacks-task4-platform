"use client";

import { useState } from "react";
import { t } from "@/i18n";
import { useReplaceSkills } from "../data/hooks";
import { skillProblem } from "./links-validate";
import { Icon } from "@/ui/Icon";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";

const MESSAGES = {
  empty: "editor.skills.placeholder",
  long: "editor.skills.limit",
  limit: "editor.skills.limit",
  duplicate: "editor.skills.duplicate",
} as const;

/** MF-08, MB-05: at most 10 skills, unique ignoring case, saved as soon as the list changes. */
export function SkillsEditor({ skills }: { skills: string[] }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Mirrors `skills` optimistically so two adds fired before the first PUT /me/skills
  // resolves both build on the list the person just saw, instead of the stale prop
  // (a lost update: add "COBOL", then "Debugging" before the first response lands, would
  // otherwise overwrite the list with only "Debugging"). Reconciled with the prop during
  // render (React's "adjust state when a prop changes" pattern), not in an effect: an effect
  // would commit the stale list for one extra render before catching up.
  const [localSkills, setLocalSkills] = useState(skills);
  const [syncedWith, setSyncedWith] = useState(skills);
  if (skills !== syncedWith) {
    setSyncedWith(skills);
    setLocalSkills(skills);
  }
  const replace = useReplaceSkills();

  const add = () => {
    const problem = skillProblem(draft, localSkills);
    if (problem !== null) {
      setError(t(MESSAGES[problem]));
      return;
    }
    setError(null);
    const next = [...localSkills, draft.trim()];
    setLocalSkills(next);
    replace.mutate(next);
    setDraft("");
  };

  const remove = (skill: string) => {
    const next = localSkills.filter((s) => s !== skill);
    setLocalSkills(next);
    replace.mutate(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-2">
        {localSkills.map((skill) => (
          <li
            key={skill}
            className="flex items-center gap-1 rounded-full border border-line-strong bg-subtle px-3 py-1 text-sm"
          >
            {skill}
            <IconButton
              label={t("editor.skills.remove", { skill })}
              className="size-5"
              onClick={() => remove(skill)}
            >
              <Icon name="x" className="size-3" />
            </IconButton>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <label htmlFor="skill-input" className="sr-only">
          {t("editor.skills")}
        </label>
        <Input
          id="skill-input"
          value={draft}
          maxLength={30}
          placeholder={t("editor.skills.placeholder")}
          invalid={error !== null}
          aria-describedby={error !== null ? "skill-input-error" : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          className="touch-target rounded-md border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-subtle"
        >
          {t("editor.skills.add")}
        </button>
      </div>
      {error !== null && (
        <p id="skill-input-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
