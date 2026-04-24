import { getStoredAccessToken, getStoredUser } from "../auth/session";
import type {
  AdminProfile,
  CurrentUser,
  GraphQLPayload,
  StorageStats,
  SubscriptionInfo,
  SupportTicket,
  SupportTicketMutation,
  TeamOverview,
  UserSubscription,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8011";

const ME_QUERY = `
  query Me {
    me {
      id
      username
      email
    }
  }
`;

const ADMIN_PROFILE_QUERY = `
  query AdminProfile($userId: ID!) {
    getAdminProfile(userId: $userId) {
      userId
      username
      email
      displayName
      isAdmin
      invitedById
      invitedByName
    }
  }
`;

const STORAGE_STATS_QUERY = `
  query StorageStats($userId: ID!) {
    getStorageStats(userId: $userId) {
      userId
      totalQuota
      usedSpace
      availableSpace
      usedPercent
      activeProjectsCount
    }
  }
`;

const SUBSCRIPTION_INFO_QUERY = `
  query SubscriptionInfo($userId: ID!) {
    getSubscriptionInfo(userId: $userId) {
      userId
      subscription {
        id
        userId
        status
        startedAt
        currentPeriodEnd
        plan {
          id
          name
          displayName
          storageLimit
          maxProjects
          maxTeamMembers
          priceDisplay
          isActive
        }
      }
      plans {
        id
        name
        displayName
        storageLimit
        maxProjects
        maxTeamMembers
        priceDisplay
        isActive
      }
    }
  }
`;

const TEAM_OVERVIEW_QUERY = `
  query TeamOverview($adminUserId: ID!) {
    getTeamOverview(adminUserId: $adminUserId) {
      adminUserId
      activeMembers {
        id
        userId
        username
        displayName
        email
        role
        status
        invitedByName
        dateInvited
        dateJoined
      }
      pendingInvites {
        id
        projectId
        projectName
        email
        role
        status
        invitedByName
        dateInvited
        expiresAt
      }
    }
  }
`;

const SELECT_PLAN_MUTATION = `
  mutation SelectPlan($input: SelectPlanInput!) {
    selectPlan(input: $input) {
      success
      message
      subscription {
        id
        userId
        status
        startedAt
        currentPeriodEnd
        plan {
          id
          name
          displayName
          storageLimit
          maxProjects
          maxTeamMembers
          priceDisplay
          isActive
        }
      }
    }
  }
`;

const MY_SUPPORT_TICKETS_QUERY = `
  query MySupportTickets {
    mySupportTickets {
      ${supportTicketFields()}
    }
  }
`;

const ALL_SUPPORT_TICKETS_QUERY = `
  query ListAllSupportTickets {
    listAllSupportTickets {
      ${supportTicketFields()}
    }
  }
`;

const CREATE_SUPPORT_TICKET_MUTATION = `
  mutation CreateSupportTicket($input: CreateSupportTicketInput!) {
    createSupportTicket(input: $input) {
      success
      message
      ticket {
        ${supportTicketFields()}
      }
    }
  }
`;

const REPLY_SUPPORT_TICKET_MUTATION = `
  mutation ReplySupportTicket($input: ReplySupportTicketInput!) {
    replySupportTicket(input: $input) {
      success
      message
      ticket {
        ${supportTicketFields()}
      }
    }
  }
`;

const UPDATE_TICKET_STATUS_MUTATION = `
  mutation UpdateTicketStatus($input: UpdateTicketStatusInput!) {
    updateTicketStatus(input: $input) {
      success
      message
      ticket {
        ${supportTicketFields()}
      }
    }
  }
`;

const UPDATE_TICKET_PRIORITY_MUTATION = `
  mutation UpdateTicketPriority($input: UpdateTicketPriorityInput!) {
    updateTicketPriority(input: $input) {
      success
      message
      ticket {
        ${supportTicketFields()}
      }
    }
  }
`;

const REOPEN_TICKET_MUTATION = `
  mutation ReopenTicket($ticketId: ID!) {
    reopenTicket(ticketId: $ticketId) {
      success
      message
      ticket {
        ${supportTicketFields()}
      }
    }
  }
`;

const UPLOAD_ATTACHMENT_MUTATION = `
  mutation UploadTicketAttachment($input: UploadTicketAttachmentInput!) {
    uploadTicketAttachment(input: $input) {
      success
      message
      ticket {
        ${supportTicketFields()}
      }
    }
  }
`;

function supportTicketFields(): string {
  return `
    id
    ticketNumber
    raisedById
    raisedByName
    subject
    category
    priority
    status
    description
    linkedProjectId
    linkedProjectName
    resolvedAt
    createdAt
    updatedAt
    replies {
      id
      ticketId
      authorId
      authorName
      message
      isInternalNote
      createdAt
    }
    attachments {
      id
      fileName
      filePath
      fileSize
      fileType
      uploadedById
      uploadedByName
      createdAt
    }
  `;
}

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

  const payload = (await response.json()) as GraphQLPayload<unknown>;
  if (payload.errors?.length) {
    const first = payload.errors[0]?.message || "GraphQL request failed.";
    if (/authentication required|not authorized/i.test(first)) {
      throw new Error("Authentication required. Please sign in again.");
    }
  }

  return payload as T;
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const payload = await graphqlRequest<GraphQLPayload<{ me: CurrentUser | null }>>(ME_QUERY);
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  const me = payload.data?.me ?? null;
  if (me) {
    return me;
  }

  const storedUser = getStoredUser();
  if (storedUser?.id && storedUser?.username) {
    return {
      id: storedUser.id,
      username: storedUser.username,
      email: storedUser.email ?? null,
    };
  }

  return null;
}

