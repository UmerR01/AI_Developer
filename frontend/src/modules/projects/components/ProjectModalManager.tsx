import type { FormEvent } from "react";

interface ProjectModalManagerProps {
  createProjectOpen: boolean;
  addCommentOpen: boolean;
  deployOpen: boolean;
  createProjectName: string;
  createProjectDescription: string;
  commentText: string;
  deployVersionLabel: string;
  selectedProjectName: string;
  busy: boolean;
  errorMessage: string | null;
  onCreateProjectNameChange: (value: string) => void;
  onCreateProjectDescriptionChange: (value: string) => void;
  onCommentTextChange: (value: string) => void;
  onDeployVersionLabelChange: (value: string) => void;
  onCloseCreateProject: () => void;
  onCloseAddComment: () => void;
  onCloseDeploy: () => void;
  onSubmitCreateProject: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitAddComment: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitDeploy: (event: FormEvent<HTMLFormElement>) => void;
}

export function ProjectModalManager({
  createProjectOpen,
  addCommentOpen,
  deployOpen,
  createProjectName,
  createProjectDescription,
  commentText,
  deployVersionLabel,
  selectedProjectName,
  busy,
  errorMessage,
  onCreateProjectNameChange,
  onCreateProjectDescriptionChange,
  onCommentTextChange,
  onDeployVersionLabelChange,
  onCloseCreateProject,
  onCloseAddComment,
  onCloseDeploy,
  onSubmitCreateProject,
  onSubmitAddComment,
  onSubmitDeploy,
}: ProjectModalManagerProps) {
  return (
    <>
      {createProjectOpen ? (
        <div className="projects-modal-backdrop" role="dialog" aria-modal="true" aria-label="Create Project">
          <form className="projects-modal" onSubmit={onSubmitCreateProject}>
            <h3>Create Project</h3>
            <label htmlFor="project-name">Project Name</label>
            <input
              id="project-name"
              value={createProjectName}
              onChange={(event) => onCreateProjectNameChange(event.target.value)}
              placeholder="Enter project name"
            />

            <label htmlFor="project-description">Description</label>
            <textarea
              id="project-description"
              value={createProjectDescription}
              onChange={(event) => onCreateProjectDescriptionChange(event.target.value)}
              placeholder="Short context for this project"
              rows={3}
            />

            {errorMessage ? <p className="projects-modal-error">{errorMessage}</p> : null}

            <div className="modal-actions">
              <button type="button" className="projects-secondary-btn" onClick={onCloseCreateProject} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="projects-primary-btn" disabled={busy}>
                {busy ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {addCommentOpen ? (
        <div className="projects-modal-backdrop" role="dialog" aria-modal="true" aria-label="Add Comment">
          <form className="projects-modal" onSubmit={onSubmitAddComment}>
            <h3>Add Comment</h3>
            <p className="projects-modal-subtitle">Project: {selectedProjectName}</p>
            <label htmlFor="project-comment">Comment</label>
            <textarea
              id="project-comment"
              value={commentText}
              onChange={(event) => onCommentTextChange(event.target.value)}
              placeholder="Describe your review note"
              rows={4}
            />

            {errorMessage ? <p className="projects-modal-error">{errorMessage}</p> : null}

            <div className="modal-actions">
              <button type="button" className="projects-secondary-btn" onClick={onCloseAddComment} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="projects-primary-btn" disabled={busy}>
                {busy ? "Saving..." : "Add Comment"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deployOpen ? (
        <div className="projects-modal-backdrop" role="dialog" aria-modal="true" aria-label="Deploy Project">
          <form className="projects-modal" onSubmit={onSubmitDeploy}>
            <h3>Deploy Project</h3>
            <p className="projects-modal-subtitle">Project: {selectedProjectName}</p>
            <label htmlFor="deploy-version">Version Label (optional)</label>
            <input
              id="deploy-version"
              value={deployVersionLabel}
              onChange={(event) => onDeployVersionLabelChange(event.target.value)}
              placeholder="e.g. v0.8.0"
            />

            {errorMessage ? <p className="projects-modal-error">{errorMessage}</p> : null}

            <div className="modal-actions">
              <button type="button" className="projects-secondary-btn" onClick={onCloseDeploy} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="projects-primary-btn" disabled={busy}>
                {busy ? "Deploying..." : "Deploy"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
