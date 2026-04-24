import { HELPER_TEXT } from "../constants";
import type { IntegrationConfigField } from "../types";

export function IntegrationField({
  field,
  value,
  savedPassword,
  isVisible,
  onToggleVisible,
  onChange,
  onUpdateKey,
}: {
  field: IntegrationConfigField;
  value: string;
  savedPassword: boolean;
  isVisible: boolean;
  onToggleVisible: () => void;
  onChange: (nextValue: string) => void;
  onUpdateKey: () => void;
}) {
  const helper = HELPER_TEXT[field.key];

  if (field.type === "select") {
    return (
      <div className="integration-field">
        <div className="integration-field__header">
          <label className="integration-label" htmlFor={field.key}>
            {field.label}
            {!field.required ? <span className="integration-label__optional">(Optional)</span> : null}
          </label>
        </div>
        <select id={field.key} className="integration-input" value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select one</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <p className="integration-help">{helper ?? (field.required ? "Required field." : "Optional field.")}</p>
      </div>
    );
  }

  if (field.type === "password") {
    return (
      <div className="integration-field">
        <div className="integration-field__header">
          <label className="integration-label" htmlFor={field.key}>
            {field.label}
            {!field.required ? <span className="integration-label__optional">(Optional)</span> : null}
          </label>
          {savedPassword ? <span className="integration-saved-badge">Saved</span> : null}
        </div>
        <div className="integration-input-wrap">
          <input
            id={field.key}
            className="integration-input"
            type={isVisible ? "text" : "password"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={savedPassword && !value ? "********" : field.label}
          />
          <button type="button" className="integration-eye-btn" onClick={onToggleVisible} aria-label="Toggle visibility">
            {isVisible ? "Hide" : "Show"}
          </button>
        </div>
        {savedPassword ? (
          <button type="button" className="integration-link-btn" onClick={onUpdateKey}>
            Update key
          </button>
        ) : null}
        <p className="integration-help">{helper ?? (field.required ? "Required field." : "Optional field.")}</p>
      </div>
    );
  }

  return (
    <div className="integration-field">
      <div className="integration-field__header">
        <label className="integration-label" htmlFor={field.key}>
          {field.label}
          {!field.required ? <span className="integration-label__optional">(Optional)</span> : null}
        </label>
      </div>
      <input id={field.key} className="integration-input" type="text" value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.label} />
      <p className="integration-help">{helper ?? (field.required ? "Required field." : "Optional field.")}</p>
    </div>
  );
}
