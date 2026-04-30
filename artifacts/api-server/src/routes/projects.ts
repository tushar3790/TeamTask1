import { Router, type IRouter } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  projectsTable,
  projectMembersTable,
  tasksTable,
  usersTable,
} from "@workspace/db";
import {
  CreateProjectBody,
  UpdateProjectBody,
  GetProjectParams,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { publicUser } from "../lib/serializers";

const router: IRouter = Router();

async function loadProjectFull(projectId: number) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  if (!project) return null;

  const memberRows = await db
    .select({
      userId: projectMembersTable.userId,
      user: usersTable,
    })
    .from(projectMembersTable)
    .leftJoin(usersTable, eq(usersTable.id, projectMembersTable.userId))
    .where(eq(projectMembersTable.projectId, projectId));

  const members = memberRows
    .filter((r) => r.user !== null)
    .map((r) => publicUser(r.user!));
  const memberIds = memberRows.map((r) => r.userId);

  const [{ taskCount, completedCount }] = await db
    .select({
      taskCount: sql<number>`count(*)::int`,
      completedCount: sql<number>`sum(case when ${tasksTable.status} = 'completed' then 1 else 0 end)::int`,
    })
    .from(tasksTable)
    .where(eq(tasksTable.projectId, projectId));

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt.toISOString(),
    ownerId: project.ownerId,
    memberIds,
    members,
    taskCount: taskCount ?? 0,
    completedCount: completedCount ?? 0,
  };
}

router.get("/", requireAuth, async (req, res) => {
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

  const projectsList =
    visibleProjectIds === null
      ? await db.select().from(projectsTable)
      : await db
          .select()
          .from(projectsTable)
          .where(inArray(projectsTable.id, visibleProjectIds));

  const result = await Promise.all(projectsList.map((p) => loadProjectFull(p.id)));
  res.json(result.filter(Boolean));
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid project data", details: parsed.error.issues });
    return;
  }
  const { name, description, memberIds } = parsed.data;
  const ownerId = req.auth!.userId;

  const [created] = await db
    .insert(projectsTable)
    .values({ name, description, ownerId })
    .returning();

  const uniqueMemberIds = Array.from(new Set([ownerId, ...memberIds]));
  if (uniqueMemberIds.length > 0) {
    await db
      .insert(projectMembersTable)
      .values(uniqueMemberIds.map((userId) => ({ projectId: created.id, userId })));
  }

  const full = await loadProjectFull(created.id);
  res.json(full);
});

router.get("/:projectId", requireAuth, async (req, res) => {
  const parsed = GetProjectParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }
  const { projectId } = parsed.data;
  const userId = req.auth!.userId;
  const role = req.auth!.role;

  if (role !== "admin") {
    const [member] = await db
      .select()
      .from(projectMembersTable)
      .where(
        and(
          eq(projectMembersTable.projectId, projectId),
          eq(projectMembersTable.userId, userId),
        ),
      )
      .limit(1);
    if (!member) {
      res.status(403).json({ error: "You do not have access to this project" });
      return;
    }
  }

  const full = await loadProjectFull(projectId);
  if (!full) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(full);
});

router.patch("/:projectId", requireAuth, requireAdmin, async (req, res) => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }
  const body = UpdateProjectBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid update data", details: body.error.issues });
    return;
  }
  const { projectId } = params.data;
  const updates: Record<string, unknown> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.description !== undefined) updates.description = body.data.description;

  if (Object.keys(updates).length > 0) {
    await db.update(projectsTable).set(updates).where(eq(projectsTable.id, projectId));
  }

  if (body.data.memberIds !== undefined) {
    await db.delete(projectMembersTable).where(eq(projectMembersTable.projectId, projectId));
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .limit(1);
    const ids = Array.from(new Set([...(project ? [project.ownerId] : []), ...body.data.memberIds]));
    if (ids.length > 0) {
      await db
        .insert(projectMembersTable)
        .values(ids.map((userId) => ({ projectId, userId })));
    }
  }

  const full = await loadProjectFull(projectId);
  if (!full) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(full);
});

router.delete("/:projectId", requireAuth, requireAdmin, async (req, res) => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }
  await db.delete(projectsTable).where(eq(projectsTable.id, params.data.projectId));
  res.json({ success: true });
});

export default router;
export { loadProjectFull };
