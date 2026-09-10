import { z } from "zod";
import { workspaceRoleEnum, projectRoleEnum } from "@/lib/db/schema";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, "نام workspace الزامی است").max(255),
  slug: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "slug فقط حروف کوچک، عدد و خط تیره"),
  logoUrl: z.string().url().nullish(),
});

export const inviteWorkspaceMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(workspaceRoleEnum.enumValues).default("member"),
});

export const updateWorkspaceMemberRoleSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(workspaceRoleEnum.enumValues),
});

export const upsertProjectMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(projectRoleEnum.enumValues).default("contributor"),
});

export const createModuleSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1, "نام ماژول الزامی است").max(255),
  description: z.string().max(5000).nullish(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type InviteWorkspaceMemberInput = z.infer<typeof inviteWorkspaceMemberSchema>;
export type UpdateWorkspaceMemberRoleInput = z.infer<typeof updateWorkspaceMemberRoleSchema>;
export type UpsertProjectMemberInput = z.infer<typeof upsertProjectMemberSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
