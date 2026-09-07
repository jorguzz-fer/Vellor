import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthStatus, LoginInput, RegisterInput } from '@vellor/shared';
import { ApiError, authApi, catalogApi, settingsApi } from './api';

export const queryClient = new QueryClient({
  defaultQueries: undefined,
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
} as ConstructorParameters<typeof QueryClient>[0]);

export const queryKeys = {
  settings: ['settings'] as const,
  auth: ['auth', 'me'] as const,
  categories: ['catalog', 'categories'] as const,
  collections: (category?: string) => ['catalog', 'collections', category ?? 'all'] as const,
  products: (params: Record<string, unknown>) => ['catalog', 'products', params] as const,
  product: (slug: string) => ['catalog', 'product', slug] as const,
};

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: settingsApi.get,
    staleTime: 5 * 60_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: catalogApi.categories,
    staleTime: 5 * 60_000,
  });
}

export function useCollections(category?: string) {
  return useQuery({
    queryKey: queryKeys.collections(category),
    queryFn: () => catalogApi.collections(category),
    staleTime: 5 * 60_000,
  });
}

const ANONYMOUS: AuthStatus = {
  authenticated: false,
  user: null,
  mfaSetupRequired: false,
  mfaPending: false,
};

export function useAuth() {
  const query = useQuery({ queryKey: queryKeys.auth, queryFn: authApi.me, staleTime: 60_000 });
  const status = query.data ?? ANONYMOUS;
  return {
    ...status,
    /** true até a primeira resposta de /auth/me (guards não devem redirecionar antes disso). */
    isLoading: query.isPending,
    isAdmin: status.user?.role === 'admin',
    refetch: query.refetch,
  };
}

export function useAuthMutations() {
  const client = useQueryClient();
  const apply = (status: AuthStatus) => {
    client.setQueryData(queryKeys.auth, status);
  };
  const login = useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: apply,
  });
  const register = useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: apply,
  });
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      apply(ANONYMOUS);
      client.removeQueries({
        predicate: (q) => q.queryKey[0] === 'account' || q.queryKey[0] === 'admin',
      });
    },
  });
  const mfaVerify = useMutation({
    mutationFn: (code: string) => authApi.mfaVerify(code),
    onSuccess: apply,
  });
  const mfaEnable = useMutation({
    mutationFn: (code: string) => authApi.mfaEnable(code),
    onSuccess: apply,
  });
  return { login, register, logout, mfaVerify, mfaEnable, apply };
}
