'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Clock, Code2, Plus } from 'lucide-react';
import {
  PROJECT_TASK_STATUSES,
  type ProjectTaskStatus,
  type ProjectType,
} from '@al/shared';
import { ErpShell, type ErpSession } from '@/components/erp-shell';
import { apiFetch } from '@/lib/api';

interface ProjectRow {
  id: string;
  code: string;
  title: string;
  projectType: ProjectType;
  retainer: {
    contractedMinutes: number;
    loggedMinutes: number;
    remainingMinutes: number;
    utilizationPercent: number;
    isNearLimit: boolean;
  };
  tasksCount: number;
  doneTasksCount: number;
}

interface TaskRow {
  id: string;
  title: string;
  status: ProjectTaskStatus;
  priority: string;
  estimatedMinutes: number;
}

const COLUMN_LABEL: Record<ProjectTaskStatus, string> = {
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'Em Andamento',
  REVIEW: 'Revisão',
  DONE: 'Concluído',
};

function ProjectsContent({ session }: { session: ErpSession }) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  const [newTitle, setNewTitle] = useState('');
  const [retainerHours, setRetainerHours] = useState('20');
  const [taskTitle, setTaskTitle] = useState('');
  const [logMinutes, setLogMinutes] = useState('60');
  const [logDesc, setLogDesc] = useState('');

  const enabled = session.enabledModules.includes('mod-projects-dev');

  const loadProjects = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token || !enabled) return;
    const rows = await apiFetch<ProjectRow[]>('/projects', { token });
    setProjects(rows);
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }, [enabled, selectedId]);

  const loadTasks = useCallback(async (projectId: string) => {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const rows = await apiFetch<TaskRow[]>(`/projects/${projectId}/tasks`, {
      token,
    });
    setTasks(rows);
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selectedId) void loadTasks(selectedId);
  }, [selectedId, loadTasks]);

  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const created = await apiFetch<ProjectRow>('/projects', {
      method: 'POST',
      token,
      body: JSON.stringify({
        title: newTitle,
        projectType: 'software_dev',
        retainerHoursMonthly: Number(retainerHours) || 0,
      }),
    });
    setNewTitle('');
    setSelectedId(created.id);
    await loadProjects();
  }

  async function handleAddTask(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token || !selectedId || !taskTitle.trim()) return;
    await apiFetch(`/projects/${selectedId}/tasks`, {
      method: 'POST',
      token,
      body: JSON.stringify({ title: taskTitle }),
    });
    setTaskTitle('');
    await Promise.all([loadProjects(), loadTasks(selectedId)]);
  }

  async function handleMoveTask(taskId: string, status: ProjectTaskStatus) {
    const token = window.localStorage.getItem('al_token');
    if (!token || !selectedId) return;
    await apiFetch(`/projects/tasks/${taskId}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
    await Promise.all([loadProjects(), loadTasks(selectedId)]);
  }

  async function handleLogTime(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token || !selectedId) return;
    await apiFetch(`/projects/${selectedId}/time-entries`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        minutes: Number(logMinutes) || 60,
        description: logDesc || 'Desenvolvimento / Consultoria técnica',
      }),
    });
    setLogDesc('');
    await loadProjects();
  }

  if (!enabled) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
        O módulo <strong>Projetos & Software</strong> está desativado.
      </div>
    );
  }

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreateProject}
        className="grid gap-2 rounded-lg border border-border bg-surface p-4 sm:grid-cols-4"
      >
        <input
          required
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Novo projeto (software, automação, consultoria)..."
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          type="number"
          min={0}
          value={retainerHours}
          onChange={(e) => setRetainerHours(e.target.value)}
          placeholder="Horas retainer/mês"
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm font-mono"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
        >
          <Code2 className="h-4 w-4" />
          Criar Projeto
        </button>
      </form>

      {/* Seletor de Projetos + Retainer */}
      <div className="grid gap-3 md:grid-cols-2">
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedId(p.id)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              selectedId === p.id
                ? 'border-accent bg-accent/10'
                : 'border-border bg-surface hover:bg-surface-muted'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-accent">
                {p.code}
              </span>
              <span className="font-mono text-xs text-text-muted">
                {p.doneTasksCount}/{p.tasksCount} tarefas
              </span>
            </div>
            <p className="mt-1 font-semibold">{p.title}</p>
            {p.retainer.contractedMinutes > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between font-mono text-xs text-text-secondary">
                  <span>
                    Horas: {(p.retainer.loggedMinutes / 60).toFixed(1)}h /{' '}
                    {(p.retainer.contractedMinutes / 60).toFixed(1)}h
                  </span>
                  <span
                    className={
                      p.retainer.isNearLimit ? 'font-bold text-warning' : ''
                    }
                  >
                    {p.retainer.utilizationPercent}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded bg-surface-muted">
                  <div
                    className={`h-full ${
                      p.retainer.isNearLimit ? 'bg-warning' : 'bg-accent'
                    }`}
                    style={{
                      width: `${Math.min(100, p.retainer.utilizationPercent)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedProject && (
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <form
              onSubmit={handleAddTask}
              className="flex gap-2 rounded-lg border border-border bg-surface p-3"
            >
              <input
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Nova tarefa no Kanban..."
                className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Tarefa
              </button>
            </form>

            <form
              onSubmit={handleLogTime}
              className="flex gap-2 rounded-lg border border-border bg-surface p-3"
            >
              <input
                type="number"
                min={5}
                value={logMinutes}
                onChange={(e) => setLogMinutes(e.target.value)}
                className="w-20 rounded-md border border-border bg-bg px-2 py-2 text-sm font-mono"
              />
              <input
                required
                value={logDesc}
                onChange={(e) => setLogDesc(e.target.value)}
                placeholder="Apontamento de minutos..."
                className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-surface-muted"
              >
                <Clock className="h-3.5 w-3.5 text-accent" /> Lançar
              </button>
            </form>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {PROJECT_TASK_STATUSES.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col);
              return (
                <div
                  key={col}
                  className="rounded-lg border border-border bg-surface p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-text-muted">
                      {COLUMN_LABEL[col]}
                    </span>
                    <span className="font-mono text-xs text-text-muted">
                      {colTasks.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-md border border-border bg-bg p-3 text-sm space-y-2"
                      >
                        <p className="font-medium">{t.title}</p>
                        <select
                          value={t.status}
                          onChange={(e) =>
                            void handleMoveTask(
                              t.id,
                              e.target.value as ProjectTaskStatus,
                            )
                          }
                          className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-[11px]"
                        >
                          {PROJECT_TASK_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              Mover p/ {COLUMN_LABEL[st]}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <ErpShell
      title="Projetos, Software & Retainer"
      subtitle="Kanban de entregas e controle de horas contratadas"
    >
      {(session) => <ProjectsContent session={session} />}
    </ErpShell>
  );
}
