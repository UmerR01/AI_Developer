interface ProjectCreateStepAiReviewProps {
  mode: "loading" | "session" | "ready";
  title: string;
  subtitle: string;
  statusMessage: string;
  progressLabel?: string;
  questions: string[];
  activeQuestionIndex: number;
  currentAnswer: string;
  answers: Array<{ question: string; answer: string }>;
  onCurrentAnswerChange: (value: string) => void;
  onSubmitAnswer: () => void;
  onContinue: () => void;
  onBack: () => void;
  busy: boolean;
}

function BotIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 2h6v2H9zM7 6h10a3 3 0 0 1 3 3v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9a3 3 0 0 1 3-3Z" fill="currentColor" />
      <circle cx="10" cy="12" r="1" fill="#020713" />
      <circle cx="14" cy="12" r="1" fill="#020713" />
    </svg>
  );
}

export function ProjectCreateStepAiReview({
  mode,
  title,
  subtitle,
  statusMessage,
  progressLabel,
  questions,
  activeQuestionIndex,
  currentAnswer,
  answers,
  onCurrentAnswerChange,
  onSubmitAnswer,
  onContinue,
  onBack,
  busy,
}: ProjectCreateStepAiReviewProps) {
  if (mode === "loading") {
    return (
      <div className="project-create-step project-create-step--centered">
        <div className="project-create-bot-pulse">
          <BotIcon />
        </div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
        <div className="project-create-progress-bar" aria-hidden="true">
          <span />
        </div>
        <small>{statusMessage}</small>
      </div>
    );
  }

  if (mode === "ready") {
    return (
      <div className="project-create-step project-create-step--centered">
        <div className="project-create-success-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="project-create-success-title">Description looks great!</h3>
        <p className="project-create-success-copy">{subtitle}</p>
        <div className="project-create-footer project-create-footer--stacked">
          <button type="button" className="project-create-secondary-btn" onClick={onBack} disabled={busy}>
            ← Back
          </button>
          <button type="button" className="project-create-primary-btn" onClick={onContinue} disabled={busy}>
            Continue to Review →
          </button>
        </div>
      </div>
    );
  }

  const question = questions[activeQuestionIndex] ?? "";

  return (
    <div className="project-create-step">
      <header className="project-create-header project-create-header--split">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {progressLabel ? <span className="project-create-progress-label">{progressLabel}</span> : null}
      </header>

      <div className="project-create-chat">
        <div className="project-create-bubble project-create-bubble--ai">
          <span className="project-create-bubble-meta">AI Agent</span>
          <p>{question}</p>
        </div>

        {answers.map((answer) => (
          <div key={answer.question} className="project-create-bubble project-create-bubble--user">
            <p>{answer.answer}</p>
          </div>
        ))}
      </div>

      <label className="project-create-field">
        <span>{question || "Your answer"}</span>
        <textarea
          className="project-create-textarea project-create-textarea--compact"
          value={currentAnswer}
          onChange={(event) => onCurrentAnswerChange(event.target.value)}
          placeholder="Type the missing detail the AI Agent asked for..."
        />
      </label>

      <footer className="project-create-footer">
        <button type="button" className="project-create-secondary-btn" onClick={onBack} disabled={busy}>
          ← Back
        </button>
        <button type="button" className="project-create-secondary-btn" onClick={onSubmitAnswer} disabled={busy || !currentAnswer.trim()}>
          Submit Answer
        </button>
      </footer>
    </div>
  );
}
