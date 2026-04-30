import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { SignupBody, LoginBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword, signToken } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function publicUser(u: { id: number; name: string; email: string; role: string }) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as "admin" | "member",
  };
}

router.post("/signup", async (req, res) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid signup data", details: parsed.error.issues });
    return;
  }
  const { name, email, password, role } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const userRole = role === "admin" ? "admin" : "member";
  const [created] = await db
    .insert(usersTable)
    .values({ name, email: normalizedEmail, passwordHash, role: userRole })
    .returning();

  const user = publicUser(created);
  const token = signToken({ userId: user.id, role: user.role });
  res.json({ token, user });
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid login data", details: parsed.error.issues });
    return;
  }
  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const [found] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (!found) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const ok = await verifyPassword(password, found.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const user = publicUser(found);
  const token = signToken({ userId: user.id, role: user.role });
  res.json({ token, user });
});

router.get("/me", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const [found] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!found) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(publicUser(found));
});

export default router;
