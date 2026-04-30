import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/", requireAuth, async (_req, res) => {
  const all = await db.select().from(usersTable);
  res.json(
    all.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as "admin" | "member",
    })),
  );
});

export default router;
