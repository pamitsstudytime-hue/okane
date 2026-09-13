import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Trash2, Eye, PenLine, Bold, Italic, List, ListOrdered, CheckSquare, Code } from 'lucide-react';
import { useBackButtonModal, BackPriority } from '../../utils/backHandler';
import { showSoftKeyboard } from '../../utils/keyboard';
import { MarkdownNote } from './MarkdownNote';

export interface NoteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  initialNote?: string;
  onSave: (note: string) => void;
  placeholder?: string;
  quickTags?: string[];
}

export function NoteEditorModal({
  isOpen,
  onClose,
  title = 'Note',
  initialNote = '',
  onSave,
  placeholder = 'Add optional notes or remarks...',
  quickTags,
}: NoteEditorModalProps) {
  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DIALOG });

  if (!isOpen) return null;

  return createPortal(
    <NoteEditorContent
      key={isOpen ? `open-${initialNote || ''}` : 'closed'}
      onClose={onClose}
      title={title}
      initialNote={initialNote || ''}
      onSave={onSave}
      placeholder={placeholder}
      quickTags={quickTags}
    />,
    document.body
  );
}

interface ContentProps {
  onClose: () => void;
  title: string;
  initialNote: string;
  onSave: (note: string) => void;
  placeholder: string;
  quickTags?: string[];
}

