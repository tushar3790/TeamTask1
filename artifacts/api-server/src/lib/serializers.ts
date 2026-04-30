import type { User } from "@workspace/db";

export type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "member";
};

export function publicUser(u: User): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as "admin" | "member",
  };
}
