import type { LoginMutationResponse, LoginPayload, SignupMutationResponse, SignupPayload } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8011";

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      success
      message
      accessToken
      user {
        id
        username
        email
      }
    }
  }
`;

const SIGNUP_MUTATION = `
  mutation Signup($input: SignupInput!) {
    signup(input: $input) {
      success
      message
      accessToken
      user {
        id
        username
        email
      }
    }
  }
`;

async function postAuthMutation<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/graphql/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function performLogin(username: string, password: string): Promise<LoginPayload> {
  const data = await postAuthMutation<LoginMutationResponse>(LOGIN_MUTATION, {
    input: { username, password },
  });

  if (data == null) {
    return {
      success: false,
      message: "Authentication service is unreachable. Please ensure backend is running on port 8011.",
    };
  }

  if (data.errors?.length) {
    return {
      success: false,
      message: data.errors[0].message,
    };
  }

  return data.data?.login ?? {
    success: false,
    message: "Unexpected login response.",
  };
}

export async function performSignup(username: string, email: string, password: string): Promise<SignupPayload> {
  const data = await postAuthMutation<SignupMutationResponse>(SIGNUP_MUTATION, {
    input: { username, email, password },
  });

  if (data == null) {
    return {
      success: false,
      message: "Authentication service is unreachable. Please ensure backend is running on port 8011.",
    };
  }

  if (data.errors?.length) {
    return {
      success: false,
      message: data.errors[0].message,
    };
  }

  return data.data?.signup ?? {
    success: false,
    message: "Unexpected signup response.",
  };
}
