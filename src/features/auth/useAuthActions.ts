import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

import { Strings } from '@/constants/strings.vi';
import { HapticService } from '@/services/haptics/HapticService';
import { TtsPriority, ttsService } from '@/services/tts/TtsService';

import { acceptPrivacy, signIn, signInErrorMessage, signOut } from './authService';

const say = (text: string, priority = TtsPriority.FEEDBACK) =>
  ttsService.enqueue({ text, priority });

export const loginFormSchema = z.object({
  email: z.email({ error: Strings.auth.invalidEmail }),
  password: z.string().min(1, { error: Strings.auth.passwordRequired }),
});
export type LoginForm = z.infer<typeof loginFormSchema>;

/** Validate form trước khi gọi API; lỗi được đọc bằng TTS + trả về để hiển thị. */
export function useSignIn() {
  return useMutation({
    mutationFn: async (form: LoginForm) => {
      const parsed = loginFormSchema.safeParse(form);
      if (!parsed.success) throw new FormError(parsed.error.issues[0]?.message ?? '');
      say(Strings.auth.loggingIn);
      await signIn(parsed.data.email, parsed.data.password);
    },
    onSuccess: () => {
      void HapticService.success();
      say(Strings.auth.loginSuccess);
    },
    onError: (error) => {
      void HapticService.warning();
      say(loginErrorMessage(error), TtsPriority.SYSTEM);
    },
  });
}

class FormError extends Error {}

export function loginErrorMessage(error: unknown): string {
  return error instanceof FormError ? error.message : signInErrorMessage(error);
}

export function useAcceptPrivacy() {
  return useMutation({
    mutationFn: acceptPrivacy,
    onSuccess: () => {
      void HapticService.success();
      say(Strings.privacy.accepted);
    },
    onError: () => say(Strings.errors.unavailable, TtsPriority.SYSTEM),
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: signOut,
    onSettled: () => say(Strings.auth.loggedOut),
  });
}
