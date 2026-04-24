import { getStoredAccessToken } from "../auth/session";
import { fetchCurrentUser } from "../platform/api";
import type {
  IntegrationDetail,
  IntegrationDetailResponse,
  IntegrationListResponse,
  IntegrationMutationResponse,
  IntegrationMutationResult,
  IntegrationRemovalResult,
  IntegrationSummary,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8011";

const INTEGRATIONS_LIST_QUERY = `
  query ListIntegrations($userId: ID!) {
    listIntegrations(userId: $userId) {
      id
      slug
      name
      description
      category
      logoKey
      isActive
      docsUrl
      configFields
      isEnabled
      isConfigured
      configuredAt
      lastToggledAt
    }
  }
`;

const INTEGRATION_DETAIL_QUERY = `
  query GetIntegrationDetail($userId: ID!, $slug: String!) {
    getIntegrationDetail(userId: $userId, slug: $slug) {
      id
      slug
      name
      description
      category
      logoKey
      isActive
      docsUrl
      configFields
      configData
      isEnabled
      isConfigured
      configuredAt
      lastToggledAt
    }
  }
`;

const CONFIGURE_INTEGRATION_MUTATION = `
  mutation ConfigureIntegration($input: ConfigureIntegrationInput!) {
    configureIntegration(input: $input) {
      success
      message
      integration {
        id
        slug
        name
        description
        category
        logoKey
        isActive
        docsUrl
        configFields
        configData
        isEnabled
        isConfigured
        configuredAt
        lastToggledAt
      }
    }
  }
`;

const TOGGLE_INTEGRATION_MUTATION = `
  mutation ToggleIntegration($input: ToggleIntegrationInput!) {
    toggleIntegration(input: $input) {
      success
      message
      integration {
        id
        slug
        name
        description
        category
        logoKey
        isActive
        docsUrl
        configFields
        configData
        isEnabled
        isConfigured
        configuredAt
        lastToggledAt
      }
    }
  }
`;

const REMOVE_INTEGRATION_MUTATION = `
  mutation RemoveIntegration($input: RemoveIntegrationInput!) {
    removeIntegration(input: $input) {
      success
      message
    }
  }
`;

async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const accessToken = getStoredAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/graphql/`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error("Unable to reach GraphQL service.");
  }

  const payload = (await response.json()) as { errors?: Array<{ message: string }> };
  const firstError = payload.errors?.[0]?.message;
  if (firstError && /authentication required|not authorized/i.test(firstError)) {
    throw new Error("Authentication required. Please sign in again.");
  }

  return payload as T;
}

export async function fetchIntegrations(): Promise<IntegrationSummary[]> {
  const currentUser = await fetchCurrentUser();
  if (!currentUser) {
    throw new Error("Unable to resolve current user.");
  }

  const payload = await graphqlRequest<IntegrationListResponse>(INTEGRATIONS_LIST_QUERY, { userId: currentUser.id });
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  return payload.data?.listIntegrations ?? [];
}

export async function fetchIntegrationDetail(slug: string): Promise<IntegrationDetail | null> {
  const currentUser = await fetchCurrentUser();
  if (!currentUser) {
    throw new Error("Unable to resolve current user.");
  }

  const payload = await graphqlRequest<IntegrationDetailResponse>(INTEGRATION_DETAIL_QUERY, { userId: currentUser.id, slug });
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  return payload.data?.getIntegrationDetail ?? null;
}

export async function configureIntegration(input: {
  slug: string;
  configData: Record<string, string>;
}): Promise<IntegrationMutationResult> {
  const currentUser = await fetchCurrentUser();
  if (!currentUser) {
    return { success: false, message: "Unable to resolve current user.", integration: null };
  }

  const payload = await graphqlRequest<IntegrationMutationResponse>(CONFIGURE_INTEGRATION_MUTATION, {
    input: {
      userId: currentUser.id,
      slug: input.slug,
      configData: input.configData,
    },
  });

  if (payload.errors?.length) {
    return { success: false, message: payload.errors[0].message, integration: null };
  }

  return payload.data?.configureIntegration ?? { success: false, message: "Unexpected integration configuration response.", integration: null };
}

export async function toggleIntegration(input: {
  slug: string;
  isEnabled: boolean;
}): Promise<IntegrationMutationResult> {
  const currentUser = await fetchCurrentUser();
  if (!currentUser) {
    return { success: false, message: "Unable to resolve current user.", integration: null };
  }

  const payload = await graphqlRequest<IntegrationMutationResponse>(TOGGLE_INTEGRATION_MUTATION, {
    input: {
      userId: currentUser.id,
      slug: input.slug,
      isEnabled: input.isEnabled,
    },
  });

  if (payload.errors?.length) {
    return { success: false, message: payload.errors[0].message, integration: null };
  }

  return payload.data?.toggleIntegration ?? { success: false, message: "Unexpected toggle response.", integration: null };
}

export async function removeIntegration(slug: string): Promise<IntegrationRemovalResult> {
  const currentUser = await fetchCurrentUser();
  if (!currentUser) {
    return { success: false, message: "Unable to resolve current user." };
  }

  const payload = await graphqlRequest<IntegrationMutationResponse>(REMOVE_INTEGRATION_MUTATION, {
    input: {
      userId: currentUser.id,
      slug,
    },
  });

  if (payload.errors?.length) {
    return { success: false, message: payload.errors[0].message };
  }

  return payload.data?.removeIntegration ?? { success: false, message: "Unexpected remove response." };
}
