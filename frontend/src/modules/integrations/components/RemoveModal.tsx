export function RemoveModal({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="integration-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="integration-modal">
        <div className="integration-modal-icon">X</div>
        <h3>Remove {name}?</h3>
        <p>This will delete your configuration and disable the integration. You will need to reconfigure it to use it again.</p>
        <div className="integration-modal-actions">
          <button type="button" className="integration-button integration-button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="integration-button integration-button--danger" onClick={onConfirm}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
