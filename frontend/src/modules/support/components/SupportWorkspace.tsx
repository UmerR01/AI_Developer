"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkspacePlaceholderShell } from "../../dashboard/components/WorkspacePlaceholderShell";

import {
  createSupportTicket,
  fetchAdminProfile,
  fetchCurrentUser,
  fetchSupportTickets,
  reopenTicket,
  replySupportTicket,
  updateTicketPriority,
  updateTicketStatus,
  uploadTicketAttachment,
} from "../../platform/api";
import type { AdminProfile, SupportTicket } from "../../platform/types";

const CATEGORY_OPTIONS = ["bug_report", "storage_issue", "ai_agent_issue", "billing", "other"];
const PRIORITY_OPTIONS = ["low", "medium", "high"];
const STATUS_OPTIONS = ["open", "under_review", "in_progress", "resolved", "closed"];
const FILTER_OPTIONS = ["all", ...STATUS_OPTIONS] as const;

type FilterOption = (typeof FILTER_OPTIONS)[number];

function prettyLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(size >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function getFileBadge(fileType: string): string {
  const lower = fileType.toLowerCase();
  if (lower.includes("json")) return "json";
  if (lower.includes("image")) return "img";
  if (lower.includes("pdf")) return "pdf";
  if (lower.includes("plain") || lower.includes("text")) return "txt";
  return "file";
}

function categoryChip(category: string) {
  const map: Record<string, { className: string; label: string }> = {
    bug_report: { className: "chip chip-bug", label: "Bug Report" },
    storage_issue: { className: "chip chip-storage", label: "Storage Issue" },
    ai_agent_issue: { className: "chip chip-ai", label: "AI Agent Issue" },
    billing: { className: "chip chip-billing", label: "Billing" },
    other: { className: "chip chip-other", label: "Other" },
  };
  const result = map[category] ?? { className: "chip chip-other", label: prettyLabel(category) };
  return <span className={result.className}>{result.label}</span>;
}

function statusChip(status: string) {
  const classMap: Record<string, string> = {
    open: "sc-open",
    under_review: "sc-review",
    in_progress: "sc-progress",
    resolved: "sc-resolved",
    closed: "sc-closed",
  };
  return <span className={`status-chip ${classMap[status] ?? "sc-open"}`}>{prettyLabel(status)}</span>;
}

function priorityChip(priority: string) {
  const map: Record<string, { cls: string; color: string }> = {
    high:   { cls: "sc-high",   color: "#ff7272" },
    medium: { cls: "sc-progress", color: "#5f85ff" },
    low:    { cls: "sc-closed", color: "#7a93c8" },
  };
  const { cls, color } = map[priority] ?? { cls: "sc-closed", color: "#7a93c8" };
  return (
    <span className={`status-chip ${cls}`} style={priority === "high" ? { background: "rgba(255,114,114,0.15)", color: "#ff7272" } : {}}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", marginRight: 5 }} />
      {prettyLabel(priority)}
    </span>
  );
}

// ── New Ticket Drawer ──────────────────────────────────────────────────────
interface NewTicketDrawerProps {
  busy: boolean;
  onClose: () => void;
  onCreate: (input: { subject: string; category: string; priority: string; description: string; linkedProjectId?: string }) => Promise<void>;
}

function NewTicketDrawer({ busy, onClose, onCreate }: NewTicketDrawerProps) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [priority, setPriority] = useState(PRIORITY_OPTIONS[1]);
  const [linkedProjectId, setLinkedProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    setAttachedFiles((prev) => [...prev, ...Array.from(files)]);
  }

  async function handleSubmit() {
    if (!subject.trim() || !description.trim()) return;
    await onCreate({ subject: subject.trim(), category, priority, description: description.trim(), linkedProjectId: linkedProjectId.trim() || undefined });
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-drawer">
        <div className="modal-header">
          <h3>New Support Ticket</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label className="modal-label">Subject *</label>
            <input className="modal-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of your issue" />
          </div>

          <div className="modal-field-row">
            <div className="modal-field">
              <label className="modal-label">Category *</label>
              <select className="modal-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((item) => <option key={item} value={item}>{prettyLabel(item)}</option>)}
              </select>
            </div>
            <div className="modal-field">
              <label className="modal-label">Priority</label>
              <select className="modal-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY_OPTIONS.map((item) => <option key={item} value={item}>{prettyLabel(item)}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-field">
            <label className="modal-label">Linked Project (optional)</label>
            <input className="modal-input" value={linkedProjectId} onChange={(e) => setLinkedProjectId(e.target.value)} placeholder="Select a project (optional)" />
          </div>

          <div className="modal-field">
            <label className="modal-label">Description *</label>
            <textarea className="modal-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Please describe your issue in detail..." />
          </div>

          <div className="modal-field">
            <label className="modal-label">Attachments (optional)</label>
            <input ref={fileRef} type="file" multiple className="hidden-input" onChange={(e) => addFiles(e.target.files)} />
            <div
              className={`sp-drop-zone${dragOver ? " sp-drop-zone--over" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Drop files here or click to upload
              <span>Images, PDFs, text files supported</span>
            </div>
            {attachedFiles.length > 0 && (
              <div className="sp-attached-files">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="sp-attached-chip">
                    <span>{file.name}</span>
                    <span className="sp-attached-size">{formatFileSize(file.size)}</span>
                    <button type="button" onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))} aria-label="Remove">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={busy || !subject.trim() || !description.trim()}>
            {busy ? "Submitting..." : "Submit Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function SupportWorkspace() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [filter, setFilter] = useState<FilterOption>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTicket = useMemo(() => tickets.find((t) => t.id === selectedId) ?? null, [tickets, selectedId]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const statusMatch = filter === "all" || t.status === filter;
      const text = search.trim().toLowerCase();
      const searchMatch = !text || t.subject.toLowerCase().includes(text) || t.ticketNumber.toLowerCase().includes(text) || t.description.toLowerCase().includes(text);
      return statusMatch && searchMatch;
    });
  }, [tickets, filter, search]);

  const kpi = useMemo(() => {
    const total = { open: 0, under_review: 0, in_progress: 0, resolved: 0 };
    tickets.forEach((t) => { if (t.status in total) total[t.status as keyof typeof total]++; });
    return total;
  }, [tickets]);

  const loadTickets = useCallback(async () => {
    setError(null);
    const currentUser = await fetchCurrentUser();
    if (!currentUser) throw new Error("Unable to resolve current user.");
    const profile = await fetchAdminProfile(currentUser.id);
    const items = await fetchSupportTickets(Boolean(profile?.isAdmin));
    setCurrentUserId(currentUser.id);
    setAdminProfile(profile);
    setTickets(items);
    setSelectedId((previousSelectedId) => {
      if (!previousSelectedId) {
        return previousSelectedId;
      }
      return items.some((ticket) => ticket.id === previousSelectedId) ? previousSelectedId : (items[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      setLoading(true);
      try { await loadTickets(); }
      catch (e) { if (mounted) setError(e instanceof Error ? e.message : "Failed to load support tickets."); }
      finally { if (mounted) setLoading(false); }
    }
    bootstrap();
    return () => { mounted = false; };
  }, [loadTickets]);

  async function handleCreateTicket(input: { subject: string; category: string; priority: string; description: string; linkedProjectId?: string }) {
    try {
      setBusy(true); setError(null);
      const result = await createSupportTicket(input);
      if (!result.success) { setError(result.message); return; }
      setShowCreate(false);
      await loadTickets();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to create ticket."); }
    finally { setBusy(false); }
  }

  async function handleReply() {
    if (!selectedTicket || !replyMessage.trim()) return;
    try {
      setBusy(true); setError(null);
      const result = await replySupportTicket({ ticketId: selectedTicket.id, message: replyMessage.trim(), isInternalNote: internalNote });
      if (!result.success) { setError(result.message); return; }
      setReplyMessage(""); setInternalNote(false);
      await loadTickets();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to send reply."); }
    finally { setBusy(false); }
  }

  async function handleStatusChange(nextStatus: string) {
    if (!selectedTicket) return;
    try {
      setBusy(true); setError(null);
      const result = await updateTicketStatus(selectedTicket.id, nextStatus);
      if (!result.success) { setError(result.message); return; }
      await loadTickets();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to update status."); }
    finally { setBusy(false); }
  }

  async function handlePriorityChange(nextPriority: string) {
    if (!selectedTicket) return;
    try {
      setBusy(true); setError(null);
      const result = await updateTicketPriority(selectedTicket.id, nextPriority);
      if (!result.success) { setError(result.message); return; }
      await loadTickets();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to update priority."); }
    finally { setBusy(false); }
  }

  async function handleReopen() {
    if (!selectedTicket) return;
    try {
      setBusy(true); setError(null);
      const result = await reopenTicket(selectedTicket.id);
      if (!result.success) { setError(result.message); return; }
      await loadTickets();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to reopen ticket."); }
    finally { setBusy(false); }
  }

  async function handleAttachmentUpload(file: File) {
    if (!selectedTicket) return;
    try {
      setBusy(true); setError(null);
      const result = await uploadTicketAttachment({ ticketId: selectedTicket.id, fileName: file.name, filePath: `/${file.name}`, fileSize: file.size || 0, fileType: file.type || "application/octet-stream" });
      if (!result.success) { setError(result.message); return; }
      await loadTickets();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to upload attachment."); }
    finally { setBusy(false); }
  }

  const isTicketClosed = selectedTicket?.status === "resolved" || selectedTicket?.status === "closed";

  // ── TICKET DETAIL ─────────────────────────────────────────────────────────
  if (selectedTicket) {
    return (
      <WorkspacePlaceholderShell title="Support" description="Manage your tickets, system alerts, and agent health." compact>
        <div className="support-ui">
          {error && <p className="support-error">{error}</p>}
          <div className="td-root">

          {/* Breadcrumb */}
          <div className="td-breadcrumb">
            <button type="button" onClick={() => setSelectedId(null)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Support
            </button>
            <span>›</span>
            <strong>{selectedTicket.ticketNumber}</strong>
          </div>

          {/* Topbar */}
          <div className="td-topbar">
            <span className="td-topbar-title">{selectedTicket.subject}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {statusChip(selectedTicket.status)}
              {isTicketClosed && (
                <button type="button" className="btn-primary td-reopen" onClick={handleReopen} disabled={busy}>Reopen Ticket</button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="td-body">

            {/* LEFT: Conversation */}
            <div className="td-convo">
              <div className="td-convo-messages">
                {selectedTicket.replies.length === 0 && <p className="support-muted" style={{ margin: "auto", textAlign: "center" }}>No replies yet.</p>}
                {selectedTicket.replies.map((reply) => {
                  const isMine = Boolean(currentUserId && reply.authorId && reply.authorId === currentUserId);
                  return (
                    <div key={reply.id} className={`msg-row ${isMine ? "mine" : "theirs"}`}>
                      <div className="msg-meta">
                        {isMine ? (
                          <>
                            <span className="msg-time">{formatDateLabel(reply.createdAt)}</span>
                            <span className="msg-you">You</span>
                          </>
                        ) : (
                          <>
                            <div className="msg-avatar">{reply.authorName.slice(0, 2).toUpperCase()}</div>
                            <span className="msg-name">{reply.authorName}</span>
                            <span className="msg-time">{formatDateLabel(reply.createdAt)}</span>
                          </>
                        )}
                      </div>
                      <div className={`msg-bubble ${isMine ? "mine" : "theirs"}`}>
                        {reply.message}
                        {reply.isInternalNote && <small className="support-note">Internal note</small>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply input */}
              {isTicketClosed ? (
                <div className="td-resolved-banner">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
                  This ticket is resolved.
                  <button type="button" className="btn-reopen-inline" onClick={handleReopen} disabled={busy}>Reopen Ticket</button>
                </div>
              ) : (
                <>
                  <div className="td-reply-area">
                    <input ref={fileInputRef} type="file" className="hidden-input" onChange={(e) => { const f = e.target.files?.[0]; if (f) { void handleAttachmentUpload(f); e.target.value = ""; } }} />
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Write a reply..."
                      rows={1}
                      onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; }}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleReply(); }}
                    />
                    <button type="button" className="td-send-btn" title="Send reply" onClick={handleReply} disabled={busy || !replyMessage.trim()}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z"/></svg>
                    </button>
                  </div>
                  {adminProfile?.isAdmin && (
                    <label className="support-check">
                      <input type="checkbox" checked={internalNote} onChange={(e) => setInternalNote(e.target.checked)} />
                      Internal note (admin only)
                    </label>
                  )}
                </>
              )}
            </div>

            {/* RIGHT: Info Panel */}
            <div className="td-info-col">

              {/* Ticket Details */}
              <div className="td-card">
                <h4>Ticket Details</h4>
                <p className="td-card-sub">Manage context and status.</p>

                <div className="td-detail-row">
                  <span className="td-detail-label">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    Status
                  </span>
                  {adminProfile?.isAdmin ? (
                    <select value={selectedTicket.status} onChange={(e) => handleStatusChange(e.target.value)} className="support-select" disabled={busy}>
                      {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{prettyLabel(item)}</option>)}
                    </select>
                  ) : (
                    statusChip(selectedTicket.status)
                  )}
                </div>

                <div className="td-detail-row">
                  <span className="td-detail-label">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                    Priority
                  </span>
                  {adminProfile?.isAdmin ? (
                    <select value={selectedTicket.priority} onChange={(e) => handlePriorityChange(e.target.value)} className="support-select" disabled={busy}>
                      {PRIORITY_OPTIONS.map((item) => <option key={item} value={item}>{prettyLabel(item)}</option>)}
                    </select>
                  ) : (
                    priorityChip(selectedTicket.priority)
                  )}
                </div>

                <div className="td-detail-row">
                  <span className="td-detail-label">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>
                    Category
                  </span>
                  {categoryChip(selectedTicket.category)}
                </div>

                <div className="td-detail-meta">
                  <span className="td-detail-meta-label">Created</span>
                  <span className="td-detail-meta-val">{formatDateLabel(selectedTicket.createdAt)}</span>
                </div>
                <div className="td-detail-meta">
                  <span className="td-detail-meta-label">Last Activity</span>
                  <span className="td-detail-meta-val">{formatDateLabel(selectedTicket.updatedAt)}</span>
                </div>
                {selectedTicket.resolvedAt && (
                  <div className="td-detail-meta">
                    <span className="td-detail-meta-label">Resolved At</span>
                    <span className="td-detail-meta-val">{formatDateLabel(selectedTicket.resolvedAt)}</span>
                  </div>
                )}

                {/* Assigned Agent */}
                <div style={{ marginTop: 14 }}>
                  <p className="td-assigned-label">Assigned Agent</p>
                  <div className="td-assigned-card">
                    <div className="td-assigned-avatar">SS</div>
                    <div>
                      <div className="td-assigned-name">System Support</div>
                      <div className="td-assigned-role">L2 Engineering</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attachments */}
              <div className="td-card">
                <div className="support-row-between">
                  <h4>Attachments</h4>
                  <span className="support-count-pill">{selectedTicket.attachments.length}</span>
                </div>
                {selectedTicket.attachments.length === 0 && <p className="support-muted" style={{ margin: "8px 0 4px" }}>No attachments uploaded.</p>}
                {selectedTicket.attachments.length > 0 ? (
                  <div className="td-attachments-list">
                    {selectedTicket.attachments.map((att) => (
                      <div key={att.id} className="td-attachment-item">
                        <div className={`td-attachment-icon ${getFileBadge(att.fileType)}`}>{getFileBadge(att.fileType).toUpperCase()}</div>
                        <div className="td-attachment-info">
                          <div className="td-attachment-name">{att.fileName}</div>
                          <div className="td-attachment-meta">{formatFileSize(att.fileSize)} · {formatDateLabel(att.createdAt)}</div>
                        </div>
                        <button type="button" className="td-dl-btn" title="Download" aria-label="Download">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="btn-ghost sp-upload-att-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/></svg>
                  Upload Attachment
                </button>
              </div>

              {/* Linked Project */}
              {selectedTicket.linkedProjectId && (
                <div className="td-card">
                  <h4>Linked Project</h4>
                  <div className="td-linked-project">
                    <div className="td-project-avatar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                    </div>
                    <div>
                      <div className="td-project-name">{selectedTicket.linkedProjectName ?? selectedTicket.linkedProjectId}</div>
                      <div className="td-project-sub">View project →</div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
          </div>
        </div>
      </WorkspacePlaceholderShell>
    );
  }

  // ── TICKET LIST ────────────────────────────────────────────────────────────
  return (
    <WorkspacePlaceholderShell title="Support" description="Manage your tickets, system alerts, and agent health." compact>
      <div className="support-ui">
        {error && <p className="support-error" style={{ padding: "0 28px" }}>{error}</p>}
        {loading && <p className="support-muted" style={{ padding: "28px" }}>Loading support queue…</p>}

      {!loading && (
        <div className="sp-root">

          {/* Header: New Ticket button only (title is in topbar) */}
          <div className="sp-action-row">
            <p className="sp-subtitle">Manage your tickets, system alerts, and agent health.</p>
            <button type="button" className="sp-btn-new" onClick={() => setShowCreate(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              New Ticket
            </button>
          </div>

          {/* KPI row */}
          <div className="sp-kpi-row">
            <button type="button" className="sp-kpi-card kpi-open" onClick={() => setFilter("open")}>
              <div className="sp-kpi-label">Open</div>
              <div className="sp-kpi-num">{String(kpi.open).padStart(2, "0")}</div>
              <span className="sp-kpi-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5f85ff" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12h8M12 8v8"/></svg>
              </span>
            </button>
            <button type="button" className="sp-kpi-card kpi-review" onClick={() => setFilter("under_review")}>
              <div className="sp-kpi-label">Under Review</div>
              <div className="sp-kpi-num">{String(kpi.under_review).padStart(2, "0")}</div>
              <span className="sp-kpi-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
              </span>
            </button>
            <button type="button" className="sp-kpi-card kpi-prog" onClick={() => setFilter("in_progress")}>
              <div className="sp-kpi-label">In Progress</div>
              <div className="sp-kpi-num">{String(kpi.in_progress).padStart(2, "0")}</div>
              <span className="sp-kpi-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>
              </span>
            </button>
            <button type="button" className="sp-kpi-card kpi-res" onClick={() => setFilter("resolved")}>
              <div className="sp-kpi-label">Resolved</div>
              <div className="sp-kpi-num">{String(kpi.resolved).padStart(2, "0")}</div>
              <span className="sp-kpi-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>
              </span>
            </button>
          </div>

          {/* Toolbar */}
          <div className="sp-toolbar">
            <div className="sp-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--support-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ticket #, subject, or keywords..." />
            </div>
            <div className="sp-filter-pills">
              {FILTER_OPTIONS.map((item) => (
                <button key={item} type="button" className={`sp-pill ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>
                  {item === "all" ? "All Tickets" : prettyLabel(item)}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th className="align-right">Activity</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} onClick={() => setSelectedId(ticket.id)}>
                    <td><span className="sp-ticket-id">{ticket.ticketNumber}</span></td>
                    <td>
                      <span className={ticket.status === "resolved" || ticket.status === "closed" ? "sp-subject-resolved" : "sp-subject-text"}>
                        {ticket.subject}
                      </span>
                    </td>
                    <td>{categoryChip(ticket.category)}</td>
                    <td>{statusChip(ticket.status)}</td>
                    <td className="align-right">
                      <div className="activity-wrap">
                        <span className="activity-date">{formatDateLabel(ticket.updatedAt)}</span>
                        <span className="activity-badge">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                          {ticket.replies.length}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTickets.length === 0 && (
                  <tr><td colSpan={5} className="sp-empty">No tickets found.</td></tr>
                )}
              </tbody>
            </table>
            <div className="sp-table-footer">
              <span>Showing 1 to {filteredTickets.length} of {filteredTickets.length} entries</span>
              <div className="sp-pages">
                <button type="button" className="sp-page-btn" aria-label="Previous">‹</button>
                <button type="button" className="sp-page-btn sp-page-btn--cur">1</button>
                <button type="button" className="sp-page-btn" aria-label="Next">›</button>
              </div>
            </div>
          </div>

        </div>
      )}

        {showCreate && <NewTicketDrawer busy={busy} onClose={() => setShowCreate(false)} onCreate={handleCreateTicket} />}
      </div>
    </WorkspacePlaceholderShell>
  );
}