function NoteEditorContent({
  onClose,
  title,
  initialNote = '',
  onSave,
  placeholder,
}: ContentProps) {
  const [tempNote, setTempNote] = useState(initialNote || '');
  const [isFocused, setIsFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus and open keyboard when note editor opens in write mode
  useEffect(() => {
    if (activeTab === 'write') {
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          showSoftKeyboard(textareaRef.current, { placeCursorAtEnd: true, scroll: true });
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  const insertFormatting = (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selected = tempNote.substring(start, end) || defaultPlaceholder;
    const replacement = `${prefix}${selected}${suffix}`;
    const updated = tempNote.substring(0, start) + replacement + tempNote.substring(end);
    setTempNote(updated);

    setTimeout(() => {
      el.focus();
      const cursorStart = start + prefix.length;
      const cursorEnd = cursorStart + selected.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    }, 20);
  };

  const handleClear = () => {
    setTempNote('');
    setActiveTab('write');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSave = () => {
    // Preserve line-breaks while trimming trailing whitespace
    const cleaned = (tempNote || '').replace(/\s+$/, '').replace(/^\s+/, '');
    onSave(cleaned);
    onClose();
  };

  return (
    <div
      className="note-drawer-overlay"
      style={{
        zIndex: 100085,
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="note-drawer-panel"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text)',
        }}
      >
        {/* Mobile handle indicator */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '12px auto 4px', flexShrink: 0 }} />

        {/* Modal Header with refined layout & beautiful segmented pill */}
        <div
          style={{
            padding: '12px 20px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
            {title}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Beautiful iOS/Apple-style segmented control */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 9999,
                padding: 2.5,
                gap: 2,
                boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.03)',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('write')}
                style={{
                  border: 'none',
                  borderRadius: 9999,
                  background: activeTab === 'write' ? 'var(--surface)' : 'transparent',
                  color: activeTab === 'write' ? 'var(--text)' : 'var(--text-3)',
                  fontSize: 12,
                  fontWeight: activeTab === 'write' ? 650 : 500,
                  padding: '4px 11px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  boxShadow: activeTab === 'write' ? '0 1px 3px rgba(0,0,0,0.1), 0 0 0 1px var(--border)' : 'none',
                  transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <PenLine size={12} strokeWidth={activeTab === 'write' ? 2.4 : 1.8} style={{ color: activeTab === 'write' ? 'var(--text)' : 'var(--text-3)' }} />
                <span>Write</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                style={{
                  border: 'none',
                  borderRadius: 9999,
                  background: activeTab === 'preview' ? 'var(--surface)' : 'transparent',
                  color: activeTab === 'preview' ? 'var(--text)' : 'var(--text-3)',
                  fontSize: 12,
                  fontWeight: activeTab === 'preview' ? 650 : 500,
                  padding: '4px 11px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  boxShadow: activeTab === 'preview' ? '0 1px 3px rgba(0,0,0,0.1), 0 0 0 1px var(--border)' : 'none',
                  transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <Eye size={12} strokeWidth={activeTab === 'preview' ? 2.4 : 1.8} style={{ color: activeTab === 'preview' ? 'var(--text)' : 'var(--text-3)' }} />
                <span>Preview</span>
              </button>
            </div>

            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
              }}
              aria-label="Close note dialog"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '0 20px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Note Input / Formatted Preview Card */}
          <div style={{ position: 'relative' }}>
            {activeTab === 'write' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  ref={textareaRef}
                  rows={4}
                  placeholder={placeholder}
                  value={tempNote}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onChange={e => setTempNote(e.target.value)}
                  onKeyDown={e => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                  style={{
                    width: '100%',
                    minHeight: 105,
                    maxHeight: 220,
                    background: 'var(--surface2)',
                    border: isFocused ? '1px solid var(--border2)' : '1px solid var(--border)',
                    borderRadius: 14,
                    padding: '12px 14px',
                    fontSize: 13.5,
                    color: 'var(--text)',
                    outline: 'none',
                    resize: 'none',
                    lineHeight: 1.55,
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    whiteSpace: 'pre-wrap',
                    boxShadow: isFocused ? '0 0 0 1px var(--border2)' : 'none',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                />

                {/* Quick Markdown Formatting Helper Toolbar Card */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '6px 8px',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      overflowX: 'auto',
                      scrollbarWidth: 'none',
                      padding: '2px 0',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => insertFormatting('**', '**', 'bold text')}
                      title="Bold (**text**)"
                      style={{
                        minWidth: 38,
                        height: 36,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 9,
                        padding: '0 10px',
                        fontSize: 13,
                        color: 'var(--text)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        fontWeight: 750,
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <Bold size={14} strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('*', '*', 'italic text')}
                      title="Italic (*text*)"
                      style={{
                        minWidth: 38,
                        height: 36,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 9,
                        padding: '0 10px',
                        fontSize: 13,
                        color: 'var(--text)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        fontStyle: 'italic',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <Italic size={14} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('- ', '', 'List item')}
                      title="Bullet list (- item)"
                      style={{
                        minWidth: 38,
                        height: 36,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 9,
                        padding: '0 10px',
                        fontSize: 13,
                        color: 'var(--text)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <List size={14} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('1. ', '', 'Numbered item')}
                      title="Numbered list (1. item)"
                      style={{
                        minWidth: 38,
                        height: 36,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 9,
                        padding: '0 10px',
                        fontSize: 13,
                        color: 'var(--text)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <ListOrdered size={14} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('- [ ] ', '', 'Task')}
                      title="Checklist item (- [ ] item)"
                      style={{
                        minWidth: 38,
                        height: 36,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 9,
                        padding: '0 10px',
                        fontSize: 13,
                        color: 'var(--text)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <CheckSquare size={14} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('`', '`', 'code')}
                      title="Inline code (`code`)"
                      style={{
                        minWidth: 38,
                        height: 36,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 9,
                        padding: '0 10px',
                        fontSize: 13,
                        color: 'var(--text)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <Code size={14} strokeWidth={2.4} />
                    </button>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-3)',
                      fontWeight: 600,
                      letterSpacing: '0.2px',
                      whiteSpace: 'nowrap',
                      paddingRight: 4,
                    }}
                  >
                    Markdown
                  </span>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setActiveTab('write')}
                style={{
                  width: '100%',
                  minHeight: 135,
                  maxHeight: 240,
                  overflowY: 'auto',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  fontSize: 13.5,
                  color: 'var(--text)',
                  boxSizing: 'border-box',
                  cursor: 'text',
                }}
                title="Click to switch back to editing"
              >
                {tempNote.trim() ? (
                  <MarkdownNote content={tempNote} style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }} />
                ) : (
                  <div
                    style={{
                      height: '100%',
                      minHeight: 105,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      color: 'var(--text-3)',
                      textAlign: 'center',
                      padding: '12px 0',
                    }}
                  >
                    <PenLine size={18} strokeWidth={1.5} style={{ opacity: 0.6 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 500 }}>No note content yet</span>
                    <span style={{ fontSize: 11, opacity: 0.75 }}>Switch to Write tab or click here to start typing</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer - Pill buttons matching Cancel & Record Expense */}
        <div
          style={{
            padding: '4px 20px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <button
            type="button"
            className="btn btn-drawer-cancel"
            onClick={handleClear}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 9999,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontWeight: 700,
              fontSize: 13.5,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <Trash2 size={15} style={{ color: 'var(--text-2)' }} />
            <span>Clear</span>
          </button>
          <button
            type="button"
            className="btn btn-drawer-save-mono"
            onClick={handleSave}
            style={{
              flex: 1.25,
              height: 44,
              borderRadius: 9999,
              background: 'var(--text)',
              color: 'var(--bg)',
              border: 'none',
              fontWeight: 700,
              fontSize: 13.5,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <Check size={16} strokeWidth={2.4} style={{ color: 'var(--bg)' }} />
            <span>Save Note</span>
          </button>
        </div>
      </div>
    </div>
  );
}
