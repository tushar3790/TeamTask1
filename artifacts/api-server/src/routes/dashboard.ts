import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import {
  db,
  projectsTable,
  projectMembersTable,
  tasksTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { publicUser } from "../lib/serializers";

const router: IRouter = Router();

router.get("/summary", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.assigneeId, userId));

  const now = new Date();
  const soon = new Date(now.getTime() + 1000 * 60 * 60 * 48);

  let pending = 0;
  let inProgress = 0;
  let completed = 0;
  let overdue = 0;
  let dueSoon = 0;
  for (const t of tasks) {
    if (t.status === "pending") pending += 1;
    else if (t.status === "in_progress") inProgress += 1;
    else if (t.status === "completed") completed += 1;
    if (t.status !== "completed" && t.dueDate) {
      if (t.dueDate.getTime() < now.getTime()) overdue += 1;
      else if (t.dueDate.getTime() < soon.getTime()) dueSoon += 1;
    }
  }

  const role = req.auth!.role;
  let projectIds: number[] = [];
  if (role === "admin") {
    const all = await db.select({ id: projectsTable.id }).from(projectsTable);
    projectIds = all.map((p) => p.id);
  } else {
    const memberships = await db
      .select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable)
      .where(eq(projectMembersTable.userId, userId));
    projectIds = memberships.map((m) => m.projectId);
  }

  res.json({
    total: tasks.length,
    pending,
    inProgress,
    completed,
    overdue,
    dueSoon,
    projectCount: projectIds.length,
  });
});

router.get("/recent", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const role = req.auth!.role;

  let visibleProjectIds: number[] | null = null;
  if (role !== "admin") {
    const memberships = await db
      .select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable)
      .where(eq(projectMembersTable.userId, userId));
    visibleProjectIds = memberships.map((m) => m.projectId);
    if (visibleProjectIds.length === 0) {
      res.json([]);
      return;
    }
  }

  const baseQuery = db
    .select({ task: tasksTable, assignee: usersTable, project: projectsTable })
    .from(tasksTable)
    .leftJoin(usersTable, eq(usersTable.id, tasksTable.assigneeId))
    .leftJoin(projectsTable, eq(projectsTable.id, tasksTable.projectId))
    .orderBy(desc(tasksTable.updatedAt))
    .limit(15);

  const rows =
    visibleProjectIds === null
      ? await baseQuery
      : await db
          .select({ task: tasksTable, assignee: usersTable, project: projectsTable })
          .from(tasksTable)
          .leftJoin(usersTable, eq(usersTable.id, tasksTable.assigneeId))
          .leftJoin(projectsTable, eq(projectsTable.id, tasksTable.projectId))
          .where(
            or(
              inArray(tasksTable.projectId, visibleProjectIds),
              and(eq(tasksTable.assigneeId, userId)),
            ),
          )
          .orderBy(desc(tasksTable.updatedAt))
          .limit(15);

  res.json(
    rows.map((r) => ({
      id: r.task.id,
      projectId: r.task.projectId,
      projectName: r.project?.name ?? "",
      title: r.task.title,
      description: r.task.description,
      status: r.task.status as "pending" | "in_progress" | "completed",
      dueDate: r.task.dueDate ? r.task.dueDate.toISOString() : null,
      assigneeId: r.task.assigneeId ?? null,
      assignee: r.assignee ? publicUser(r.assignee) : null,
      createdAt: r.task.createdAt.toISOString(),
      updatedAt: r.task.updatedAt.toISOString(),
    })),
  );
});

export default router;
