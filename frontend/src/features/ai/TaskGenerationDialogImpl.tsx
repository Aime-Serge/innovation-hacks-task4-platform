"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { t, tCount } from "@/i18n";
import { addDays, todayIso } from "@/lib/dates";
import { useServices } from "@/providers/ServicesProvider";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { AiLabel, PrivacyNotice } from "./AiNotices";
import { aiErrorMessage, isAbort } from "./messages";
import { SuggestionRow, titleOk, type Row } from "./SuggestionRow";
import { usePrivacyAck } from "./useAi";

export type Props = { open: boolean; onOpenChange: (open: boolean) => void; projectId: string };
type Phase = "form" | "loading" | "results" | "empty" | "error";

/** FR-422, FR-423: brief, progress with cancel, editable suggestions, and nothing saved until "Add". */
export default function TaskGenerationDialogImpl({ open, onOpenChange, projectId }: Props) {
  const { ai, tasks } = useServices();
  const client = useQueryClient();
  const toast = useToast();
  const [acked, ack] = usePrivacyAck();
  const [brief, setBrief] = useState("");
  const [count, setCount] = useState(5);
  const [phase, setPhase] = useState<Phase>("form");
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const refresh = (...keys: string[]) =>
    keys.forEach((key) => void client.invalidateQueries({ queryKey: [key] }));

  const generate = async () => {
    const abort = new AbortController();
    controller.current = abort;
    setPhase("loading");
    setMessage(t("ai.gen.loading"));
    try {
      const text = brief.trim();
      const result = await ai.suggestTasks(
        projectId,
        { count, ...(text === "" ? {} : { brief: text }) },
        abort.signal,
      );
      refresh("ai");
      if (result.suggestions.length === 0) {
        setPhase("empty");
        setMessage(t("ai.gen.empty"));
        return;
      }
      setRows(result.suggestions.map((s, key) => ({ key, ...s, selected: true })));
      setPhase("results");
      setMessage(tCount("ai.gen.found", result.suggestions.length));
    } catch (error) {
      if (isAbort(error)) {
        setPhase("form");
        setMessage("");
        return;
      }
      setPhase("error");
      setMessage(aiErrorMessage(error));
      refresh("ai");
    }
  };

  const chosen = rows.filter((r) => r.selected);
  const addable = chosen.length > 0 && chosen.every((r) => titleOk(r.title));
  const addSelected = async () => {
    setAdding(true);
    const failed: Row[] = [];
    for (const row of chosen) {
      try {
        await tasks.create({
          projectId,
          title: row.title.trim(),
          description: row.description,
          status: "todo",
          priority: row.priority,
          dueDate: row.dueInDays === null ? null : addDays(todayIso(), row.dueInDays),
          assigneeId: null,
        });
      } catch {
        failed.push(row);
      }
    }
    refresh("tasks", "activity");
    setAdding(false);
    if (failed.length === 0) {
      toast.notify("success", t("ai.gen.added", { count: chosen.length }));
      onOpenChange(false);
      return;
    }
    setRows(failed);
    setMessage(t("ai.gen.addFailed", { count: failed.length }));
  };
  const change = (key: number, patch: Partial<Row>) =>
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("ai.gen.title")}>
      {!acked ? (
        <PrivacyNotice onAccept={ack} />
      ) : (
        <div className="flex flex-col gap-4">
          <p role="status" aria-live="polite" className="text-sm">
            {message}
          </p>
          {(phase === "form" || phase === "error" || phase === "empty") && (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void generate();
              }}
            >
              <FormField id="ai-brief" label={t("ai.gen.brief")}>
                {(c) => (
                  <Input
                    {...c}
                    value={brief}
                    maxLength={1000}
                    onChange={(e) => setBrief(e.target.value)}
                  />
                )}
              </FormField>
              <FormField id="ai-count" label={t("ai.gen.count")}>
                {(c) => (
                  <Input
                    {...c}
                    type="number"
                    min={1}
                    max={10}
                    value={count}
                    onChange={(e) =>
                      setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))
                    }
                  />
                )}
              </FormField>
              <Button type="submit" variant="primary" className="self-start">
                {phase === "form" ? t("ai.gen.run") : t("common.retry")}
              </Button>
            </form>
          )}
          {phase === "loading" && (
            <div className="flex items-center gap-3">
              <Spinner />
              <Button onClick={() => controller.current?.abort()}>{t("ai.gen.cancel")}</Button>
            </div>
          )}
          {phase === "results" && (
            <>
              <AiLabel />
              <ul className="flex flex-col gap-3">
                {rows.map((row) => (
                  <SuggestionRow
                    key={row.key}
                    row={row}
                    onChange={(patch) => change(row.key, patch)}
                  />
                ))}
              </ul>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  disabled={!addable || adding}
                  onClick={() => void addSelected()}
                >
                  {adding ? t("ai.gen.adding") : t("ai.gen.add", { count: chosen.length })}
                </Button>
                <Button onClick={() => setPhase("form")}>{t("ai.gen.again")}</Button>
              </div>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
