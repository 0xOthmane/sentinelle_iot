import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';

import { isAuthError, isHttpError, isRateLimitError, isTimeoutError } from './errors';
import { shouldRetry, retryDelay } from './utils/retry';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
        retryDelay,
      },
      mutations: {
        retry: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportError(error, 'query', query.queryKey);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        reportError(error, 'mutation');
      },
    }),
  });
}

function reportError(
  error: unknown,
  operation: 'query' | 'mutation',
  queryKey?: readonly unknown[],
): void {
  if (isAuthError(error)) {
    Sentry.logger.warn('API auth error', { operation, queryKey });
    return;
  }
  if (isRateLimitError(error)) {
    Sentry.logger.warn('API rate limited', {
      operation,
      retryAfterSeconds: error.retryAfterSeconds,
    });
    return;
  }
  if (isHttpError(error)) {
    if (error.isClientError) {
      Sentry.logger.warn('API client error', { operation, status: error.status });
      return;
    }
    Sentry.captureException(error, {
      tags: { feature: 'api', operation },
      extra: { queryKey },
    });
    return;
  }
  if (isTimeoutError(error)) {
    Sentry.captureException(error, {
      tags: { feature: 'api', operation },
      extra: { queryKey },
    });
    return;
  }
  Sentry.captureException(error, {
    tags: { feature: 'api', operation },
    extra: { queryKey },
  });
}