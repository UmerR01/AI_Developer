export type CategoryFilter = "all" | "ai_model" | "design" | "devops" | "cloud";

export const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "All",
  ai_model: "AI Models",
  design: "Design",
  devops: "DevOps",
  cloud: "Cloud",
};

export const FEATURE_TEXT: Record<string, string[]> = {
  openai: ["Power AI agents with GPT models", "Generate code, text, and analysis", "Configurable model selection per task"],
  claude: ["Advanced reasoning and code review", "Document analysis and summarization", "Long-context task processing"],
  gemini: ["Multimodal AI for text and vision tasks", "Google ecosystem integration", "Fast inference with Flash models"],
  figma: ["Import design files to projects", "Sync assets and components", "Link designs to tasks"],
  github: ["Link repositories to projects", "Track commits per task", "Push agent-generated code to branches"],
  aws: ["Store project artifacts in S3", "Deploy AI outputs via Lambda", "Manage cloud resources per project"],
};

export const HELPER_TEXT: Record<string, string> = {
  api_key: "Find your API key in the provider console.",
  access_token: "Generate a token from the provider dashboard.",
  access_key_id: "Create or locate this key in your cloud console.",
  secret_access_key: "Keep this secret private and rotate it regularly.",
  region: "Choose the region closest to your deployment.",
  default_repo: "Optional repository used when a project does not specify one.",
  default_branch: "Defaults to main if left empty.",
  team_id: "Optional team or organization identifier.",
  s3_bucket: "Optional default bucket for project uploads.",
  model: "Select the default model for this integration.",
};
