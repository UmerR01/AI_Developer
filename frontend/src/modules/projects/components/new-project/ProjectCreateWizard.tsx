"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  agentProjectKey,
  bootstrapAgentSession,
  buildAgentWorkspaceUrl,
  inferAgentUserId,
} from "../../../../lib/agentClient";
import { createProject, reviewProjectBrief } from "../../api";
import type { ProjectRecord } from "../../types";
import "./project-create.css";
import {
  type GitHubAuthMode,
  type GitHubConnectionState,
  type ProjectCreateStep,
  type ProjectDescriptionMode,
  type SessionAnswer,
} from "./ProjectCreateWizard.types";
import { ProjectCreateStepAiReview } from "./ProjectCreateStepAiReview";
import { ProjectCreateStepDescription } from "./ProjectCreateStepDescription";
import { ProjectCreateStepFinalBrief } from "./ProjectCreateStepFinalBrief";
import { ProjectCreateStepSetup } from "./ProjectCreateStepSetup";
import { buildNextAgentWorkspacePath } from "../../../agent-workspace/utils";

interface ProjectCreateWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (project: ProjectRecord) => void;
}

function extractRepositoryName(value: string): string {
  const cleaned = value.trim().replace(/\.git$/, "");
  const parts = cleaned.split("/").filter(Boolean);
  return parts[parts.length - 1] || "repository";
}

/*
function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
*/

function makeAvatar(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "P";
  const second = words[1]?.[0] ?? words[0]?.[1] ?? "R";
  return `${first}${second}`.toUpperCase();
}

function buildProjectAnalysisPrompt(input: {
  projectName: string;
  repositoryUrl: string;
  accessToken: string;
  sourceMode: GitHubAuthMode;
  description: string;
  documentName: string;
  documentText: string;
  additionalContext: string;
}): string {
  const sections = [
    `Analyze this new project and start the AI engineering workspace for "${input.projectName.trim()}".`,
    "Use the information below as the initial project prompt. Ask focused follow-up questions if anything important is missing before generating code.",
  ];

  const repoValue = input.sourceMode === "repo_url" ? input.repositoryUrl.trim() : input.accessToken.trim();
  if (repoValue) {
    sections.push(`GitHub source (${input.sourceMode === "repo_url" ? "repository URL" : "personal access token"}):\n${repoValue}`);
  }

  if (input.description.trim()) {
    sections.push(`Project description:\n${input.description.trim()}`);
  }

  if (input.documentText.trim()) {
    const documentLabel = input.documentName.trim() || "Uploaded document";
    sections.push(`${documentLabel} text:\n${input.documentText.trim()}`);
  }

  if (input.additionalContext.trim()) {
    sections.push(`Additional context:\n${input.additionalContext.trim()}`);
  }

  return sections.join("\n\n");
}

