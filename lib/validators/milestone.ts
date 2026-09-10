import { z } from "zod";
import { milestoneStatusEnum, cycleStatusEnum } from "@/lib/db/schema";
import { isoDate } from "./project";

export const createMilestoneSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1, "عنوان الزامی است").max(255),
  description: z.string().max(5000).nullish(),
  targetDate: isoDate.nullish(),
  order: z.number().int().min(0).default(0),
});

export const updateMilestoneSchema = z.object({
  milestoneId: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullish(),
  status: z.enum(milestoneStatusEnum.enumValues).optional(),
  targetDate: isoDate.nullish(),
  order: z.number().int().min(0).optional(),
});

export const createCycleSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1, "نام سایکل الزامی است").max(255),
  goal: z.string().max(5000).nullish(),
  startDate: isoDate,
  endDate: isoDate,
}).refine((c) => c.startDate <= c.endDate, {
  message: "تاریخ شروع باید قبل از تاریخ پایان باشد",
});

export const updateCycleSchema = z.object({
  cycleId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  goal: z.string().max(5000).nullish(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  status: z.enum(cycleStatusEnum.enumValues).optional(),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
export type CreateCycleInput = z.infer<typeof createCycleSchema>;
export type UpdateCycleInput = z.infer<typeof updateCycleSchema>;
