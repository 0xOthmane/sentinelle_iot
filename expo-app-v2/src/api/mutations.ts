import { useMutation, useQueryClient } from '@tanstack/react-query';

import { API_URL } from '@/constants/config';
import { saveToken } from '@/auth/tokenStore';
import type { Thresholds } from '@/types';
import { queryKeys } from './query-keys';
import {
  fetchWsTicket,
  loginRequest,
  postCommand,
  putThresholds,
  registerPushToken,
  unregisterPushToken,
} from './client';

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => loginRequest(API_URL, password),
    onSuccess: async ({ token }) => {
      await saveToken(token);
      queryClient.clear();
    },
  });
}

export function usePutThresholds(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: Thresholds) => putThresholds(API_URL, deviceId, value),
    onSuccess: (value) => {
      queryClient.setQueryData(queryKeys.thresholds(deviceId), {
        value,
        configured: true,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.thresholds(deviceId) });
    },
  });
}

export function usePostCommand(deviceId: string) {
  return useMutation({
    mutationFn: (command: { id: string; led: boolean }) =>
      postCommand(API_URL, deviceId, command),
  });
}

export function useRegisterPushToken() {
  return useMutation({
    mutationFn: (vars: { token: string; platform: 'android' | 'ios' }) =>
      registerPushToken(API_URL, vars.token, vars.platform),
  });
}

export function useUnregisterPushToken() {
  return useMutation({
    mutationFn: (token: string) => unregisterPushToken(API_URL, token),
  });
}

export function useWsTicket() {
  return useMutation({
    mutationFn: () => fetchWsTicket(API_URL),
    retry: false,
  });
}