export async function fetchAdminProfile(userId: string): Promise<AdminProfile | null> {
  const payload = await graphqlRequest<GraphQLPayload<{ getAdminProfile: AdminProfile | null }>>(ADMIN_PROFILE_QUERY, { userId });
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }
  return payload.data?.getAdminProfile ?? null;
}

export async function fetchStorageStats(userId: string): Promise<StorageStats | null> {
  const payload = await graphqlRequest<GraphQLPayload<{ getStorageStats: StorageStats | null }>>(STORAGE_STATS_QUERY, { userId });
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }
  return payload.data?.getStorageStats ?? null;
}

export async function fetchSubscriptionInfo(userId: string): Promise<SubscriptionInfo | null> {
  const payload = await graphqlRequest<GraphQLPayload<{ getSubscriptionInfo: SubscriptionInfo | null }>>(SUBSCRIPTION_INFO_QUERY, { userId });
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }
  return payload.data?.getSubscriptionInfo ?? null;
}

export async function fetchTeamOverview(adminUserId: string): Promise<TeamOverview | null> {
  const payload = await graphqlRequest<GraphQLPayload<{ getTeamOverview: TeamOverview | null }>>(TEAM_OVERVIEW_QUERY, { adminUserId });
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }
  return payload.data?.getTeamOverview ?? null;
}

export async function selectPlan(userId: string, planId: string): Promise<{ success: boolean; message: string; subscription: UserSubscription | null }> {
  const payload = await graphqlRequest<GraphQLPayload<{ selectPlan: { success: boolean; message: string; subscription: UserSubscription | null } }>>(
    SELECT_PLAN_MUTATION,
    { input: { userId, planId } },
  );
  if (payload.errors?.length) {
    return { success: false, message: payload.errors[0].message, subscription: null };
  }
  return payload.data?.selectPlan ?? { success: false, message: "Unexpected select plan response.", subscription: null };
}

