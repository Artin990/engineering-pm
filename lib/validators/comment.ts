import { z } from "zod";

export const addCommentSchema = z.object({
  issueId: z.string().uuid(),
  body: z.string().min(1, "متن کامنت نمی‌تواند خالی باشد").max(10000),
});

export const updateCommentSchema = z.object({
  commentId: z.string().uuid(),
  body: z.string().min(1, "متن کامنت نمی‌تواند خالی باشد").max(10000),
});

export const assignIssueSchema = z.object({
  issueId: z.string().uuid(),
  assigneeIds: z.array(z.string().uuid()).min(1, "حداقل یک assignee لازم است").max(10),
});

export const linkLabelSchema = z.object({
  issueId: z.string().uuid(),
  labelIds: z.array(z.string().uuid()).max(20),
});

export const createLabelSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1, "نام لیبل الزامی است").max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "رنگ باید hex شش‌رقمی باشد").default("#71717A"),
});

export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type AssignIssueInput = z.infer<typeof assignIssueSchema>;
export type LinkLabelInput = z.infer<typeof linkLabelSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
