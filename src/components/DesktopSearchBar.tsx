import React from 'react';
import { Search } from 'lucide-react';

export type SearchTabName =
  | 'all'
  | 'expenses'
  | 'contacts'
  | 'wallets'
  | 'settlements'
  | 'trips'
  | 'recurring'
  | 'settings';

interface DesktopSearchBarProps {
  placeholder?: string;
  defaultTab?: SearchTabName;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  onOpen?: () => void;
}

function triggerAppSearch(tab?: SearchTabName | string, query?: string) {
  window.dispatchEvent(
    new CustomEvent('app-open-search', {
      detail: { tab, query: query ?? '' }
    })
  );
}

export const DesktopSearchBar: React.FC<DesktopSearchBarProps> = ({
  placeholder = 'Search expenses, contacts, wallets...',
  defaultTab,
  className = '',
  style,
  id,
  onOpen,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpen) {
      onOpen();
    } else {
      triggerAppSearch(defaultTab);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onOpen) {
        onOpen();
      } else {
        triggerAppSearch(defaultTab);
      }
    }
  };

  return (
    <button
      type="button"
      id={id}
      className={`desktop-search-pill desktop-only ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={style}
      title="Search"
      aria-label="Search"
    >
      <div className="desktop-search-pill-icon">
        <Search size={16} strokeWidth={2} />
      </div>
      <span className="desktop-search-pill-text">
        {placeholder}
      </span>
    </button>
  );
};

export default DesktopSearchBar;
