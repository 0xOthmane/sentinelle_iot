import { z } from 'zod';

export const loginFormSchema = z.object({
  password: z.string().min(1, 'Entrez votre mot de passe.'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
