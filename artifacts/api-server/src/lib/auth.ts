import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET = process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"];

if (!SECRET) {
  throw new Error(
    "JWT_SECRET (or SESSION_SECRET) environment variable is required.",
  );
}

const TOKEN_EXPIRES_IN = "7d";

export interface JwtPayload {
  userId: number;
  role: "admin" | "member";
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET as string, { expiresIn: TOKEN_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, SECRET as string);
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }
  return decoded as JwtPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
