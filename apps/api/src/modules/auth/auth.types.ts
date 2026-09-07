import type { UserRole } from '@vellor/shared';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone: string | null;
  cpfMasked: string | null;
  mfaEnabled: boolean;
  newsletterOptIn: boolean;
  providerCustomerId: string | null;
  createdAt: Date;
}

export interface AuthSession {
  id: string;
  mfaVerified: boolean;
  expiresAt: Date;
}

export interface AuthContext {
  user: AuthUser;
  session: AuthSession;
}
