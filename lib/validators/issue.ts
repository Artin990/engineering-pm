import { z } from "zod";
import { issueStatusEnum, issuePriorityEnum, issueTypeEnum } from "@/lib/db/schema";
import { isoDate } from "./project";

export const createIssueSchema = z.object({
  /** کلاینت تولید می‌کند (uuid) — idempotency برای عملیات حساس. */
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  /** کلید ایشو مثل PM-142. اگر خالی باشد سمت سرور تولید می‌شود. */
  key: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Z]+-[0-9]+$/, "کلید به فرمت PM-142")
    .nullish(),
  title: z.string().min(1, "عنوان الزامی است").max(500),
  description: z.string().max(10000).nullish(),
  status: z.enum(issueStatusEnum.enumValues).default("backlog"),
  priority: z.enum(issuePriorityEnum.enumValues).default("none"),
  type: z.enum(issueTypeEnum.enumValues).default("task"),
  estimate: z.number().int().min(0).default(1),
  dueDate: isoDate.nullish(),
  milestoneId: z.string().uuid().nullish(),
  moduleId: z.string().uuid().nullish(),
  cycleId: z.string().uuid().nullish(),
  assigneeId: z.string().uuid().nullish(),
});

export const updateIssueSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullish(),
  status: z.enum(issueStatusEnum.enumValues).optional(),
  priority: z.enum(issuePriorityEnum.enumValues).optional(),
  type: z.enum(issueTypeEnum.enumValues).optional(),
  estimate: z.number().int().min(0).optional(),
  dueDate: isoDate.nullish(),
  milestoneId: z.string().uuid().nullish(),
  moduleId: z.string().uuid().nullish(),
  cycleId: z.string().uuid().nullish(),
  assigneeId: z.string().uuid().nullish(),
  parentId: z.string().uuid().nullish(),
});

export const addIssueAssigneeSchema = z.object({
  issueId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const removeIssueAssigneeSchema = addIssueAssigneeSchema;

export const createIssueDependencySchema = z.object({
  issueId: z.string().uuid(),
  dependsOnId: z.string().uuid(),
  /** جلوگیری از وابستگی دایره‌ای — بررسی سمت سرور الزامی است. */
}).refine((d) => d.issueId !== d.dependsOnId, {
  message: "ایشو نمی‌تواند به خودش وابسته باشد",
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type CreateIssueDependencyInput = z.infer<typeof createIssueDependencySchema>;
