export interface GraphQLErrorItem {
  message: string;
}

export interface GraphQLPayload<T> {
  data?: T;
  errors?: GraphQLErrorItem[];
}

export interface CurrentUser {
  id: string;
  username: string;
  email: string | null;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  storageLimit: number;
  maxProjects: number;
  maxTeamMembers: number;
  priceDisplay: string;
  isActive: boolean;
}

export interface UserSubscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: string;
  startedAt: string;
  currentPeriodEnd: string | null;
}

export interface StorageStats {
  userId: string;
  totalQuota: number;
  usedSpace: number;
  availableSpace: number;
  usedPercent: number;
  activeProjectsCount: number;
}

export interface SubscriptionInfo {
  userId: string;
  subscription: UserSubscription | null;
  plans: SubscriptionPlan[];
}

export interface TeamMemberOverview {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  invitedByName: string | null;
  dateInvited: string;
  dateJoined: string | null;
}

export interface TeamInviteOverview {
  id: string;
  projectId: string;
  projectName: string;
  email: string;
  role: string;
  status: string;
  invitedByName: string | null;
  dateInvited: string;
  expiresAt: string | null;
}

export interface TeamOverview {
  adminUserId: string;
  activeMembers: TeamMemberOverview[];
  pendingInvites: TeamInviteOverview[];
}

export interface AdminProfile {
  userId: string;
  username: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  invitedById: string | null;
  invitedByName: string | null;
}

export interface TicketReply {
  id: string;
  ticketId: string;
  authorId: string | null;
  authorName: string;
  message: string;
  isInternalNote: boolean;
  createdAt: string;
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  uploadedById: string | null;
  uploadedByName: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  raisedById: string;
  raisedByName: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  linkedProjectId: string | null;
  linkedProjectName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  replies: TicketReply[];
  attachments: TicketAttachment[];
}

export interface SupportTicketMutation {
  success: boolean;
  message: string;
  ticket: SupportTicket | null;
}
