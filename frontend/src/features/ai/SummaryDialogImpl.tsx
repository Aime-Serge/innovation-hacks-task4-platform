"use client";

import { useCallback } from "react";
import { t } from "@/i18n";
import { useServices } from "@/providers/ServicesProvider";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Spinner } from "@/ui/Spinner";
import { AiLabel, PrivacyNotice } from "./AiNotices";
import { usePrivacyAck } from "./useAi";
import { useAiRun } from "./useAiRun";

export type Props = { open: boolean; onOpenChange: (open: boolean) => void; projectId: string };

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{t("ai.sum.none")}</p>
      ) : (
        <ul className="list-disc pl-5 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** FR-426: a short summary, up to five risks and five next steps, all shown as plain text. */
export default function SummaryDialogImpl({ open, onOpenChange, projectId }: Props) {
  const { ai } = useServices();
  const [acked, ack] = usePrivacyAck();
  const start = useCallback(
    (signal: AbortSignal) => ai.summarize(projectId, signal),
    [ai, projectId],
  );
  const { run, retry } = useAiRun(start, acked);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("ai.sum.title")}>
      {!acked ? (
        <PrivacyNotice onAccept={ack} />
      ) : (
        <div className="flex flex-col gap-3" aria-busy={run.phase === "loading"}>
          <p role="status" aria-live="polite" className="text-sm">
            {run.phase === "loading" ? t("ai.sum.loading") : run.message}
          </p>
          {run.phase === "loading" && <Spinner />}
          {run.phase === "error" && <Button onClick={retry}>{t("common.retry")}</Button>}
          {run.phase === "done" && (
            <>
              <AiLabel />
              <p>{run.data.summary}</p>
              <Bullets title={t("ai.sum.risks")} items={run.data.risks} />
              <Bullets title={t("ai.sum.next")} items={run.data.nextSteps} />
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
