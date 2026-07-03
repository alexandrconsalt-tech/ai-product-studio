"use client";

import * as React from "react";
import { Archive, Copy, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Card, Dialog, EmptyState, IconButton, Input, Page, Search, Section, Status } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { useProjectStore } from "@/shared/stores/project-store";
import type { Project } from "@/entities/Project/model/types";

type ProjectDialogState =
  | Readonly<{ type: "create" }>
  | Readonly<{ type: "rename"; project: Project }>
  | Readonly<{ type: "delete"; project: Project }>
  | Readonly<{ type: "duplicate"; project: Project }>
  | null;

export function ProjectsScreen() {
  const router = useRouter();
  const { snapshot, selectedProjectId, selectProject } = useRepositoryStore();
  const { createProject, updateProjectDetails, deleteProject, duplicateProject } = useProjectStore();
  const [query, setQuery] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dialog, setDialog] = React.useState<ProjectDialogState>(null);
  const projects = snapshot?.projects ?? [];
  const filtered = projects.filter((project) => `${project.name} ${project.description ?? ""} ${project.status}`.toLowerCase().includes(query.toLowerCase()));

  React.useEffect(() => {
    if (dialog?.type === "rename" || dialog?.type === "duplicate") {
      setName(dialog.type === "rename" ? dialog.project.name : `${dialog.project.name} Copy`);
      setDescription(dialog.project.description ?? "");
    }
    if (dialog?.type === "create") {
      setName("");
      setDescription("");
    }
  }, [dialog]);

  const handleCreate = (): void => {
    if (!name.trim()) return;
    const project = createProject(name.trim(), description.trim() || undefined);
    setName("");
    setDescription("");
    setDialog(null);
    router.push("/?view=product");
  };

  const handleRename = (): void => {
    if (dialog?.type !== "rename" || !name.trim()) return;
    updateProjectDetails(dialog.project.id, { name: name.trim(), description: description.trim() || undefined });
    setDialog(null);
  };

  const handleDuplicate = (): void => {
    if (dialog?.type !== "duplicate") return;
    const duplicate = duplicateProject(dialog.project.id, { name: name.trim() || undefined, description: description.trim() || undefined });
    setDialog(null);
    if (duplicate) {
      router.push("/?view=product");
    }
  };

  const handleDelete = (): void => {
    if (dialog?.type !== "delete") return;
    deleteProject(dialog.project.id);
    setDialog(null);
  };

  const openProject = (projectId: string): void => {
    selectProject(projectId);
    router.push("/?view=product");
  };

  return (
    <Page>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-text-muted">Создайте проект или откройте Demo Project для полного MVP-сценария.</p>
        </div>
        <div className="flex items-center gap-2">
          <Status tone="info">{projects.length} projects</Status>
          <Button variant="primary" onClick={() => setDialog({ type: "create" })}>
            <Plus className="size-4" aria-hidden="true" />
            Создать
          </Button>
        </div>
      </div>

      <Section>
        <Search value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск projects" aria-label="Поиск projects" />
        {filtered.length === 0 ? (
          <EmptyState>Projects не найдены.</EmptyState>
        ) : (
          <div className="grid gap-3">
            {filtered.map((project) => (
              <Card key={project.id} className={selectedProjectId === project.id ? "border-focus" : undefined}>
                <div className="flex items-center justify-between gap-4">
                  <button type="button" className="min-w-0 text-left" onClick={() => openProject(project.id)}>
                    <p className="truncate text-sm font-medium">{project.name}</p>
                    <p className="truncate text-sm text-text-muted">{project.description}</p>
                  </button>
                  <div className="flex items-center gap-2">
                    <Status tone={project.status === "testing" ? "success" : "neutral"}>{project.status}</Status>
                    <Button variant="secondary" onClick={() => openProject(project.id)}>
                      <FolderOpen className="size-4" aria-hidden="true" />
                      Запустить
                    </Button>
                    <IconButton aria-label="Переименовать проект" variant="ghost" onClick={() => setDialog({ type: "rename", project })}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton aria-label="Дублировать проект" variant="ghost" onClick={() => setDialog({ type: "duplicate", project })}>
                      <Copy className="size-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton aria-label="Удалить проект" variant="ghost" onClick={() => setDialog({ type: "delete", project })}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </IconButton>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {dialog ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
          <Dialog className="w-full max-w-lg">
            {dialog.type === "delete" ? (
              <div className="grid gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Удалить Project</h2>
                  <p className="text-sm text-text-muted">Project «{dialog.project.name}» и связанные Product, Architecture и Pipeline будут удалены из Local Repository.</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button onClick={() => setDialog(null)}>Отмена</Button>
                  <Button variant="danger" onClick={handleDelete}>
                    <Archive className="size-4" aria-hidden="true" />
                    Удалить
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{dialog.type === "create" ? "Создать Project" : dialog.type === "rename" ? "Переименовать Project" : "Дублировать Project"}</h2>
                  <p className="text-sm text-text-muted">Название обязательно. Описание используется как начальная idea для нового Project.</p>
                </div>
                <label className="grid gap-1 text-sm">
                  Name
                  <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
                </label>
                <label className="grid gap-1 text-sm">
                  Description
                  <Input value={description} onChange={(event) => setDescription(event.target.value)} />
                </label>
                <div className="flex justify-end gap-2">
                  <Button onClick={() => setDialog(null)}>Отмена</Button>
                  <Button variant="primary" disabled={!name.trim()} onClick={dialog.type === "create" ? handleCreate : dialog.type === "rename" ? handleRename : handleDuplicate}>
                    {dialog.type === "create" ? "Создать" : dialog.type === "rename" ? "Сохранить" : "Дублировать"}
                  </Button>
                </div>
              </div>
            )}
          </Dialog>
        </div>
      ) : null}
    </Page>
  );
}
