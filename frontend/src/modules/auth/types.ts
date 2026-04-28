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

export interface SignupPayload {
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

export interface SignupMutationResponse {
  data?: {
    signup: SignupPayload;
  };
  errors?: Array<{ message: string }>;
}
