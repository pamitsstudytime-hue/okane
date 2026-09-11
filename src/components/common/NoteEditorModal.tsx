import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Trash2 } from 'lucide-react';
import { useBackButtonModal, BackPriority } from '../../utils/backHandler';
import { showSoftKeyboard } from '../../utils/keyboard';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus and open keyboard when note editor opens
  useEffect(() => {
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        showSoftKeyboard(textareaRef.current, { placeCursorAtEnd: true, scroll: true });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  const handleClear = () => {
    setTempNote('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSave = () => {
    onSave((tempNote || '').trim());
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
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 2 }}>
          <div style={{ width: 38, height: 4.5, borderRadius: 999, backgroundColor: 'var(--border2, var(--text-3))', opacity: 0.5 }} />
        </div>

        {/* Modal Header */}
        <div
          style={{
            padding: '14px 20px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              cursor: 'pointer',
              width: 30,
              height: 30,
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              padding: 0,
              transition: 'all 0.15s ease',
            }}
            aria-label="Close note dialog"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Note Input with clean neutral focus border - no accent color */}
          <div style={{ position: 'relative' }}>
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
                background: 'var(--surface2)',
                border: isFocused ? '1px solid var(--border2)' : '1px solid var(--border)',
                borderRadius: 14,
                padding: '12px 14px',
                fontSize: 13.5,
                color: 'var(--text)',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.5,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                boxShadow: isFocused ? '0 0 0 1px var(--border2)' : 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            />
          </div>
        </div>

        {/* Modal Footer - Pill buttons matching Cancel & Record Expense */}
        <div
          style={{
            padding: '8px 20px 18px',
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
