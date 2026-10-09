import { z } from 'zod';

export const timeWindowSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const roadmapTaskSchema = z.object({
  id: z.string().min(1),
  roadmapId: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(5000).optional(),
  estimatedMinutes: z.number().int().positive().max(1440),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  category: z.string().max(100).optional(),
  order: z.number().int().nonnegative(),
  dependencyIds: z.array(z.string()),
  completedOverall: z.boolean(),
  manuallyBlocked: z.boolean().optional(),
  active: z.boolean().optional(),
  splittable: z.boolean().optional(),
});

export const busyEventSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(200),
  window: timeWindowSchema,
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  blocksPlanning: z.boolean(),
});

export const timeWindowOrderSchema = timeWindowSchema.refine(
  (window: { start: string; end: string }) => window.start < window.end,
  { message: 'Time window end must be later than start.' },
);

export const externalTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(5000).optional(),
  category: z.enum(['PERSONAL', 'COLLEGE', 'WORK', 'URGENT']),
  estimatedMinutes: z.number().int().positive().max(1440),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  availableFrom: z.string().optional(),
  availableUntil: z.string().optional(),
  preferredWindow: timeWindowSchema.optional(),
  fixedWindow: timeWindowSchema.optional(),
  status: z.enum(['planned', 'completed', 'skipped', 'rescheduled', 'cancelled', 'unreported']),
  active: z.boolean(),
  carryOverCount: z.number().int().nonnegative().optional(),
  splittable: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});
