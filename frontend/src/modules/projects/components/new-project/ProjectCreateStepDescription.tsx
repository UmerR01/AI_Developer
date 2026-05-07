import type { ProjectDescriptionMode } from "./ProjectCreateWizard.types";

interface ProjectCreateStepDescriptionProps {
  descriptionMode: ProjectDescriptionMode;
  description: string;
  documentName: string;
  documentText: string;
  additionalContext: string;
  characterLimit: number;
  autosaveLabel: string;
  onDescriptionModeChange: (mode: ProjectDescriptionMode) => void;
  onDescriptionChange: (value: string) => void;
  onDocumentUpload: (file: File | null) => void;
  onDocumentTextChange: (value: string) => void;
  onAdditionalContextChange: (value: string) => void;
  onAnalyze: () => void;
  onBack: () => void;
  busy: boolean;
}

function PillButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button type="button" className={`project-create-toggle-pill ${active ? "is-active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function ProjectCreateStepDescription({
  descriptionMode,
  description,
  documentName,
  documentText,
  additionalContext,
  characterLimit,
  autosaveLabel,
  onDescriptionModeChange,
  onDescriptionChange,
  onDocumentUpload,
  /* onDocumentTextChange, */
  onAdditionalContextChange,
  onAnalyze,
  onBack,
  busy,
}: ProjectCreateStepDescriptionProps) {
  const usagePercent = Math.min(100, Math.round((description.length / characterLimit) * 100));
  const usageTone = usagePercent >= 100 ? "is-error" : usagePercent >= 80 ? "is-warn" : "";

  return (
    <div className="project-create-step">
      <header className="project-create-header">
        <h3>Describe Your Project</h3>
        <p>Help the AI Agent understand your requirements, tech stack, and scope.</p>
      </header>

      <div className="project-create-toggle-row project-create-toggle-row--full">
        <PillButton active={descriptionMode === "write"} onClick={() => onDescriptionModeChange("write")}>
          ✏️ Write Description
        </PillButton>
        <PillButton active={descriptionMode === "upload"} onClick={() => onDescriptionModeChange("upload")}>
          📄 Upload Document
        </PillButton>
      </div>

      {descriptionMode === "write" ? (
        <div className="project-create-body-stack">
          <textarea
            className="project-create-textarea"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Describe the project requirements, stack, scope, and constraints..."
            maxLength={characterLimit}
          />

          <div className="project-create-meta-row">
            <span className={`project-create-character-count ${usageTone}`}>{description.length} / {characterLimit} characters</span>
            <span className="project-create-autosave">✓ Autosaved {autosaveLabel}</span>
          </div>

          <div className="project-create-chip-row">
            <button type="button" className="project-create-helper-chip" onClick={() => onDescriptionChange(`${description}${description ? "\n" : ""}Tech stack: `)}>
              + Add Tech Stack
            </button>
            <button type="button" className="project-create-helper-chip" onClick={() => onDescriptionChange(`${description}${description ? "\n" : ""}Features: `)}>
              + Add Features List
            </button>
            <button type="button" className="project-create-helper-chip" onClick={() => onDescriptionChange(`${description}${description ? "\n" : ""}Constraints: `)}>
              + Add Constraints
            </button>
          </div>
        </div>
      ) : (
        <div className="project-create-body-stack">
          <label className="project-create-dropzone">
            <input
              type="file"
              accept=".txt,.md,.markdown,.pdf,.doc,.docx"
              onChange={(event) => onDocumentUpload(event.target.files?.[0] ?? null)}
            />
            <strong>{documentName ? "Document uploaded" : "Drop a document here or browse files"}</strong>
            <span>{documentName ? documentName : "The AI Agent will read the file and extract the brief."}</span>
            <span className="project-create-browse-btn">Browse Files</span>
          </label>

          {documentText ? (
            <div className="project-create-upload-chip">
              <span>✓ Document uploaded and ready for analysis</span>
            </div>
          ) : null}

          <label className="project-create-field">
            <span>Additional Context</span>
            <textarea
              className="project-create-textarea project-create-textarea--compact"
              value={additionalContext}
              onChange={(event) => onAdditionalContextChange(event.target.value)}
              placeholder="Add extra notes the uploaded document may not cover..."
            />
          </label>
        </div>
      )}

      <footer className="project-create-footer">
        <button type="button" className="project-create-secondary-btn" onClick={onBack} disabled={busy}>
          ← Back
        </button>
        <button type="button" className="project-create-primary-btn" onClick={onAnalyze} disabled={busy}>
          Analyze with AI →
        </button>
      </footer>
    </div>
  );
}
