"use client";

import { ServiceError } from "@/services/types";
import { useState, type SyntheticEvent } from "react";
import { t } from "@/i18n";
import { formText } from "@/lib/form";
import { NewTask, Priority, TaskStatus, type Project, type Task, type User } from "@/schemas";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { FormField } from "@/ui/FormField";
import { Input, Select, Textarea } from "@/ui/Input";
import { useSaveTask } from "../data/hooks";
import { useToast } from "@/ui/Toast";

export type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  projects: readonly Project[];
  users: readonly User[];
  defaultProjectId?: string;
};

type Errors = Partial<Record<"title" | "projectId", string>>;

function TaskForm({ onOpenChange, task, projects, users, defaultProjectId }: Props) {
  const [errors, setErrors] = useState<Errors>({});
  const toast = useToast();
  const save = useSaveTask(() => {
    toast.notify("success", t(task === null ? "task.created" : "task.saved"));
    onOpenChange(false);
  });

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => formText(form, name);
    const parsed = NewTask.safeParse({
      title: text("title").trim(),
      description: text("description").trim(),
      projectId: text("projectId"),
      status: text("status"),
      priority: text("priority"),
      dueDate: text("dueDate") === "" ? null : text("dueDate"),
      assigneeId: text("assigneeId") === "" ? null : text("assigneeId"),
    });
    if (!parsed.success) {
      const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
      setErrors({
        ...(fields.has("title") && { title: t("task.form.titleInvalid") }),
        ...(fields.has("projectId") && { projectId: t("task.form.projectRequired") }),
      });
      return;
    }
    setErrors({});
    save.mutate({ id: task?.id ?? null, input: parsed.data });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormField id="task-title" label={t("task.form.title")} error={errors.title}>
        {(c) => <Input {...c} name="title" defaultValue={task?.title ?? ""} maxLength={120} />}
      </FormField>
      <FormField id="task-description" label={t("task.form.description")}>
        {(c) => (
          <Textarea
            {...c}
            name="description"
            defaultValue={task?.description ?? ""}
            maxLength={1000}
          />
        )}
      </FormField>
      <FormField id="task-project" label={t("task.form.project")} error={errors.projectId}>
        {(c) => (
          <Select {...c} name="projectId" defaultValue={task?.projectId ?? defaultProjectId ?? ""}>
            <option value="">{t("task.form.chooseProject")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id="task-status" label={t("task.form.status")}>
          {(c) => (
            <Select {...c} name="status" defaultValue={task?.status ?? "todo"}>
              {TaskStatus.options.map((v) => (
                <option key={v} value={v}>
                  {t(`taskStatus.${v}`)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField id="task-priority" label={t("task.form.priority")}>
          {(c) => (
            <Select {...c} name="priority" defaultValue={task?.priority ?? "medium"}>
              {Priority.options.map((v) => (
                <option key={v} value={v}>
                  {t(`priority.${v}`)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField id="task-due" label={t("task.form.dueDate")}>
          {(c) => <Input {...c} name="dueDate" type="date" defaultValue={task?.dueDate ?? ""} />}
        </FormField>
        <FormField id="task-assignee" label={t("task.form.assignee")}>
          {(c) => (
            <Select {...c} name="assigneeId" defaultValue={task?.assigneeId ?? ""}>
              <option value="">{t("task.unassigned")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>
      {save.isError && (
        <p role="alert" className="text-sm text-danger">
          {save.error instanceof ServiceError && save.error.code === "PROJECT_CLOSED"
            ? t("task.projectClosed")
            : t("form.saveFailed")}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          {save.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}

export default function TaskFormDialogImpl(props: Props) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t(props.task === null ? "task.form.createTitle" : "task.form.editTitle")}
    >
      {/* Mounted only while open, so every open starts from fresh values. */}
      {props.open && <TaskForm {...props} />}
    </Dialog>
  );
}
