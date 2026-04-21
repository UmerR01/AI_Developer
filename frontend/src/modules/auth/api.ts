import type { LoginMutationResponse, LoginPayload } from "./types";

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

export async function performLogin(username: string, password: string): Promise<LoginPayload> {
  const response = await fetch(`${API_BASE_URL}/graphql/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: LOGIN_MUTATION,
      variables: {
        input: { username, password },
      },
    }),
  });

  if (!response.ok) {
    return {
      success: false,
      message: "Unable to reach authentication service.",
    };
  }

  const data: LoginMutationResponse = await response.json();

  if (data.errors?.length) {
    return {
      success: false,
      message: data.errors[0].message,
    };
  }

  return (
    data.data?.login ?? {
      success: false,
      message: "Unexpected login response.",
    }
  );
}
