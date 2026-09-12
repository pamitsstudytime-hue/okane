import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  X,
  SlidersHorizontal,
  Filter,
  RotateCcw,
  Check,
  User,
  Store,
  Tv,
  ArrowUpDown,
  LayoutGrid,
  List,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Handshake,
  Clock,
  Layers,
} from 'lucide-react';
import { showSoftKeyboard } from '../utils/keyboard';
import type { ContactType } from '../types';

export type FriendFilterStatus = 'all' | 'owes_me' | 'i_owe' | 'settled';
export type SortOption = 'owed_desc' | 'owed_asc' | 'name' | 'recent' | 'expenses_count';
export type DensityOption = 'compact' | 'detailed' | 'grid';

interface Props {
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  typeFilter: ContactType;
  setTypeFilter: (t: ContactType) => void;
  statusFilter: FriendFilterStatus;
  setStatusFilter: (s: FriendFilterStatus) => void;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
  density: DensityOption;
  setDensity: (d: DensityOption) => void;
  search: string;
  setSearch: (s: string) => void;
  activeFilterCount: number;
  onClearAll: () => void;
  counts?: {
    all: number;
    friend: number;
    vendor: number;
    subscription: number;
  };
  filteredCount: number;
  friendStats?: unknown;
  vendorAndSubSpend?: unknown;
  currency?: string;
}