export function ProjectCreateWizard({ open, onClose, onCreated }: ProjectCreateWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<ProjectCreateStep>(1);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [projectName, setProjectName] = useState("Customer Dashboard Redesign");
  const [projectAvatar, setProjectAvatar] = useState("CD");
  const [sourceMode, setSourceMode] = useState<GitHubAuthMode>("repo_url");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [connectionState, setConnectionState] = useState<GitHubConnectionState>({
    status: "idle",
    message: "",
    repositoryName: "",
  });
  const [descriptionMode, setDescriptionMode] = useState<ProjectDescriptionMode>("write");
  const [description, setDescription] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [autosaveLabel, setAutosaveLabel] = useState("just now");
  const [busy, setBusy] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [reviewTitle, setReviewTitle] = useState("AI Agent Review");
  const [reviewSubtitle, setReviewSubtitle] = useState("The AI Agent is analyzing your project description.");
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [answers, setAnswers] = useState<SessionAnswer[]>([]);
  const [finalBrief, setFinalBrief] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [revisionCount, setRevisionCount] = useState(0);
  const [historyLabels, setHistoryLabels] = useState<string[]>([]);
  const [reviewWordCount, setReviewWordCount] = useState(0);
  const [reviewReadTime, setReviewReadTime] = useState(0);
  const [reviewState, setReviewState] = useState<"loading" | "session" | "ready">("loading");
  const [sessionProgressLabel, setSessionProgressLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reviewSourceLabel, setReviewSourceLabel] = useState<string | null>(null);
  const [documentCharsReceived, setDocumentCharsReceived] = useState(0);

  // const slugPreview = useMemo(() => normalizeSlug(projectName) || "project", [projectName]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setStep(1);
    setCancelConfirmOpen(false);
    setProjectName("Customer Dashboard Redesign");
    setProjectAvatar("CD");
    setSourceMode("repo_url");
    setRepositoryUrl("");
    setAccessToken("");
    setConnectionState({ status: "idle", message: "", repositoryName: "" });
    setDescriptionMode("write");
    setDescription("");
    setDocumentName("");
    setDocumentText("");
    setAdditionalContext("");
    setAutosaveLabel("just now");
    setBusy(false);
    setAnalysisBusy(false);
    setReviewTitle("AI Agent Review");
    setReviewSubtitle("The AI Agent is analyzing your project description.");
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setCurrentAnswer("");
    setAnswers([]);
    setFinalBrief("");
    setRevisionNotes("");
    setFeedbackOpen(false);
    setRevisionCount(0);
    setHistoryLabels([]);
    setReviewWordCount(0);
    setReviewReadTime(0);
    setReviewState("loading");
    setSessionProgressLabel("");
    setErrorMessage(null);
    setReviewSourceLabel(null);
    setDocumentCharsReceived(0);
  }, [open]);

  useEffect(() => {
    setProjectAvatar(makeAvatar(projectName));
  }, [projectName]);

  useEffect(() => {
    const timer = window.setTimeout(() => setAutosaveLabel("just now"), 150);
    return () => window.clearTimeout(timer);
  }, [description, documentText, additionalContext]);

  if (!open) {
    return null;
  }

  const submitReview = async (payloadDescription: string, sessionAnswers: SessionAnswer[] = [], revisionNoteValue = revisionNotes) => {
    setAnalysisBusy(true);
    setErrorMessage(null);

    try {
      const result = await reviewProjectBrief({
        name: projectName,
        description: payloadDescription,
        sourceType: "github",
        repositoryUrl: repositoryUrl.trim() || undefined,
        documentText: documentText || additionalContext || undefined,
        sessionAnswers,
        revisionNotes: revisionNoteValue || undefined,
      });

      if (!result.success) {
        setErrorMessage(result.message || "Unable to review project brief.");
        if (sessionAnswers.length) {
          setReviewState("session");
          setSessionProgressLabel(
            questions.length
              ? `Question ${Math.min(currentQuestionIndex + 1, questions.length)} of ${questions.length}`
              : "",
          );
        } else {
          setReviewState("loading");
        }
        setStep(3);
        return;
      }

      setQuestions(result.questions);
      setReviewWordCount(result.wordCount);
      setReviewReadTime(result.readTimeMinutes);
      setReviewSourceLabel(result.reviewSource === "ai" ? "Questions generated by AI (Gemini)" : "Rule-based fallback (AI unavailable)");
      setDocumentCharsReceived(result.documentCharsReceived ?? 0);
      setFinalBrief(result.refinedBrief);
      setHistoryLabels((current) => (finalBrief ? [`Revision ${current.length + 1}`,...current] : current));

      if (result.needsSession && result.questions.length) {
        setReviewState("session");
        setReviewTitle("A Few Quick Questions");
        setReviewSubtitle("The AI Agent needs a little more detail before finalizing the brief.");
        setCurrentQuestionIndex(0);
        setCurrentAnswer("");
        setAnswers([]);
        setSessionProgressLabel(`Question 1 of ${result.questions.length}`);
        setStep(3);
      } else {
        setReviewState("ready");
        setReviewTitle("Description looks great!");
        setReviewSubtitle("Everything is complete. You can review the compiled brief now.");
        setStep(4);
      }
    } finally {
      setAnalysisBusy(false);
    }
  };

  const handleVerifyConnection = () => {
    setBusy(true);
    setConnectionState({ status: "checking", message: "", repositoryName: "" });

    window.setTimeout(() => {
      const repoValue = sourceMode === "repo_url" ? repositoryUrl.trim() : accessToken.trim();
      if (!repoValue) {
        setConnectionState({ status: "error", message: "Enter a GitHub repository URL or token first.", repositoryName: "" });
        setBusy(false);
        return;
      }

      if (sourceMode === "repo_url" && !repoValue.includes("github.com")) {
        setConnectionState({ status: "error", message: "Only GitHub repositories are supported right now.", repositoryName: "" });
        setBusy(false);
        return;
      }

      setConnectionState({
        status: "success",
        message: `Repository connected: ${extractRepositoryName(repoValue)}`,
        repositoryName: extractRepositoryName(repoValue),
      });
      setBusy(false);
    }, 700);
  };

  const handleAnalyze = async () => {
    const sourceDescription = [description.trim(), additionalContext.trim(), documentText.trim()].filter(Boolean).join("\n\n");
    if (!sourceDescription) {
      setErrorMessage("Add a project description or upload a document before analysis.");
      return;
    }

    setStep(3);
    setReviewState("loading");
    setReviewTitle("Saving project");
    setReviewSubtitle("Your project is being saved before the AI workspace opens.");
    setSessionProgressLabel("");
    setBusy(true);

    try {
      const prompt = buildProjectAnalysisPrompt({
        projectName,
        repositoryUrl,
        accessToken,
        sourceMode,
        description,
        documentName,
        documentText,
        additionalContext,
      });

      const created = await createProject({
        name: projectName.trim(),
        description: sourceDescription,
        sourceType: "github",
        sourceMode,
        repositoryUrl: repositoryUrl.trim() || undefined,
        accessToken: accessToken.trim() || undefined,
        documentText: documentText || undefined,
        brief: sourceDescription,
        startDevelopment: false,
      });

      if (!created.success || !created.project) {
        setErrorMessage(created.message || "Unable to create project.");
        setStep(2);
        return;
      }

      onCreated?.(created.project);

      const sessionId = agentProjectKey(created.project.id);
      const agentUserId = inferAgentUserId(created.project.folderPath);
      setReviewTitle("Opening AI workspace");
      setReviewSubtitle("The project is saved. Sending your prompt to the AI-module workspace.");

      const bootstrap = await bootstrapAgentSession({
        sessionId,
        prompt,
        projectId: created.project.id,
        projectName: created.project.name,
        workingDirectory: created.project.folderPath,
        userId: agentUserId,
      });

      if (!bootstrap.success) {
        setErrorMessage(
          `${bootstrap.message || "Unable to send the prompt to the AI workspace."} Project "${created.project.name}" was saved.`,
        );
        setStep(2);
        return;
      }

      onClose();
      window.open(
        buildAgentWorkspaceUrl({
          projectId: created.project.id,
          projectName: created.project.name,
          sessionId,
          userId: agentUserId,
          autostart: true,
        }),
        "_blank",
        "noopener,noreferrer",
      );
      router.push(`/projects/${created.project.id}?tab=overview`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open the AI workspace.");
      setStep(2);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitAnswer = async () => {
    const question = questions[currentQuestionIndex];
    if (!question || !currentAnswer.trim()) {
      return;
    }

    const nextAnswers = [...answers, { question, answer: currentAnswer.trim() }];
    setAnswers(nextAnswers);
    setCurrentAnswer("");

    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex((value) => value + 1);
      setSessionProgressLabel(`Question ${currentQuestionIndex + 2} of ${questions.length}`);
      return;
    }

    const sourceDescription = [description.trim(), additionalContext.trim(), documentText.trim()].filter(Boolean).join("\n\n");
    setReviewState("loading");
    setReviewTitle("Compiling your brief");
    setReviewSubtitle("The AI Agent is merging your answers into the final project brief.");
    setSessionProgressLabel("");
    setBusy(true);
    await submitReview(sourceDescription, nextAnswers, revisionNotes);
    setBusy(false);
  };

  const handleSendToAi = async () => {
    const sourceDescription = [description.trim(), additionalContext.trim(), documentText.trim()].filter(Boolean).join("\n\n");
    setHistoryLabels((current) => (finalBrief ? [`Revision ${revisionCount + 1}`, ...current] : current));
    setRevisionCount((value) => value + 1);
    setBusy(true);
    await submitReview(sourceDescription, answers, revisionNotes);
    setBusy(false);
    setFeedbackOpen(false);
  };

  const handleApprove = async () => {
    setBusy(true);
    setErrorMessage(null);

    try {
      const payload = {
        name: projectName.trim(),
        description: finalBrief || description.trim(),
        sourceType: "github",
        sourceMode,
        repositoryUrl: repositoryUrl.trim() || undefined,
        accessToken: accessToken.trim() || undefined,
        documentText: documentText || undefined,
        brief: finalBrief || description.trim(),
        sessionAnswers: answers,
        revisionNotes: revisionNotes || undefined,
        startDevelopment: false,
      };

      const created = await createProject(payload);
      if (!created.success || !created.project) {
        setErrorMessage(created.message || "Unable to create project.");
        return;
      }

      onCreated?.(created.project);
      onClose();
      router.push(`/projects/${created.project.id}?tab=overview`);
    } finally {
      setBusy(false);
    }
  };

  const handleRequestCancel = () => {
    setCancelConfirmOpen(true);
  };

  const handleKeepEditing = () => {
    setCancelConfirmOpen(false);
  };

  const handleCancelSetup = () => {
    setCancelConfirmOpen(false);
    onClose();
  };

  const stepStatus: Record<ProjectCreateStep, "incomplete" | "active" | "done"> = {
    1: step > 1 ? "done" : step === 1 ? "active" : "incomplete",
    2: step > 2 ? "done" : step === 2 ? "active" : "incomplete",
    3: step > 3 ? "done" : step === 3 ? "active" : "incomplete",
    4: step === 4 ? "active" : step > 4 ? "done" : "incomplete",
  };

  return (
    <div className="projects-modal-backdrop project-create-backdrop" role="dialog" aria-modal="true" aria-label="Create project wizard">
      <section className="project-create-modal">
        <button type="button" className="project-create-close-btn" aria-label="Close" onClick={handleRequestCancel}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <div className="project-create-stepper" aria-hidden="true">
          {([1, 2, 3, 4] as ProjectCreateStep[]).map((value, index) => (
            <div key={value} className="project-create-stepper-node-wrap">
              <div className={`project-create-stepper-node ${stepStatus[value]}`}>
                {stepStatus[value] === "done" ? (
                  <svg viewBox="0 0 24 24">
                    <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span>{value}</span>
                )}
              </div>
              <span className={`project-create-stepper-label ${stepStatus[value]}`}>{value === 1 ? "Setup" : value === 2 ? "Description" : value === 3 ? "AI Review" : "Final Brief"}</span>
              {index < 3 ? <span className={`project-create-stepper-line ${step > value ? "filled" : ""}`} /> : null}
            </div>
          ))}
        </div>

        {errorMessage ? <p className="project-create-error-banner">{errorMessage}</p> : null}
        {reviewSourceLabel ? (
          <p className="project-create-debug-banner">
            {reviewSourceLabel}
            {documentCharsReceived > 0 ? ` · Document text received: ${documentCharsReceived} characters` : ""}
          </p>
        ) : null}

        {step === 1 ? (
          <ProjectCreateStepSetup
            projectName={projectName}
            projectAvatar={projectAvatar}
            sourceMode={sourceMode}
            repositoryUrl={repositoryUrl}
            accessToken={accessToken}
            connectionState={connectionState}
            onProjectNameChange={setProjectName}
            onProjectAvatarChange={setProjectAvatar}
            onSourceModeChange={setSourceMode}
            onRepositoryUrlChange={setRepositoryUrl}
            onAccessTokenChange={setAccessToken}
            onVerifyConnection={handleVerifyConnection}
            onCancel={handleRequestCancel}
            onContinue={() => setStep(2)}
            busy={busy || analysisBusy}
          />
        ) : null}

        {step === 2 ? (
          <ProjectCreateStepDescription
            descriptionMode={descriptionMode}
            description={description}
            documentName={documentName}
            documentText={documentText}
            additionalContext={additionalContext}
            characterLimit={4000}
            autosaveLabel={autosaveLabel}
            onDescriptionModeChange={setDescriptionMode}
            onDescriptionChange={setDescription}
            onDocumentUpload={async (file) => {
              if (!file) {
                setDocumentName("");
                setDocumentText("");
                return;
              }
              setDocumentName(file.name);
              const lowerName = file.name.toLowerCase();
              const textual =
                lowerName.endsWith(".txt") ||
                lowerName.endsWith(".md") ||
                lowerName.endsWith(".markdown") ||
                file.type.startsWith("text/");
              if (!textual) {
                setErrorMessage("Only plain-text documents (.txt, .md) are supported for AI analysis right now. Paste the content instead.");
                setDocumentText("");
                return;
              }
              const text = await file.text();
              setDocumentText(text);
              setErrorMessage(null);
            }}
            onDocumentTextChange={setDocumentText}
            onAdditionalContextChange={setAdditionalContext}
            onAnalyze={handleAnalyze}
            onBack={() => setStep(1)}
            busy={busy || analysisBusy}
          />
        ) : null}

        {step === 3 ? (
          <ProjectCreateStepAiReview
            mode={reviewState}
            reviewSourceLabel={reviewSourceLabel}
            title={reviewTitle}
            subtitle={reviewSubtitle}
            statusMessage={
              reviewState === "loading" && reviewTitle === "Compiling your brief"
                ? "Please wait — compiling your final brief. Retries run automatically if the AI is busy."
                : "The AI Agent is analyzing your project description."
            }
            progressLabel={sessionProgressLabel}
            questions={questions}
            activeQuestionIndex={currentQuestionIndex}
            currentAnswer={currentAnswer}
            answers={answers}
            onCurrentAnswerChange={setCurrentAnswer}
            onSubmitAnswer={handleSubmitAnswer}
            onContinue={() => setStep(4)}
            onBack={() => setStep(2)}
            busy={busy || analysisBusy}
          />
        ) : null}

        {step === 4 ? (
          <ProjectCreateStepFinalBrief
            projectName={projectName}
            brief={finalBrief || description || "Your compiled project brief will appear here."}
            revisionCount={revisionCount}
            wordCount={reviewWordCount}
            readTimeMinutes={reviewReadTime}
            historyLabels={historyLabels}
            feedback={revisionNotes}
            feedbackOpen={feedbackOpen}
            onFeedbackChange={setRevisionNotes}
            onToggleFeedback={() => setFeedbackOpen((value) => !value)}
            onSendToAi={handleSendToAi}
            onRequestChanges={() => setFeedbackOpen(true)}
            onApprove={handleApprove}
            onBack={() => setStep(3)}
            busy={busy || analysisBusy}
          />
        ) : null}
      </section>

      {cancelConfirmOpen ? (
        <div className="project-create-cancel-overlay" role="presentation" onClick={handleKeepEditing}>
          <div
            className="project-create-cancel-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Cancel project setup?"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="project-create-cancel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 3 2.5 20h19L12 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="16.5" r="1" fill="currentColor" />
              </svg>
            </div>
            <h3>Cancel project setup?</h3>
            <p>Your progress will be lost. This cannot be undone.</p>
            <div className="project-create-cancel-actions">
              <button type="button" className="project-create-cancel-keep-btn" onClick={handleKeepEditing} disabled={busy || analysisBusy}>
                Keep Editing
              </button>
              <button type="button" className="project-create-cancel-confirm-btn" onClick={handleCancelSetup} disabled={busy || analysisBusy}>
                Cancel Setup
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
