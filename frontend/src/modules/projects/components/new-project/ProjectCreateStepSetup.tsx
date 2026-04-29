import type { GitHubAuthMode, GitHubConnectionState } from "./ProjectCreateWizard.types";

interface ProjectCreateStepSetupProps {
  projectName: string;
  projectAvatar: string;
  sourceMode: GitHubAuthMode;
  repositoryUrl: string;
  accessToken: string;
  connectionState: GitHubConnectionState;
  onProjectNameChange: (value: string) => void;
  onProjectAvatarChange: (value: string) => void;
  onSourceModeChange: (value: GitHubAuthMode) => void;
  onRepositoryUrlChange: (value: string) => void;
  onAccessTokenChange: (value: string) => void;
  onVerifyConnection: () => void;
  onCancel: () => void;
  onContinue: () => void;
  busy: boolean;
}

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2a10 10 0 0 0-3.16 19.5c.5.09.68-.22.68-.48 0-.24-.01-1-.01-1.81-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.61.07-.61 1 .07 1.54 1.04 1.54 1.04.9 1.55 2.36 1.1 2.94.84.09-.66.35-1.1.63-1.35-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.04-2.68-.1-.25-.45-1.27.1-2.64 0 0 .85-.27 2.77 1.03a9.6 9.6 0 0 1 5.04 0c1.92-1.3 2.77-1.03 2.77-1.03.55 1.37.2 2.39.1 2.64.65.7 1.04 1.59 1.04 2.68 0 3.84-2.34 4.68-4.57 4.93.36.32.68.95.68 1.92 0 1.39-.01 2.51-.01 2.85 0 .26.18.57.69.47A10 10 0 0 0 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ProjectCreateStepSetup({
  projectName,
  projectAvatar,
  sourceMode,
  repositoryUrl,
  accessToken,
  connectionState,
  onProjectNameChange,
  onProjectAvatarChange,
  onSourceModeChange,
  onRepositoryUrlChange,
  onAccessTokenChange,
  onVerifyConnection,
  onCancel,
  onContinue,
  busy,
}: ProjectCreateStepSetupProps) {
  const hasGithubConnection = connectionState.status === "success";

  return (
    <div className="project-create-step">
      <header className="project-create-header">
        <h3>Create New Project</h3>
        <p>Start by naming your project and connecting your source.</p>
      </header>

      <div className="project-create-grid project-create-grid--setup">
        <label className="project-create-field project-create-field--span">
          <span>Project Name</span>
          <input
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
            placeholder="Customer Dashboard Redesign"
          />
        </label>

        <div className="project-create-avatar-card">
          <span>Project Avatar</span>
          <button type="button" className="project-create-avatar-btn" disabled={busy} onClick={() => onProjectAvatarChange(projectAvatar)}>
            <strong>{projectAvatar}</strong>
            <span>Optional identity mark</span>
          </button>
        </div>
      </div>

      <div className="project-create-slug">Slug: {projectName.trim() ? projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project" : "project"}</div>

      <section className="project-create-source-section">
        <div className="project-create-section-label">Connect a Source</div>

        <div className="project-create-source-card-grid">
          <button
            type="button"
            className={`project-create-source-card ${sourceMode === "repo_url" ? "is-selected" : ""}`}
            onClick={() => onSourceModeChange("repo_url")}
          >
            <span className="project-create-source-logo project-create-source-logo--github">
              <GithubMark />
            </span>
            <span className="project-create-source-copy">
              <strong>GitHub</strong>
              <span>Connect using a repository URL.</span>
            </span>
            {sourceMode === "repo_url" ? <span className="project-create-source-check">✓</span> : null}
          </button>

          <button type="button" className="project-create-source-card project-create-source-card--disabled" disabled>
            <span className="project-create-source-logo">GL</span>
            <span className="project-create-source-copy">
              <strong>GitLab</strong>
              <span>Coming Soon</span>
            </span>
            <span className="project-create-soon-badge">Coming Soon</span>
          </button>

          <button type="button" className="project-create-source-card project-create-source-card--disabled" disabled>
            <span className="project-create-source-logo">BB</span>
            <span className="project-create-source-copy">
              <strong>Bitbucket</strong>
              <span>Coming Soon</span>
            </span>
            <span className="project-create-soon-badge">Coming Soon</span>
          </button>
        </div>

        <div className="project-create-credential-panel">
          <div className="project-create-toggle-row">
            <button
              type="button"
              className={`project-create-toggle-pill ${sourceMode === "repo_url" ? "is-active" : ""}`}
              onClick={() => onSourceModeChange("repo_url")}
            >
              Repository URL
            </button>
            <button
              type="button"
              className={`project-create-toggle-pill ${sourceMode === "personal_access_token" ? "is-active" : ""}`}
              onClick={() => onSourceModeChange("personal_access_token")}
            >
              Personal Access Token
            </button>
          </div>

          {sourceMode === "repo_url" ? (
            <label className="project-create-field">
              <span>GitHub Repository URL</span>
              <input value={repositoryUrl} onChange={(event) => onRepositoryUrlChange(event.target.value)} placeholder="https://github.com/org/repo" />
              <small>Paste the repository URL and verify the connection before continuing.</small>
            </label>
          ) : (
            <label className="project-create-field">
              <span>GitHub Personal Access Token</span>
              <input value={accessToken} onChange={(event) => onAccessTokenChange(event.target.value)} placeholder="ghp_..." />
              <small>Use a token when the repository cannot be accessed directly by URL.</small>
            </label>
          )}

          <div className="project-create-status-row">
            {connectionState.status === "idle" ? <span className="project-create-status-pill">Ready to connect</span> : null}
            {connectionState.status === "checking" ? <span className="project-create-status-pill is-loading">Connecting to GitHub...</span> : null}
            {connectionState.status === "success" ? <span className="project-create-status-pill is-success">Repository connected: {connectionState.repositoryName}</span> : null}
            {connectionState.status === "error" ? <span className="project-create-status-pill is-error">{connectionState.message}</span> : null}
          </div>

          <div className="project-create-actions-inline">
            <button type="button" className="project-create-ghost-btn" onClick={onVerifyConnection} disabled={busy}>
              <GithubMark />
              Verify Connection
            </button>
          </div>
        </div>
      </section>

      <footer className="project-create-footer">
        <button type="button" className="project-create-secondary-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="project-create-primary-btn" onClick={onContinue} disabled={busy || !projectName.trim() || !hasGithubConnection}>
          Continue →
        </button>
      </footer>
    </div>
  );
}