export async function fetchSupportTickets(isAdmin: boolean): Promise<SupportTicket[]> {
  const query = isAdmin ? ALL_SUPPORT_TICKETS_QUERY : MY_SUPPORT_TICKETS_QUERY;
  const payload = await graphqlRequest<GraphQLPayload<{ mySupportTickets?: SupportTicket[]; listAllSupportTickets?: SupportTicket[] }>>(query);
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }
  if (isAdmin) {
    return payload.data?.listAllSupportTickets ?? [];
  }
  return payload.data?.mySupportTickets ?? [];
}

export async function createSupportTicket(input: {
  subject: string;
  category: string;
  priority: string;
  description: string;
  linkedProjectId?: string;
}): Promise<SupportTicketMutation> {
  const payload = await graphqlRequest<GraphQLPayload<{ createSupportTicket: SupportTicketMutation }>>(CREATE_SUPPORT_TICKET_MUTATION, {
    input: {
      ...input,
      linkedProjectId: input.linkedProjectId || null,
    },
  });
  if (payload.errors?.length) {
    return { success: false, message: payload.errors[0].message, ticket: null };
  }
  return payload.data?.createSupportTicket ?? { success: false, message: "Unexpected ticket create response.", ticket: null };
}

export async function replySupportTicket(input: {
  ticketId: string;
  message: string;
  isInternalNote?: boolean;
}): Promise<SupportTicketMutation> {
  const payload = await graphqlRequest<GraphQLPayload<{ replySupportTicket: SupportTicketMutation }>>(REPLY_SUPPORT_TICKET_MUTATION, {
    input: {
      ticketId: input.ticketId,
      message: input.message,
      isInternalNote: Boolean(input.isInternalNote),
    },
  });
  if (payload.errors?.length) {
    return { success: false, message: payload.errors[0].message, ticket: null };
  }
  return payload.data?.replySupportTicket ?? { success: false, message: "Unexpected ticket reply response.", ticket: null };
}

export async function updateTicketStatus(ticketId: string, status: string): Promise<SupportTicketMutation> {
  const payload = await graphqlRequest<GraphQLPayload<{ updateTicketStatus: SupportTicketMutation }>>(UPDATE_TICKET_STATUS_MUTATION, {
    input: { ticketId, status },
  });
  if (payload.errors?.length) {
    return { success: false, message: payload.errors[0].message, ticket: null };
  }
  return payload.data?.updateTicketStatus ?? { success: false, message: "Unexpected ticket status response.", ticket: null };
}

export async function updateTicketPriority(ticketId: string, priority: string): Promise<SupportTicketMutation> {
  const payload = await graphqlRequest<GraphQLPayload<{ updateTicketPriority: SupportTicketMutation }>>(UPDATE_TICKET_PRIORITY_MUTATION, {
    input: { ticketId, priority },
  });
  if (payload.errors?.length) {
    return { success: false, message: payload.errors[0].message, ticket: null };
  }
  return payload.data?.updateTicketPriority ?? { success: false, message: "Unexpected ticket priority response.", ticket: null };
}

export async function reopenTicket(ticketId: string): Promise<SupportTicketMutation> {
  const payload = await graphqlRequest<GraphQLPayload<{ reopenTicket: SupportTicketMutation }>>(REOPEN_TICKET_MUTATION, { ticketId });
  if (payload.errors?.length) {
    return { success: false, message: payload.errors[0].message, ticket: null };
  }
  return payload.data?.reopenTicket ?? { success: false, message: "Unexpected ticket reopen response.", ticket: null };
}

export async function uploadTicketAttachment(input: {
  ticketId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
}): Promise<SupportTicketMutation> {
  const payload = await graphqlRequest<GraphQLPayload<{ uploadTicketAttachment: SupportTicketMutation }>>(UPLOAD_ATTACHMENT_MUTATION, {
    input,
  });
  if (payload.errors?.length) {
    return { success: false, message: payload.errors[0].message, ticket: null };
  }
  return payload.data?.uploadTicketAttachment ?? { success: false, message: "Unexpected attachment response.", ticket: null };
}
