import React from 'react';
import { Feather, X } from 'lucide-react';
import { MarkdownNote } from './MarkdownNote';

interface NotePreviewCardProps {
  notes: string;
  onEdit: () => void;
  onClear: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Polished, touch-friendly Note Preview Card:
 * - Beautiful soft accent icon badge
 * - Full multi-line & formatted Markdown support
 * - Comfortable 44px+ touch target on mobile
 * - Isolated, high-hit-rate Clear (X) button
 */
export function NotePreviewCard({
  notes,
  onEdit,
  onClear,
  className = '',
  style = {},
}: NotePreviewCardProps) {
  if (!notes || !notes.trim()) return null;

  return (
    <div
      onClick={onEdit}
      className={`note-preview-card ${className}`}
      style={{
        marginTop: 6,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10,
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 13,
        padding: '9px 10px 9px 12px',
        cursor: 'pointer',
        minHeight: 44,
        boxSizing: 'border-box',
        transition: 'all 0.15s ease',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        ...style,
      }}
      title="Click to edit note"
    >
      {/* Left Icon Badge */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.22)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Feather size={14} strokeWidth={2.3} style={{ color: '#0284c7' }} />
      </div>

      {/* Center Note Content - Formatted Markdown */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          fontSize: 12.5,
          color: 'var(--text)',
          lineHeight: 1.45,
          paddingTop: 1,
        }}
      >
        <MarkdownNote
          content={notes}
          style={{
            fontSize: 12.5,
            color: 'var(--text)',
            lineHeight: 1.45,
            gap: 2,
          }}
        />
      </div>

      {/* Right Clear (X) Button with 32x32px touch target */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        style={{
          width: 30,
          height: 30,
          minWidth: 30,
          minHeight: 30,
          borderRadius: 8,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-3)',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface3)';
          e.currentTarget.style.color = 'var(--text)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-3)';
        }}
        title="Remove note"
        aria-label="Remove note"
      >
        <X size={15} strokeWidth={2.2} />
      </button>
    </div>
  );
}
