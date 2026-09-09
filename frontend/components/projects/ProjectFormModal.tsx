"use client";

import { useState, type FormEvent } from "react";
import { createProject, updateProject } from "@/lib/data";
import type { Project } from "@/lib/types";
import { Modal } from "@/components/shared/Modal";
import { FormField } from "@/components/shared/FormField";

export function ProjectFormModal({
  project,
  onClose,
  onSaved,
}: {
  project?: Project;
  onClose: () => void;
  onSaved: (project: Project) => void;
}) {
  const isEditing = Boolean(project);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const saved =
        isEditing && project
          ? await updateProject(project.id, { name, description: description || null })
          : await createProject({ name, description: description || null });
      onSaved(saved);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isEditing ? "Edit project" : "New project"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="text-sm text-status-blocked">
            {error}
          </p>
        )}
        <FormField id="project-name" label="Name" value={name} onChange={setName} required />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="project-description" className="text-sm font-medium text-text-primary">
            Description
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="rounded border border-border-hairline bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:border-interactive"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded border border-border-hairline px-3 py-1.5 text-sm font-medium text-text-primary hover:border-interactive disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="rounded bg-interactive px-3 py-1.5 text-sm font-medium text-canvas disabled:opacity-60"
          >
            {submitting ? "Saving…" : isEditing ? "Save changes" : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