export const ContactFilterBar: React.FC<Props> = ({
  showFilters,
  setShowFilters,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  density,
  setDensity,
  search,
  setSearch,
  activeFilterCount,
  onClearAll,
  filteredCount,
}) => {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when filters drawer opens
  useEffect(() => {
    if (showFilters) {
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          showSoftKeyboard(searchInputRef.current, { placeCursorAtEnd: true, scroll: true });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [showFilters]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showFilters) {
        setShowFilters(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFilters, setShowFilters]);

  // Lock body scroll when filters drawer is open
  useEffect(() => {
    if (showFilters) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showFilters]);

  if (!showFilters) return null;

  return createPortal(
    <div
      className="filter-drawer-overlay"
      onClick={e => {
        if (e.target === e.currentTarget) setShowFilters(false);
      }}
    >
      <div className="filter-drawer-panel">
        {/* Mobile Grab Handle */}
        <div
          className="mobile-only"
          style={{
            width: '100%',
            paddingTop: '10px',
            paddingBottom: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--surface)',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '4px',
              borderRadius: '999px',
              backgroundColor: 'var(--text-3)',
              opacity: 0.4,
              margin: '0 auto',
            }}
          />
        </div>

        {/* Drawer Header */}
        <div
          style={{
            padding: '14px 18px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--surface)',
            flexShrink: 0,
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                display: 'grid',
                placeItems: 'center',
                color: 'var(--text)',
                flexShrink: 0,
              }}
            >
              <Filter size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                Filters & Sorting
              </div>
              {activeFilterCount > 0 ? (
                <div style={{ fontSize: '11.5px', color: 'var(--text-3)', fontWeight: 550, marginTop: 2 }}>
                  {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
                </div>
              ) : (
                <div style={{ fontSize: '11.5px', color: 'var(--text-3)', fontWeight: 500, marginTop: 2 }}>
                  Filter contact directory
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                padding: 0,
                transition: 'all 0.15s ease',
              }}
              aria-label="Close filters"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Filter Options */}
        <div
          className="filter-drawer-content no-scrollbar"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Search Input Filter */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
              Search Contact
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 9999,
                padding: '8px 14px',
              }}
            >
              <Search size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by name, nickname, or category..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '12.5px',
                  color: 'var(--text)',
                  width: '100%',
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Contact Type Section */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
              Contact Type
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 4,
                backgroundColor: 'var(--surface2)',
                padding: 3,
                borderRadius: 12,
                border: '1px solid var(--border)',
              }}
            >
              {[
                { id: 'friend' as ContactType, label: 'Friends', icon: <User size={13} /> },
                { id: 'vendor' as ContactType, label: 'Vendors', icon: <Store size={13} /> },
                { id: 'subscription' as ContactType, label: 'Subscriptions', icon: <Tv size={13} /> },
              ].map(tab => {
                const isSelected = typeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTypeFilter(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 4px',
                      borderRadius: 9,
                      border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                      backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                      color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {React.cloneElement(tab.icon, {
                      style: { color: isSelected ? 'var(--accent-contrast)' : 'var(--text-3)' }
                    })}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Financial Status Section (Only for Friends and Vendors) */}
          {(typeFilter === 'friend' || typeFilter === 'vendor') && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
                Financial Status
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {[
                  { id: 'all' as FriendFilterStatus, label: 'All Contacts', icon: <Layers size={13} />, desc: 'Show all balance states' },
                  { id: 'owes_me' as FriendFilterStatus, label: 'Owes You', icon: <ArrowDownLeft size={13} style={{ color: 'var(--credit)' }} />, desc: 'Has outstanding balance' },
                  { id: 'i_owe' as FriendFilterStatus, label: 'You Owe', icon: <ArrowUpRight size={13} style={{ color: 'var(--debit)' }} />, desc: 'You need to pay back' },
                  { id: 'settled' as FriendFilterStatus, label: 'Settled Up', icon: <Handshake size={13} style={{ color: 'var(--text-2)' }} />, desc: 'Zero balance / all clear' },
                ].map(opt => {
                  const isSelected = statusFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setStatusFilter(opt.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 14,
                        backgroundColor: isSelected ? 'var(--accent)' : 'var(--surface2)',
                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                        color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {React.cloneElement(opt.icon, {
                          style: { color: isSelected ? 'var(--accent-contrast)' : opt.icon.props.style?.color }
                        })}
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--accent-contrast)' : 'inherit' }}>
                            {opt.label}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check size={14} style={{ color: 'var(--accent-contrast)', flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sort Order Section */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
              Sort Order
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {[
                ...((typeFilter === 'friend' || typeFilter === 'vendor') ? [
                  { id: 'owed_desc' as SortOption, label: 'Highest Owed', icon: <ArrowDownLeft size={13} style={{ color: 'var(--credit)' }} /> },
                  { id: 'owed_asc' as SortOption, label: 'You Owe Most', icon: <ArrowUpRight size={13} style={{ color: 'var(--debit)' }} /> },
                ] : []),
                { id: 'name' as SortOption, label: 'Name (A to Z)', icon: <ArrowUpDown size={13} /> },
                { id: 'recent' as SortOption, label: 'Recent Activity', icon: <Clock size={13} /> },
                { id: 'expenses_count' as SortOption, label: 'Most Expenses', icon: <Layers size={13} /> },
              ].map(opt => {
                const isSelected = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortBy(opt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 12,
                      backgroundColor: isSelected ? 'var(--accent)' : 'var(--surface2)',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      textAlign: 'left',
                      boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {React.cloneElement(opt.icon, {
                        style: { color: isSelected ? 'var(--accent-contrast)' : opt.icon.props.style?.color || 'var(--text-3)' }
                      })}
                      <span>{opt.label}</span>
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--accent-contrast)', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* View Density / Layout Section */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
              View Layout & Density
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 4,
                backgroundColor: 'var(--surface2)',
                padding: 3,
                borderRadius: 12,
                border: '1px solid var(--border)',
              }}
            >
              {[
                { id: 'compact' as DensityOption, label: 'Compact', icon: <List size={14} /> },
                { id: 'detailed' as DensityOption, label: 'Detailed', icon: <SlidersHorizontal size={14} /> },
                { id: 'grid' as DensityOption, label: 'Grid Cards', icon: <LayoutGrid size={14} /> },
              ].map(opt => {
                const isSelected = density === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDensity(opt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 4px',
                      borderRadius: 9,
                      border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                      backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                      color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {React.cloneElement(opt.icon, {
                      style: { color: isSelected ? 'var(--accent-contrast)' : 'var(--text-3)' }
                    })}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Drawer Sticky Footer: 2 Action Buttons (Clear & Filter) */}
        <div
          style={{
            padding: '12px 18px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: 'var(--surface)',
            flexShrink: 0,
            paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 16px)' : '16px',
          }}
        >
          <button
            type="button"
            onClick={onClearAll}
            disabled={activeFilterCount === 0}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 9999,
              fontSize: '13.5px',
              fontWeight: 650,
              backgroundColor: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: activeFilterCount > 0 ? 'var(--text)' : 'var(--text-3)',
              cursor: activeFilterCount > 0 ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: activeFilterCount > 0 ? 1 : 0.5,
              transition: 'all 0.15s ease',
            }}
          >
            <RotateCcw size={14} />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFilters(false)}
            style={{
              flex: 1.6,
              height: 44,
              borderRadius: 9999,
              fontSize: '13.5px',
              fontWeight: 700,
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
              border: 'none',
              boxShadow: '0 3px 12px var(--accent-soft)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <span>Apply</span>
            <span style={{ fontSize: '12px', opacity: 0.85, fontWeight: 600 }}>({filteredCount})</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ContactFilterBar;
