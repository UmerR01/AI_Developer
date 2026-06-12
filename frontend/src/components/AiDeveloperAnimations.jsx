
import React from "react";

const files = [
  ["JSX", "App.jsx"],
  ["JS", "server.js"],
  ["JS", "routes.js"],
  ["JSON", "package.json"],
];

function Cursor({ className = "" }) {
  return (
    <div className={`aid-pointer ${className}`}>
      <svg viewBox="0 0 52 68" aria-hidden="true">
        <path d="M5 4v52l15-14 10 23 13-6-10-22h20L5 4z" />
      </svg>
    </div>
  );
}

export function AiDeveloperScene1CreateProject() {
  return (
    <div className="aid-anim aid-scene-1">
      <div className="aid-card">
        <div className="aid-brand">AI-Developer</div>
        <button className="aid-create-btn" type="button">Create Project</button>
        <div className="aid-copy">
          <span className="kicker">Workspace</span>
          <h3>Create your next AI project</h3>
          <p>Generate apps, APIs and workflows with AI.</p>
        </div>
        <Cursor className="scene1-pointer" />
      </div>
    </div>
  );
}

export function AiDeveloperScene2ChatTyping() {
  return (
    <div className="aid-anim aid-scene-2">
      <div className="aid-card">
        <div className="aid-chat-head">
          <div>
            <h3>AI Assistant</h3>
            <p>Intelligent development partner</p>
          </div>
        </div>

        <div className="aid-message-group">
          <div className="aid-sent-message">Build me a full-stack web app.</div>
          <div className="aid-thinking"><span /><span /><span /></div>
        </div>

        <div className="aid-input">
          <div className="aid-typing-mask">
            <div className="aid-typing-wrap">
              <span className="aid-typing">Build me a full-stack web app.</span>
              <span className="aid-inline-caret" />
            </div>
          </div>
          <button className="aid-send-btn" type="button" aria-label="Send">↑</button>
        </div>

        <Cursor className="scene2-pointer" />
      </div>
    </div>
  );
}

export function AiDeveloperScene3FileGeneration() {
  return (
    <div className="aid-anim aid-scene-3">
      <div className="aid-card">
        <div className="aid-files-head">
          <div>
            <h3>Generating files...</h3>
            <p>AI is creating your project structure.</p>
          </div>
          <div className="aid-files-badge">4 / 4 done</div>
        </div>
        <div className="aid-file-list">
          {files.map(([type, name], index) => (
            <div className={`aid-file-row row-${index + 1}`} key={name}>
              <span className="aid-file-icon">{type}</span>
              <span className="aid-file-name">{name}</span>
              <span className="aid-file-check">&#10003;</span>
            </div>
          ))}
        </div>
        <div className="aid-progress">
          <div className="aid-status">
            <span className="s1">Creating App.jsx...</span>
            <span className="s2">Creating server.js...</span>
            <span className="s3">Creating routes.js...</span>
            <span className="s4">Creating package.json...</span>
            <span className="s5">All files generated.</span>
          </div>
          <div className="aid-track"><div className="aid-fill" /></div>
        </div>
      </div>
    </div>
  );
}

export default function AiDeveloperAnimationShowcase() {
  return (
    <section className="aid-showcase">
      <div className="aid-grid">
        <article>
          <AiDeveloperScene1CreateProject />
          <h4>01. Create Project</h4>
        </article>
        <article>
          <AiDeveloperScene2ChatTyping />
          <h4>02. Tell AI what to build</h4>
        </article>
        <article>
          <AiDeveloperScene3FileGeneration />
          <h4>03. Files generated</h4>
        </article>
      </div>
    </section>
  );
}
