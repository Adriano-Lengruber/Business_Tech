import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createProjectSchema,
  createProjectTaskSchema,
  logTimeEntrySchema,
  updateProjectTaskStatusSchema,
} from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { ProjectsService } from './projects.service';

@ApiTags('Projetos & Software')
@ApiBearerAuth()
@RequireModule('mod-projects-dev')
@Controller('projects')
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly service: ProjectsService,
  ) {}

  @Get()
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar projetos com saldo de horas retainer' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listProjects(user.organizationId);
  }

  @Post()
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Criar projeto de software/automação/consultoria' })
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.createProject(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Get(':id/tasks')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar tarefas Kanban do projeto' })
  listTasks(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listTasks(user.organizationId, id);
  }

  @Post(':id/tasks')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Criar tarefa no Kanban do projeto' })
  createTask(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = createProjectTaskSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.createTask(user.organizationId, id, parsed.data);
  }

  @Patch('tasks/:taskId/status')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Mover tarefa entre colunas do Kanban' })
  moveTask(
    @Param('taskId') taskId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = updateProjectTaskStatusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.updateTaskStatus(
      user.organizationId,
      taskId,
      parsed.data,
    );
  }

  @Post(':id/time-entries')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Apontar horas no projeto (atualiza saldo retainer)' })
  logTime(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = logTimeEntrySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.logTime(
      user.organizationId,
      id,
      user.userId,
      parsed.data,
    );
  }
}
