"use client";

import { array } from "zod/mini";
import { useMemo } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { Grid } from "@/layout/Grid";
import { PageHeader } from "@/layout/PageHeader";
import { useCreateIntent } from "../shared/useCreateIntent";
import { t, tCount } from "@/i18n";
import { projectProgress } from "@/lib/query-logic";
import { ProjectSort, ProjectStatus } from "@/schemas";
import { Button } from "@/ui/Button";
import { FilterBar } from "@/ui/FilterBar";
import { Icon } from "@/ui/Icon";
import { RegionState } from "@/ui/RegionState";
import { SearchField } from "@/ui/SearchField";
import { Skeleton } from "@/ui/Skeleton";
import { SortMenu } from "@/ui/SortMenu";
import { useAllTasks, useProjects } from "../data/hooks";
import { ProjectCard } from "./ProjectCard";
import { ProjectFormDialog } from "./ProjectFormDialog";
import { useProjectQuery } from "./useProjectQuery";

export function ProjectsView() {
  const { query, update, clear, filtered } = useProjectQuery();
  const [creating, setCreating] = useCreateIntent();
  const { user } = useAuth();
  const projects = useProjects(query);
  const tasks = useAllTasks();
  const allTasks = useMemo(() => tasks.data?.items ?? [], [tasks.data]);

  return (
    <>
      <PageHeader
        title={t("projects.title")}
        description={t("projects.description")}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" />
            {t("project.new")}
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-48 flex-1">
            <SearchField
              id="project-search"
              label={t("projects.search")}
              value={query.q}
              onChange={(q) => update({ q })}
            />
          </div>
          <SortMenu
            options={ProjectSort.options.map((value) => ({
              value,
              label: t(`projectSort.${value}`),
            }))}
            sort={query.sort}
            dir={query.dir}
            onSort={(value) => update({ sort: ProjectSort.parse(value) })}
            onDir={(dir) => update({ dir })}
          />
        </div>
        <FilterBar
          active={filtered}
          onClear={clear}
          groups={[
            {
              id: "pstatus",
              legend: t("filter.status"),
              options: ProjectStatus.options.map((v) => ({
                value: v,
                label: t(`projectStatus.${v}`),
              })),
              selected: query.status,
              onChange: (status) => update({ status: array(ProjectStatus).parse(status) }),
            },
          ]}
        />
      </div>
      <p role="status" aria-live="polite" className="mb-3 text-sm text-muted">
        {projects.data === undefined ? "" : tCount("projects.count", projects.data.total)}
      </p>
      <RegionState
        status={projects.isPending ? "loading" : projects.isError ? "error" : "success"}
        data={projects.data?.items}
        filtered={filtered}
        skeleton={
          <Grid layout="cards">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </Grid>
        }
        empty={{
          title: t("project.empty.title"),
          body: t("project.empty.body"),
          action: (
            <Button variant="primary" onClick={() => setCreating(true)}>
              {t("project.empty.action")}
            </Button>
          ),
        }}
        onRetry={() => void projects.refetch()}
        onClearFilters={clear}
        headingLevel="h2"
      >
        {(items) => (
          <Grid layout="cards">
            {items.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                progress={projectProgress(project.id, allTasks)}
              />
            ))}
          </Grid>
        )}
      </RegionState>
      <ProjectFormDialog
        open={creating}
        onOpenChange={setCreating}
        project={null}
        ownerId={user?.id ?? "user-1"}
      />
    </>
  );
}
