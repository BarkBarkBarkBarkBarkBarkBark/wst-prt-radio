import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(['admin']),
  createdAt: z.string(),
});
