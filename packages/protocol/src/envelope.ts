import { z } from 'zod';

export const envelopeSchema = z.object({
  type: z.string(),
  version: z.string(),
  sessionId: z.string(),
  timestampMs: z.number(),
  sequence: z.number().int().nonnegative(),
});

export type Envelope = z.infer<typeof envelopeSchema>;
