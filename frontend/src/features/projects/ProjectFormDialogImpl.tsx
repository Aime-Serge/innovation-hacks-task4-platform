"use client";

import { useState, type SyntheticEvent } from "react";
import { t } from "@/i18n";
import { formText } from "@/lib/form";
import { NewProject, ProjectStatus, type Project } from "@/schemas";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { FormField } from "@/ui/FormField";
import { Input, Select, Textarea } from "@/ui/Input";
import { useToast } from "@/ui/Toast";
import { useSaveProject } from "../data/hooks";

export type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  ownerId: string;
};

type Errors = Partial<Record<"name" | "dueDate", string>>;

function ProjectForm({ onOpenChange, project, ownerId }: Props) {
  const [errors, setErrors] = useState<Errors>({});
  const toast = useToast();
  const save = useSaveProject(() => {
    toast.notify("success", t(project === null ? "project.created" : "project.saved"));
    onOpenChange(false);
  });

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => formText(form, name);
    const parsed = NewProject.safeParse({
      name: text("name").trim(),
      description: text("description").trim(),
      status: text("status"),
      dueDate: text("dueDate"),
      ownerId: project?.ownerId ?? ownerId,
    });
    if (!parsed.success) {
      const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
      setErrors({
        ...(fields.has("name") && { name: t("project.form.nameInvalid") }),
        ...(fields.has("dueDate") && { dueDate: t("project.form.dueRequired") }),
      });
      return;
    }
    setErrors({});
    save.mutate({ id: project?.id ?? null, input: parsed.data });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormField id="project-name" label={t("project.form.name")} error={errors.name}>
        {(c) => <Input {...c} name="name" defaultValue={project?.name ?? ""} maxLength={80} />}
      </FormField>
      <FormField id="project-description" label={t("project.form.description")}>
        {(c) => (
          <Textarea
            {...c}
            name="description"
            defaultValue={project?.description ?? ""}
            maxLength={500}
          />
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id="project-status" label={t("project.form.status")}>
          {(c) => (
            <Select {...c} name="status" defaultValue={project?.status ?? "planned"}>
              {ProjectStatus.options.map((v) => (
                <option key={v} value={v}>
                  {t(`projectStatus.${v}`)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField id="project-due" label={t("project.form.dueDate")} error={errors.dueDate}>
          {(c) => <Input {...c} name="dueDate" type="date" defaultValue={project?.dueDate ?? ""} />}
        </FormField>
      </div>
      {save.isError && (
        <p role="alert" className="text-sm text-danger">
          {t("form.saveFailed")}
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

export default function ProjectFormDialogImpl(props: Props) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t(props.project === null ? "project.form.createTitle" : "project.form.editTitle")}
    >
      {props.open && <ProjectForm {...props} />}
    </Dialog>
  );
}
