"use client";

import { useState } from "react";

import { downloadBriefDocx } from "../../utils/briefDocx";
import { renderBriefMarkdown } from "../../utils/briefMarkdown";

interface ProjectCreateStepFinalBriefProps {
  projectName: string;
  brief: string;  revisionCount: number;
  wordCount: number;
  readTimeMinutes: number;
  historyLabels: string[];
  feedback: string;
  feedbackOpen: boolean;
  onFeedbackChange: (value: string) => void;
  onToggleFeedback: () => void;
  onSendToAi: () => void;
  onRequestChanges: () => void;
  onApprove: () => void;
  onBack: () => void;
  busy: boolean;
}

export function ProjectCreateStepFinalBrief({
  projectName,
  brief,
  revisionCount,
  wordCount,
  readTimeMinutes,
  historyLabels,
  feedback,
  feedbackOpen,
  onFeedbackChange,
  onToggleFeedback,
  onSendToAi,
  onRequestChanges,
  onApprove,
  onBack,
  busy,
}: ProjectCreateStepFinalBriefProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const hasBrief = Boolean(brief.trim()) && !brief.includes("will appear here");

  async function handleDownloadDocx() {
    if (!hasBrief || downloading || busy) return;
    setDownloadError("");
    setDownloading(true);
    try {
      await downloadBriefDocx({ projectName, brief });
    } catch {
      setDownloadError("Could not create the Word document. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="project-create-step">
      <header className="project-create-header project-create-header--split">
        <div>
          <h3>Review Your Project Brief</h3>
          <p>The AI Agent has compiled your project brief. Review and approve to begin.</p>
        </div>
        <div className="project-create-badges">
          <span className="project-create-ai-badge">AI Compiled</span>
          {revisionCount > 0 ? <span className="project-create-revision-badge">Revision {revisionCount + 1}</span> : null}
        </div>
      </header>

      <div className="project-create-brief-card project-create-brief-card--markdown">
        <article
          className="project-create-brief-doc"
          dangerouslySetInnerHTML={{ __html: renderBriefMarkdown(brief) }}
        />
      </div>

      <div className="project-create-brief-meta">
        <div className="project-create-brief-meta-stats">
          <span>{wordCount} words</span>
          <span>{readTimeMinutes} min read</span>
        </div>
        <button
          type="button"
          className="project-create-download-btn"
          onClick={handleDownloadDocx}
          disabled={busy || downloading || !hasBrief}
          title="Download project brief as Word document"
        >
          {downloading ? "Preparing…" : "Download .docx"}
        </button>
      </div>
      {downloadError ? <p className="project-create-download-error">{downloadError}</p> : null}

      <div className="project-create-history-toggle">
        <button type="button" className="project-create-link-btn" onClick={onToggleFeedback} disabled={busy}>
          View previous versions ▾
        </button>
      </div>

      {feedbackOpen ? (
        <div className="project-create-history-list">
          {historyLabels.length ? historyLabels.map((item) => <button key={item} type="button">{item}</button>) : <span>No previous versions yet.</span>}
        </div>
      ) : null}

      <footer className="project-create-actions-row">
        <button type="button" className="project-create-back-link" onClick={onBack} disabled={busy}>
          Back
        </button>
        <div className="project-create-actions-right">
          <button type="button" className="project-create-secondary-accent-btn" onClick={onRequestChanges} disabled={busy}>
            Request Changes
          </button>
          <button type="button" className="project-create-primary-success-btn" onClick={onApprove} disabled={busy}>
            ✓ Approve & Create Project
          </button>
        </div>
      </footer>

      {feedbackOpen ? (
        <div className="project-create-feedback-panel">
          <label className="project-create-field project-create-field--accent">
            <span>Send revision notes to the AI Agent</span>
            <textarea
              className="project-create-textarea project-create-textarea--feedback"
              value={feedback}
              onChange={(event) => onFeedbackChange(event.target.value)}
              placeholder="Tell the AI Agent what to change in the brief..."
            />
          </label>
          <button type="button" className="project-create-feedback-btn" onClick={onSendToAi} disabled={busy || !feedback.trim()}>
            Send to AI Agent
          </button>
        </div>
      ) : null}
    </div>
  );
}
