import { z } from "zod";
import { projectStatusEnum, projectHealthEnum } from "@/lib/db/schema";

/** تاریخ به فرمت ISO (yyyy-MM-dd) — تبدیل نهایی در لایه کوئری انجام می‌شود. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ باید به فرمت YYYY-MM-DD باشد");

export const createProjectSchema = z.object({
  /** کلاینت تولید می‌کند (uuid) — idempotency برای عملیات حساس (قانون سند). */
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid(),
  name: z.string().min(1, "نام پروژه الزامی است").max(255),
  key: z
    .string()
    .min(1, "کلید پروژه الزامی است")
    .max(10)
    .regex(/^[A-Z][A-Z0-9]{0,9}$/, "کلید فقط حرف بزرگ/عدد، حداکثر ۱۰ کاراکتر"),
  description: z.string().max(5000).nullish(),
  targetDate: isoDate.nullish(),
  teamId: z.string().uuid().nullish(),
});

export const updateProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullish(),
  status: z.enum(projectStatusEnum.enumValues).optional(),
  health: z.enum(projectHealthEnum.enumValues).optional(),
  targetDate: isoDate.nullish(),
  teamId: z.string().uuid().nullish(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
/** فیلدهای قابل تغییر پروژه — بدون projectId (در action جدا پarse می‌شود). */
export type UpdateProjectFields = Omit<z.infer<typeof updateProjectSchema>, "projectId">;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
