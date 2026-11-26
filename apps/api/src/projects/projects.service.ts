import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  auditLogs,
  desc,
  eq,
  projects,
  projectTasks,
  projectTimeEntries,
  sql,
} from '@al/database';
import {
  calculateRetainerBalance,
  type CreateProjectInput,
  type CreateProjectTaskInput,
  type LogTimeEntryInput,
  type UpdateProjectTaskStatusInput,
} from '@al/shared';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async listProjects(organizationId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const projRows = await tx
        .select()
        .from(projects)
        .orderBy(desc(projects.createdAt));

      const timeRows = await tx.select().from(projectTimeEntries);
      const taskRows = await tx.select().from(projectTasks);

      return projRows.map((p) => {
        const loggedMinutes = timeRows
          .filter((t) => t.projectId === p.id)
          .reduce((acc, t) => acc + t.minutes, 0);
        const tasks = taskRows.filter((t) => t.projectId === p.id);
        return {
          ...p,
          retainer: calculateRetainerBalance(
            p.retainerMinutesMonthly,
            loggedMinutes,
          ),
          tasksCount: tasks.length,
          doneTasksCount: tasks.filter((t) => t.status === 'DONE').length,
        };
      });
    });
  }

  async createProject(
    organizationId: string,
    userId: string,
    input: CreateProjectInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const countRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(projects);
      const nextNum = (countRes[0]?.count ?? 0) + 1;
      const code = `PRJ-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

      const [proj] = await tx
        .insert(projects)
        .values({
          organizationId,
          customerId: input.customerId ?? null,
          code,
          title: input.title.trim(),
          projectType: input.projectType,
          budgetCents: input.budgetCents,
          retainerMinutesMonthly: Math.round(input.retainerHoursMonthly * 60),
          hourlyRateCents: input.hourlyRateCents,
        })
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'project.created',
        entityType: 'project',
        entityId: proj!.id,
      });

      return proj!;
    });
  }

  listTasks(organizationId: string, projectId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx
        .select()
        .from(projectTasks)
        .where(eq(projectTasks.projectId, projectId))
        .orderBy(desc(projectTasks.createdAt)),
    );
  }

  async createTask(
    organizationId: string,
    projectId: string,
    input: CreateProjectTaskInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [proj] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      if (!proj) throw new NotFoundException('Projeto não encontrado.');

      const [task] = await tx
        .insert(projectTasks)
        .values({
          organizationId,
          projectId,
          title: input.title.trim(),
          status: 'BACKLOG',
          priority: input.priority,
          estimatedMinutes: input.estimatedMinutes,
        })
        .returning();
      return task!;
    });
  }

  async updateTaskStatus(
    organizationId: string,
    taskId: string,
    input: UpdateProjectTaskStatusInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [updated] = await tx
        .update(projectTasks)
        .set({ status: input.status })
        .where(eq(projectTasks.id, taskId))
        .returning();
      if (!updated) throw new NotFoundException('Tarefa não encontrada.');
      return updated;
    });
  }

  async logTime(
    organizationId: string,
    projectId: string,
    userId: string,
    input: LogTimeEntryInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [proj] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      if (!proj) throw new NotFoundException('Projeto não encontrado.');

      const [entry] = await tx
        .insert(projectTimeEntries)
        .values({
          organizationId,
          projectId,
          taskId: input.taskId ?? null,
          userId,
          minutes: input.minutes,
          description: input.description.trim(),
          billable: input.billable,
        })
        .returning();

      return entry!;
    });
  }
}
