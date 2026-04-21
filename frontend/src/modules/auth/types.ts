export interface LoginUser {
  id: string;
  username: string;
  email?: string | null;
}

export interface LoginPayload {
  success: boolean;
  message: string;
  accessToken?: string | null;
  user?: LoginUser | null;
}

export interface LoginMutationResponse {
  data?: {
    login: LoginPayload;
  };
  errors?: Array<{ message: string }>;
}
