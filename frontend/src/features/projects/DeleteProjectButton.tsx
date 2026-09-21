"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { t } from "@/i18n";
import { ServiceError } from "@/services/types";
import { Button } from "@/ui/Button";
import { useToast } from "@/ui/Toast";
import { useDeleteProject } from "../data/hooks";
import { ConfirmDialog } from "../shared/ConfirmDialog";

/** FR-413: a confirmation, and a plain explanation with a link when the project still has tasks. */
export function DeleteProjectButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<"none" | "notEmpty" | "failed">("none");
  const remove = useDeleteProject();
  const router = useRouter();
  const toast = useToast();

  const confirm = () => {
    setProblem("none");
    remove.mutate(id, {
      onSuccess: () => {
        setOpen(false);
        toast.notify("success", t("project.deleted"));
        router.push("/projects");
      },
      onError: (error) =>
        setProblem(
          error instanceof ServiceError && error.code === "PROJECT_NOT_EMPTY"
            ? "notEmpty"
            : "failed",
        ),
    });
  };
  return (
    <>
      <Button
        onClick={() => {
          setProblem("none");
          setOpen(true);
        }}
      >
        {t("project.delete")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("project.delete.title")}
        body={t("project.delete.body", { name })}
        confirmLabel={t("project.delete")}
        busy={remove.isPending}
        onConfirm={confirm}
        problem={
          problem === "notEmpty" ? (
            <>
              <p>{t("project.delete.notEmpty")}</p>
              <Link href={`/tasks?project=${id}`} className="text-accent-fg underline">
                {t("project.delete.viewTasks")}
              </Link>
            </>
          ) : problem === "failed" ? (
            t("project.delete.failed")
          ) : undefined
        }
      />
    </>
  );
}
