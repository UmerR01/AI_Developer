export type IntegrationCategory = "ai_model" | "design" | "devops" | "cloud";
export type IntegrationFieldType = "password" | "text" | "select";

export interface IntegrationConfigField {
  key: string;
  label: string;
  type: IntegrationFieldType;
  required: boolean;
  options?: string[];
  default?: string;
}

export interface IntegrationSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  logoKey: string;
  isActive: boolean;
  docsUrl: string | null;
  configFields: IntegrationConfigField[];
  isEnabled: boolean;
  isConfigured: boolean;
  configuredAt: string | null;
  lastToggledAt: string | null;
}

export interface IntegrationDetail extends IntegrationSummary {
  configData: Record<string, string> | null;
}

export interface IntegrationMutationResult {
  success: boolean;
  message: string;
  integration: IntegrationDetail | null;
}

export interface IntegrationRemovalResult {
  success: boolean;
  message: string;
}

export interface IntegrationListResponse {
  data?: {
    listIntegrations: IntegrationSummary[];
  };
  errors?: Array<{ message: string }>;
}

export interface IntegrationDetailResponse {
  data?: {
    getIntegrationDetail: IntegrationDetail | null;
  };
  errors?: Array<{ message: string }>;
}

export interface IntegrationMutationResponse {
  data?: {
    configureIntegration?: IntegrationMutationResult;
    toggleIntegration?: IntegrationMutationResult;
    removeIntegration?: IntegrationRemovalResult;
  };
  errors?: Array<{ message: string }>;
}
