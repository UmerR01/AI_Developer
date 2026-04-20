export type Role = "admin" | "developer" | "qa" | "support";

export interface Account {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: Role;
  avatarUrl: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  totalStorageGb: number;
}

export interface Team {
  id: string;
  name: string;
  ownerAccountId: string;
  memberAccountIds: string[];
}

export interface StorageProject {
  id: string;
  name: string;
  usedStorageGb: number;
  filesTotal: number;
  memberAccountIds: string[];
}

export interface PipelineSummaryItem {
  id: string;
  label: string;
  count: number;
}

export interface TaskItem {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
}

export interface ActivityItem {
  id: string;
  text: string;
  time: string;
}

export interface NotificationPreviewItem {
  id: string;
  text: string;
  time: string;
  type: "pipeline" | "storage" | "support" | "deploy" | "system";
  visibleTo: Role[];
}

export interface DashboardMockData {
  accounts: Account[];
  plans: SubscriptionPlan[];
  accountPlanByAccountId: Record<string, string>;
  team: Team;
  monthlyUsageGb: number;
  monthlyLimitGb: number;
  projects: StorageProject[];
  pipelineSummary: PipelineSummaryItem[];
  myTasks: TaskItem[];
  recentActivity: ActivityItem[];
  notificationsPreview: NotificationPreviewItem[];
}
