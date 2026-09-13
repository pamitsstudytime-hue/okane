import React from 'react';

interface MarkdownNoteProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  inline?: boolean;
}

/**
 * Parses inline markdown tokens:
 * - **bold** or __bold__
 * - *italic* or _italic_
 * - ~~strikethrough~~
 * - `code`
 * - [label](url)
 * - Raw URLs (https://...)
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Regex pattern matching inline markdown tokens
  // 1: Bold (**text** or __text__)
  // 2: Italic (*text* or _text_)
  // 3: Strikethrough (~~text~~)
  // 4: Inline code (`code`)
  // 5: Markdown link [text](url)
  // 6: Raw URL
  const inlineRegex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(~~)(.*?)\5|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Push preceding text
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    const [fullMatch] = match;

    if (match[2] !== undefined) {
      // Bold: **text** or __text__
      elements.push(
        <strong key={`b-${keyIndex++}`} style={{ fontWeight: 700, color: 'inherit' }}>
          {parseInlineMarkdown(match[2])}
        </strong>
      );
    } else if (match[4] !== undefined) {
      // Italic: *text* or _text_
      elements.push(
        <em key={`i-${keyIndex++}`} style={{ fontStyle: 'italic', color: 'inherit' }}>
          {parseInlineMarkdown(match[4])}
        </em>
      );
    } else if (match[6] !== undefined) {
      // Strikethrough: ~~text~~
      elements.push(
        <del key={`s-${keyIndex++}`} style={{ textDecoration: 'line-through', opacity: 0.75 }}>
          {parseInlineMarkdown(match[6])}
        </del>
      );
    } else if (match[7] !== undefined) {
      // Inline code: `code`
      elements.push(
        <code
          key={`c-${keyIndex++}`}
          style={{
            background: 'var(--surface3)',
            padding: '1px 5px',
            borderRadius: 4,
            fontSize: '0.9em',
            fontFamily: 'ui-monospace, monospace',
            border: '1px solid var(--border)',
            color: 'inherit',
          }}
        >
          {match[7]}
        </code>
      );
    } else if (match[8] !== undefined && match[9] !== undefined) {
      // Markdown link: [text](url)
      elements.push(
        <a
          key={`l-${keyIndex++}`}
          href={match[9]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            color: 'var(--accent)',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
        >
          {match[8]}
        </a>
      );
    } else if (match[10] !== undefined) {
      // Raw URL
      elements.push(
        <a
          key={`u-${keyIndex++}`}
          href={match[10]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            color: 'var(--accent)',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
            wordBreak: 'break-all',
          }}
        >
          {match[10]}
        </a>
      );
    } else {
      elements.push(fullMatch);
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
}

/**
 * High-performance, secure, responsive component that formats markdown notes:
 * - Full multi-line & paragraph support (changing lines actually changes line)
 * - Bold, italic, strikethrough, code snippets
 * - Bullet lists, numbered lists, task checklists
 * - Blockquotes and section headers
 */
export function MarkdownNote({ content, className = '', style = {}, inline = false }: MarkdownNoteProps) {
  if (!content || !content.trim()) return null;

  if (inline) {
    return (
      <span
        className={`markdown-note-inline ${className}`}
        style={{
          display: 'inline',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          ...style,
        }}
      >
        {parseInlineMarkdown(content)}
      </span>
    );
  }

  const lines = content.split('\n');

  return (
    <div
      className={`markdown-note-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        lineHeight: 1.5,
        wordBreak: 'break-word',
        ...style,
      }}
    >
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();

        // Empty line (preserves line-spacing between paragraphs)
        if (!trimmed) {
          return <div key={`nl-${idx}`} style={{ height: '6px' }} />;
        }

        // Header 1: # Title
        if (trimmed.startsWith('# ')) {
          return (
            <div
              key={`h1-${idx}`}
              style={{
                fontSize: '1.15em',
                fontWeight: 750,
                color: 'var(--text)',
                marginTop: idx > 0 ? 4 : 0,
                marginBottom: 2,
              }}
            >
              {parseInlineMarkdown(trimmed.substring(2))}
            </div>
          );
        }

        // Header 2: ## Title
        if (trimmed.startsWith('## ')) {
          return (
            <div
              key={`h2-${idx}`}
              style={{
                fontSize: '1.05em',
                fontWeight: 700,
                color: 'var(--text)',
                marginTop: idx > 0 ? 3 : 0,
                marginBottom: 2,
              }}
            >
              {parseInlineMarkdown(trimmed.substring(3))}
            </div>
          );
        }

        // Header 3: ### Title
        if (trimmed.startsWith('### ')) {
          return (
            <div
              key={`h3-${idx}`}
              style={{
                fontSize: '0.95em',
                fontWeight: 700,
                color: 'var(--text)',
                marginTop: idx > 0 ? 2 : 0,
                marginBottom: 1,
              }}
            >
              {parseInlineMarkdown(trimmed.substring(4))}
            </div>
          );
        }

        // Task checklist: - [ ] or - [x]
        const checkMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.*)$/);
        if (checkMatch) {
          const isChecked = checkMatch[1].toLowerCase() === 'x';
          return (
            <div
              key={`chk-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 7,
                paddingLeft: 2,
              }}
            >
              <input
                type="checkbox"
                readOnly
                checked={isChecked}
                style={{
                  marginTop: 3,
                  accentColor: 'var(--accent)',
                  cursor: 'default',
                }}
              />
              <span style={{ textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.75 : 1 }}>
                {parseInlineMarkdown(checkMatch[2])}
              </span>
            </div>
          );
        }

        // Bullet item: - item or * item or • item
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
          const bulletText = trimmed.replace(/^[-*•]\s+/, '');
          return (
            <div
              key={`li-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 7,
                paddingLeft: 2,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: 'var(--text-2)',
                  marginTop: 7,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1 }}>{parseInlineMarkdown(bulletText)}</span>
            </div>
          );
        }

        // Numbered item: 1. item
        const numMatch = trimmed.match(/^(\d+)[.)]\s*(.*)$/);
        if (numMatch) {
          return (
            <div
              key={`num-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
                paddingLeft: 2,
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-2)', flexShrink: 0, fontSize: '0.95em' }}>
                {numMatch[1]}.
              </span>
              <span style={{ flex: 1 }}>{parseInlineMarkdown(numMatch[2])}</span>
            </div>
          );
        }

        // Blockquote: > quote
        if (trimmed.startsWith('> ')) {
          return (
            <div
              key={`bq-${idx}`}
              style={{
                borderLeft: '3px solid var(--accent)',
                paddingLeft: 10,
                margin: '2px 0',
                color: 'var(--text-2)',
                fontStyle: 'italic',
              }}
            >
              {parseInlineMarkdown(trimmed.substring(2))}
            </div>
          );
        }

        // Standard text line
        return (
          <div key={`ln-${idx}`} style={{ whiteSpace: 'pre-wrap' }}>
            {parseInlineMarkdown(rawLine)}
          </div>
        );
      })}
    </div>
  );
}
