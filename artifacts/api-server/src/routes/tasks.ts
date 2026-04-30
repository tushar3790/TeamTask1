import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  projectsTable,
  projectMembersTable,
  tasksTable,
  usersTable,
} from "@workspace/db";
import {
  CreateTaskBody,
  CreateTaskParams,
  UpdateTaskBody,
  UpdateTaskParams,
  ListProjectTasksParams,
  DeleteTaskParams,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { publicUser } from "../lib/serializers";

const router: IRouter = Router();

type TaskRow = typeof tasksTable.$inferSelect;
type UserRow = typeof usersTable.$inferSelect;

function serializeTask(
  task: TaskRow,
  projectName: string,
  assignee: UserRow | null,
) {
  return {
    id: task.id,
    projectId: task.projectId,
    projectName,
    title: task.title,
    description: task.description,
    status: task.status as "pending" | "in_progress" | "completed",
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    assigneeId: task.assigneeId ?? null,
    assignee: assignee ? publicUser(assignee) : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

async function userCanAccessProject(userId: number, role: string, projectId: number) {
  if (role === "admin") return true;
  const [m] = await db
    .select()
    .from(projectMembersTable)
    .where(
      and(
        eq(projectMembersTable.projectId, projectId),
        eq(projectMembersTable.userId, userId),
      ),
    )
    .limit(1);
  return !!m;
}

router.get("/projects/:projectId/tasks", requireAuth, async (req, res) => {
  const params = ListProjectTasksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }
  const { projectId } = params.data;
  const userId = req.auth!.userId;
  const role = req.auth!.role;

  const allowed = await userCanAccessProject(userId, role, projectId);
  if (!allowed) {
    res.status(403).json({ error: "You do not have access to this project" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const rows = await db
    .select({ task: tasksTable, assignee: usersTable })
    .from(tasksTable)
    .leftJoin(usersTable, eq(usersTable.id, tasksTable.assigneeId))
    .where(eq(tasksTable.projectId, projectId))
    .orderBy(desc(tasksTable.createdAt));

  res.json(rows.map((r) => serializeTask(r.task, project.name, r.assignee)));
});

router.post(
  "/projects/:projectId/tasks",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const params = CreateTaskParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    const body = CreateTaskBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid task data", details: body.error.issues });
      return;
    }
    const { projectId } = params.data;
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .limit(1);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const dueDate = body.data.dueDate ? new Date(body.data.dueDate) : null;

    const [created] = await db
      .insert(tasksTable)
      .values({
        projectId,
        title: body.data.title,
        description: body.data.description,
        status: body.data.status ?? "pending",
        dueDate,
        assigneeId: body.data.assigneeId ?? null,
      })
      .returning();

    let assignee: UserRow | null = null;
    if (created.assigneeId) {
      const [u] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, created.assigneeId))
        .limit(1);
      assignee = u ?? null;
    }

    res.json(serializeTask(created, project.name, assignee));
  },
);

router.patch("/tasks/:taskId", requireAuth, async (req, res) => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }
  const body = UpdateTaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid task data", details: body.error.issues });
    return;
  }
  const { taskId } = params.data;
  const userId = req.auth!.userId;
  const role = req.auth!.role;

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (role !== "admin") {
    if (task.assigneeId !== userId) {
      res.status(403).json({ error: "You can only update your own tasks" });
      return;
    }
    const provided = Object.keys(body.data);
    const onlyStatus = provided.length > 0 && provided.every((k) => k === "status");
    if (!onlyStatus) {
      res.status(403).json({ error: "Members can only update task status" });
      return;
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.data.title !== undefined) updates.title = body.data.title;
  if (body.data.description !== undefined) updates.description = body.data.description;
  if (body.data.status !== undefined) updates.status = body.data.status;
  if (body.data.dueDate !== undefined) {
    updates.dueDate = body.data.dueDate ? new Date(body.data.dueDate) : null;
  }
  if (body.data.assigneeId !== undefined) updates.assigneeId = body.data.assigneeId;

  const [updated] = await db
    .update(tasksTable)
    .set(updates)
    .where(eq(tasksTable.id, taskId))
    .returning();

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, updated.projectId))
    .limit(1);

  let assignee: UserRow | null = null;
  if (updated.assigneeId) {
    const [u] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, updated.assigneeId))
      .limit(1);
    assignee = u ?? null;
  }

  res.json(serializeTask(updated, project?.name ?? "", assignee));
});

router.delete("/tasks/:taskId", requireAuth, requireAdmin, async (req, res) => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }
  await db.delete(tasksTable).where(eq(tasksTable.id, params.data.taskId));
  res.json({ success: true });
});

router.get("/tasks/me", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const rows = await db
    .select({ task: tasksTable, assignee: usersTable, project: projectsTable })
    .from(tasksTable)
    .leftJoin(usersTable, eq(usersTable.id, tasksTable.assigneeId))
    .leftJoin(projectsTable, eq(projectsTable.id, tasksTable.projectId))
    .where(eq(tasksTable.assigneeId, userId))
    .orderBy(desc(tasksTable.createdAt));
  res.json(
    rows.map((r) => serializeTask(r.task, r.project?.name ?? "", r.assignee)),
  );
});

export default router;
