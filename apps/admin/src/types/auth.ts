export type UserStatus = 'active' | 'disabled' | 'pending';

export interface User {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  locale: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  roles?: string[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
