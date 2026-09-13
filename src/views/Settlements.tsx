import { useState, useMemo, useEffect, useRef } from 'react';
import {
  RotateCcw,
  Handshake,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Calendar,
  Search,
  X,
  SlidersHorizontal,
  Store,
  Tv,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { useStore } from '../store';
import type { Friend, Settlement, Expense } from '../types';
import { friendBalance, todayISO, unsettledExpensesForFriend } from '../db';
import { fmtMoney, friendInitial, getAvatarStyle } from '../utils';
import SettleModal from '../components/SettleModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SettlementDetailModal from '../components/SettlementDetailModal';
import SettlementFilterDrawer from '../components/SettlementFilterDrawer';
import DesktopSearchBar from '../components/DesktopSearchBar';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useScrollMargin } from '../hooks/useScrollMargin';
import { SettlementCompactCard } from '../components/settlements/SettlementCompactCard';

export type SettlementTimeframe = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all';

export default function Settlements({ initialArg }: { initialArg?: string; onClearViewArg?: () => void }) {
  const { db, deleteSettlement, showToast } = useStore();
  const settlements = useMemo(() => db?.settlements || [], [db?.settlements]);
  const settings = db?.settings || {};
  const currency = settings?.currency || 'INR';
  const friends = useMemo(() => db?.friends || [], [db?.friends]);
  const expenses = useMemo(() => db?.expenses || [], [db?.expenses]);
  const wallets = useMemo(() => db?.wallets || [], [db?.wallets]);

  const [settleFriend, setSettleFriend] = useState<Friend | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [detailSettlement, setDetailSettlement] = useState<Settlement | null>(null);

  // Timeframe, Search & Filter State
  const [timeframe, setTimeframe] = useState<SettlementTimeframe>('this_month');
  const [searchQuery, setSearchQuery] = useState('');
  const [friendFilter, setFriendFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'received' | 'paid'>('all');

  const handledArgRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialArg) {
      handledArgRef.current = null;
      return;
    }
    if (handledArgRef.current === initialArg) return;
    handledArgRef.current = initialArg;

    const timer = setTimeout(() => {
      const foundS = settlements.find(s => s.id === initialArg);
      if (foundS) {
        setTimeframe('all');
        setDetailSettlement(foundS);
      } else {
        const foundF = friends.find(f => f.id === initialArg);
        if (foundF) {
          setFriendFilter(foundF.id);
        } else {
          setSearchQuery(initialArg);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [initialArg, settlements, friends]);
  const [showFilterDrawer, setShowFilterDrawer] = useState<boolean>(false);
  const [isPendingExpanded, setIsPendingExpanded] = useState<boolean>(true);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== 'all') count++;
    if (friendFilter !== 'all') count++;
    if (timeframe !== 'this_month') count++;
    return count;
  }, [typeFilter, friendFilter, timeframe]);

  // Listen for top bar filter button trigger
  useEffect(() => {
    const handleOpenFilters = () => {
      setShowFilterDrawer(true);
    };
    window.addEventListener('app-open-filters', handleOpenFilters);
    return () => window.removeEventListener('app-open-filters', handleOpenFilters);
  }, []);

  // Sync active filter count with top bar
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('app-filter-count-update', {
      detail: { view: 'settlements', count: activeFilterCount }
    }));
  }, [activeFilterCount]);

  const handleResetFilters = () => {
    setTypeFilter('all');
    setFriendFilter('all');
    setTimeframe('this_month');
  };

  const targetS = settlements.find(x => x && x.id === delId);
  const targetF = targetS ? friends.find(f => f && f.id === targetS.friendId) : null;
  const targetW = targetS?.walletId ? wallets.find(w => w && w.id === targetS.walletId) : null;
  const targetWName = targetW?.name || targetS?.paymentMethod || 'wallet';

  const friendsWithUnsettled = useMemo(() => {
    const friendMap = new Map<string, typeof friends[0]>();
    (friends || []).forEach(f => {
      if (f && f.id) friendMap.set(String(f.id).trim(), f);
    });

    (db?.expenses || []).forEach(e => {
      const fId = e.friendId ? String(e.friendId).trim() : '';
      const vId = e.vendorId ? String(e.vendorId).trim() : '';
      if (fId && !friendMap.has(fId)) {
        friendMap.set(fId, {
          id: fId,
          name: 'Contact',
          notes: '',
          color: '#6366f1',
          createdAt: e.createdAt || 0,
          type: 'friend',
        });
      }
      if (vId && !friendMap.has(vId)) {
        friendMap.set(vId, {
          id: vId,
          name: 'Vendor',
          notes: '',
          color: '#f59e0b',
          createdAt: e.createdAt || 0,
          type: 'vendor',
        });
      }
    });

    return Array.from(friendMap.values()).filter(f => f && unsettledExpensesForFriend(db, f.id).length > 0);
  }, [friends, db]);

  const sorted = useMemo(
    () => [...settlements].filter(Boolean).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)),
    [settlements]
  );

  // Filter settlements by selected Timeframe (Default: Current Month)
  const timeframeFiltered = useMemo(() => {
    if (timeframe === 'all') return sorted;

    const today = todayISO();
    const curMonth = today.slice(0, 7);
    const curYear = today.slice(0, 4);

    if (timeframe === 'today') {
      return sorted.filter(s => s && s.date === today);
    }

    if (timeframe === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yesterday = d.toISOString().slice(0, 10);
      return sorted.filter(s => s && s.date === yesterday);
    }

    if (timeframe === 'this_week') {
      const now = new Date();
      const day = now.getDay();
      const diffToMon = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMon);
      const weekStart = monday.toISOString().slice(0, 10);
      return sorted.filter(s => s && s.date && s.date >= weekStart && s.date <= today);
    }

    if (timeframe === 'this_month') {
      return sorted.filter(s => s && s.date && s.date.slice(0, 7) === curMonth);
    }

    if (timeframe === 'last_month') {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      const lastMonth = d.toISOString().slice(0, 7);
      return sorted.filter(s => s && s.date && s.date.slice(0, 7) === lastMonth);
    }

    if (timeframe === 'last_3_months') {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      const threeMonthsAgo = d.toISOString().slice(0, 10);
      return sorted.filter(s => s && s.date && s.date >= threeMonthsAgo);
    }

    if (timeframe === 'this_year') {
      return sorted.filter(s => s && s.date && s.date.slice(0, 4) === curYear);
    }

    return sorted;
  }, [sorted, timeframe]);

  // Pre-calculate mapped settled expenses per settlement for fast lookup
  const settlementExpensesMap = useMemo(() => {
    const map: Record<string, Expense[]> = {};
    const expById = new Map(expenses.filter(Boolean).map(e => [e.id, e]));

    sorted.forEach(s => {
      if (!s) return;
      const idsSet = new Set(Array.isArray(s.expenseIds) ? s.expenseIds : []);
      const matched = expenses.filter(e => e && (idsSet.has(e.id) || (e.settlementId && e.settlementId === s.id) || (e.vendorSettlementId && e.vendorSettlementId === s.id)));
      
      // Fallback: if ids match from expById directly
      if (matched.length === 0 && Array.isArray(s.expenseIds)) {
        s.expenseIds.forEach(id => {
          const exp = expById.get(id);
          if (exp) matched.push(exp);
        });
      }
      map[s.id] = matched;
    });
    return map;
  }, [sorted, expenses]);

  // Friends who have settlements in the current timeframe
  const timeframeFriends = useMemo(() => {
    const map = new Map<string, { friend: Friend; count: number }>();
    timeframeFiltered.forEach(s => {
      if (!s || !s.friendId) return;
      const f = friends.find(fr => fr && fr.id === s.friendId);
      if (f) {
        const existing = map.get(f.id);
        if (existing) existing.count += 1;
        else map.set(f.id, { friend: f, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [timeframeFiltered, friends]);

  // Overall KPI Summary for selected Timeframe
  const kpiSummary = useMemo(() => {
    let received = 0;
    let paid = 0;
    timeframeFiltered.forEach(s => {
      if (!s) return;
      const amt = Number(s.amount) || 0;
      if (amt >= 0) received += amt;
      else paid += Math.abs(amt);
    });
    return { received, paid, net: received - paid, totalCount: timeframeFiltered.length };
  }, [timeframeFiltered]);

  // Filtered settlements list
  const filteredSettlements = useMemo(() => {
    return timeframeFiltered.filter(s => {
      if (!s) return false;
      const friend = friends.find(f => f && f.id === s.friendId);
      const friendName = (friend?.name || '').toLowerCase();
      const isReceived = (Number(s.amount) || 0) >= 0;

      // Friend filter
      if (friendFilter !== 'all' && s.friendId !== friendFilter) return false;

      // Type filter
      if (typeFilter === 'received' && !isReceived) return false;
      if (typeFilter === 'paid' && isReceived) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesFriend = friendName.includes(q);
        const matchesNote = (s.note || '').toLowerCase().includes(q);
        const matchesMethod = (s.paymentMethod || '').toLowerCase().includes(q);
        const matchedExpenses = settlementExpensesMap[s.id] || [];
        const matchesExpenses = matchedExpenses.some(
          e => (e?.description || '').toLowerCase().includes(q) || (e?.category || '').toLowerCase().includes(q)
        );

        if (!matchesFriend && !matchesNote && !matchesMethod && !matchesExpenses) {
          return false;
        }
      }

      return true;
    });
  }, [timeframeFiltered, friendFilter, typeFilter, searchQuery, friends, settlementExpensesMap]);

  // Virtualization setup for Settlement History
  const friendsMap = useMemo(() => new Map(friends.map(f => [f.id, f])), [friends]);
  const walletsMap = useMemo(() => new Map(wallets.map(w => [w.id, w])), [wallets]);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const updateWidth = () => {
      setContainerWidth(el.getBoundingClientRect().width);
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [filteredSettlements.length]);

  const numColumns = containerWidth >= 640 ? 2 : 1;

  const rows = useMemo(() => {
    const result: Settlement[][] = [];
    for (let i = 0; i < filteredSettlements.length; i += numColumns) {
      result.push(filteredSettlements.slice(i, i + numColumns));
    }
    return result;
  }, [filteredSettlements, numColumns]);

  const scrollMargin = useScrollMargin(listContainerRef, [timeframe, friendFilter, typeFilter, searchQuery]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listContainerRef.current?.closest<HTMLElement>('.main-content') || document.querySelector<HTMLElement>('.main-content'),
    estimateSize: () => 58,
    overscan: 4,
    scrollMargin,
    gap: 12,
    paddingEnd: 24,
  });

  const handleDelete = (id: string) => {
    deleteSettlement(id);
    setDelId(null);
    showToast('Settlement undone. Money restored to wallet.');
  };

  return (
    <div className="view-container">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Settlements</h1>
        </div>
        <div className="desktop-search-filter-wrap desktop-only">
          <DesktopSearchBar placeholder="Search settlements, debts..." defaultTab="settlements" />
          <button
            type="button"
            id="desktop-filter-settlement-btn"
            className={`btn btn-secondary ${activeFilterCount > 0 ? 'active' : ''}`}
            onClick={() => setShowFilterDrawer(true)}
            title={activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}` : 'Filter settlements'}
            aria-label="Filter settlements"
            style={{
              width: 40,
              height: 40,
              padding: 0,
              borderRadius: '9999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexShrink: 0,
              background: activeFilterCount > 0 ? 'var(--surface2)' : undefined,
              borderColor: activeFilterCount > 0 ? 'var(--border2)' : undefined,
              color: 'var(--text)',
            }}
          >
            <Filter size={17} strokeWidth={2} />
            {activeFilterCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 999,
                  background: 'var(--text)',
                  color: 'var(--surface)',
                  fontSize: 10,
                  fontWeight: 750,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Pending settlements section */}
      {friendsWithUnsettled.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 18,
            padding: '12px 14px',
            borderRadius: 14,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div
            onClick={() => setIsPendingExpanded(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: isPendingExpanded ? 10 : 0,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Handshake size={16} strokeWidth={2.2} />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.1px' }}>
                Pending Settlements
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  background: 'var(--accent-soft)',
                  padding: '1px 7px',
                  borderRadius: 999,
                  minWidth: 18,
                  textAlign: 'center',
                  lineHeight: 1.4,
                }}
              >
                {friendsWithUnsettled.length}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: 2, width: 26, height: 26, borderRadius: 6, color: 'var(--text-3)' }}
              onClick={(e) => {
                e.stopPropagation();
                setIsPendingExpanded(prev => !prev);
              }}
              title={isPendingExpanded ? "Collapse pending settlements" : "Expand pending settlements"}
            >
              {isPendingExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {isPendingExpanded && (
            <div className="pending-settlements-desktop-grid">
              {friendsWithUnsettled.map((f, idx) => {
                if (!f) return null;
                const unsettledCount = unsettledExpensesForFriend(db, f.id).length;
                const bal = friendBalance(db, f.id) || { net: 0 };
                const netVal = bal.net || 0;
                const owesYou = netVal > 0.004;
                const youOwe = netVal < -0.004;

                return (
                  <div
                    key={`${f.id}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '8px 12px',
                      background: 'var(--surface2)',
                      borderRadius: 11,
                      border: '1px solid var(--border)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <div
                        className="avatar"
                        style={{
                          ...getAvatarStyle(f.color),
                          width: 34,
                          height: 34,
                          fontSize: 12.5,
                          fontWeight: 700,
                          borderRadius: '50%',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {f.type === 'vendor' ? <Store size={15} /> : f.type === 'subscription' ? <Tv size={15} /> : friendInitial(f.name, f.avatarNumber)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 13.5,
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.2,
                          }}
                        >
                          {f.name || 'Friend'}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4.5,
                            flexWrap: 'nowrap',
                            overflow: 'hidden',
                            marginTop: 2,
                          }}
                        >
                          {youOwe ? (
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: 'var(--debit)',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2.5,
                              }}
                            >
                              <ArrowUpRight size={11.5} strokeWidth={2.6} /> {fmtMoney(Math.abs(netVal), currency)}
                            </span>
                          ) : owesYou ? (
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: 'var(--credit)',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2.5,
                              }}
                            >
                              <ArrowDownLeft size={11.5} strokeWidth={2.6} /> {fmtMoney(netVal, currency)}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                              Net 0
                            </span>
                          )}
                          <span style={{ fontSize: 10.5, color: 'var(--text-3)', opacity: 0.5 }}>•</span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            {unsettledCount} unsettled
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{
                        fontSize: 12,
                        fontWeight: 650,
                        padding: '4px 12px',
                        borderRadius: 8,
                        gap: 4,
                        background: 'var(--accent-gradient)',
                        color: 'var(--accent-contrast, #ffffff)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        height: 28,
                        boxShadow: '0 1px 4px var(--accent-shadow, rgba(225, 29, 72, 0.2))',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={() => setSettleFriend(f)}
                    >
                      <Handshake size={13} strokeWidth={2.2} /> Settle
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* History Card Container */}
      <div className="card" style={{ padding: 0, borderRadius: 16, overflow: 'hidden' }}>
        {/* Header */}
        <div className="settlement-history-header">
          <div className="settlement-history-title-wrap">
            <div className="settlement-history-icon">
              <Clock size={16} strokeWidth={2.2} />
            </div>
            <h2 className="settlement-history-title">
              Settlement History
            </h2>
            <span className="settlement-count-badge">
              {filteredSettlements.length}
            </span>
          </div>

          {/* Timeframe Date Filter Button on Right Side */}
          <div className="settlement-timeframe-btn-wrap" title="Filter timeframe">
            <Calendar size={13.5} strokeWidth={2.2} className="timeframe-icon" />
            <span className="timeframe-label">
              {timeframe === 'today'
                ? 'Today'
                : timeframe === 'yesterday'
                ? 'Yesterday'
                : timeframe === 'this_week'
                ? 'This Week'
                : timeframe === 'this_month'
                ? 'This Month'
                : timeframe === 'last_month'
                ? 'Last Month'
                : timeframe === 'last_3_months'
                ? 'Last 3M'
                : timeframe === 'this_year'
                ? 'This Year'
                : 'All Time'}
            </span>
            <ChevronDown size={11} className="timeframe-chevron" />
            <select
              value={timeframe}
              onChange={e => setTimeframe(e.target.value as SettlementTimeframe)}
              className="settlement-timeframe-select"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_3_months">Last 3 Months</option>
              <option value="this_year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Summary KPI Cards inside History section */}
        {sorted.length > 0 && (
          <div className="settlement-section-padding">
            {/* 3 KPI Columns in 1 Unified Rounded Strip */}
            <div className="settlement-stats-grid">
              <div className="settlement-stat-card">
                <div className="settlement-stat-content">
                  <div className="settlement-stat-label">Received</div>
                  <div className="settlement-stat-value credit">
                    +{fmtMoney(kpiSummary.received, currency)}
                  </div>
                </div>
              </div>

              <div className="settlement-stat-card">
                <div className="settlement-stat-content">
                  <div className="settlement-stat-label">Paid</div>
                  <div className="settlement-stat-value debit">
                    -{fmtMoney(kpiSummary.paid, currency)}
                  </div>
                </div>
              </div>

              <div className="settlement-stat-card">
                <div className="settlement-stat-content">
                  <div className="settlement-stat-label">Net Flow</div>
                  <div className={`settlement-stat-value ${kpiSummary.net >= 0 ? 'credit' : 'debit'}`}>
                    {kpiSummary.net >= 0 ? '+' : '-'}{fmtMoney(Math.abs(kpiSummary.net), currency)}
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filter Row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Search Input */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '0 10px',
                    height: 38,
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <Search size={15} style={{ color: 'var(--text-3)', marginRight: 8, flexShrink: 0 }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search settlements by friend, note, wallet, or expense..."
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 13,
                      color: 'var(--text)',
                      padding: '5px 0',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-3)',
                        cursor: 'pointer',
                        padding: 3,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                      title="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Filter Drawer Button on Right */}
                <button
                  type="button"
                  onClick={() => setShowFilterDrawer(true)}
                  style={{
                    height: 38,
                    padding: activeFilterCount > 0 ? '0 12px' : '0 11px',
                    borderRadius: 10,
                    border: activeFilterCount > 0 ? '1px solid var(--border2)' : '1px solid var(--border)',
                    backgroundColor: activeFilterCount > 0 ? 'var(--surface)' : 'var(--surface2)',
                    color: activeFilterCount > 0 ? 'var(--text)' : 'var(--text-2)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                    boxShadow: activeFilterCount > 0 ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                  }}
                  title="Filter settlements"
                >
                  <SlidersHorizontal size={15} strokeWidth={2.2} />
                  {activeFilterCount > 0 && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 750,
                        minWidth: 17,
                        height: 17,
                        padding: '0 4.5px',
                        borderRadius: 99,
                        backgroundColor: 'var(--text)',
                        color: 'var(--surface)',
                        display: 'grid',
                        placeItems: 'center',
                        lineHeight: 1,
                      }}
                    >
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Active Filter Chips Bar (if active filters exist) */}
              {activeFilterCount > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    padding: '2px 0',
                  }}
                  className="no-scrollbar"
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginRight: 2 }}>
                    Filtered:
                  </span>

                  {friendFilter !== 'all' && (
                    <span className="app-filter-chip">
                      <span className="app-filter-chip-label">Friend:</span>
                      <span className="app-filter-chip-value">{friends.find(f => f.id === friendFilter)?.name || 'Friend'}</span>
                      <button
                        type="button"
                        onClick={() => setFriendFilter('all')}
                        className="app-filter-chip-remove"
                        title="Clear friend filter"
                        aria-label="Clear friend filter"
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </span>
                  )}

                  {typeFilter !== 'all' && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 99,
                        backgroundColor: typeFilter === 'received' ? 'var(--credit-bg)' : 'var(--debit-bg)',
                        border: `1px solid ${typeFilter === 'received' ? 'var(--credit-border, rgba(74,222,128,0.3))' : 'var(--debit-border, rgba(248,113,113,0.3))'}`,
                        color: typeFilter === 'received' ? 'var(--credit)' : 'var(--debit)',
                        fontSize: 11.5,
                        fontWeight: 600,
                      }}
                    >
                      <span>{typeFilter === 'received' ? 'Received' : 'Paid'}</span>
                      <button
                        type="button"
                        onClick={() => setTypeFilter('all')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'inherit',
                          cursor: 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          padding: 0,
                        }}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )}

                  {timeframe !== 'this_month' && (
                    <span className="app-filter-chip">
                      <span className="app-filter-chip-label">Period:</span>
                      <span className="app-filter-chip-value">
                        {timeframe === 'today'
                          ? 'Today'
                          : timeframe === 'yesterday'
                          ? 'Yesterday'
                          : timeframe === 'this_week'
                          ? 'This Week'
                          : timeframe === 'last_month'
                          ? 'Last Month'
                          : timeframe === 'last_3_months'
                          ? 'Last 3M'
                          : timeframe === 'this_year'
                          ? 'This Year'
                          : 'All Time'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTimeframe('this_month')}
                        className="app-filter-chip-remove"
                        title="Reset timeframe"
                        aria-label="Reset timeframe"
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="app-filter-clear-btn"
                    title="Clear all filters"
                  >
                    <RotateCcw size={13} strokeWidth={2.2} />
                    <span>Clear all</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="card empty-state-card">
            <div className="empty-state">
              <div className="empty-state-icon-badge">
                <Handshake size={24} strokeWidth={1.8} />
              </div>
              <div className="empty-state-title">No settlements yet</div>
              <p className="empty-state-desc">When you settle up with friends, detailed settlement records will appear here.</p>
            </div>
          </div>
        ) : filteredSettlements.length === 0 ? (
          <div className="card empty-state-card">
            <div className="empty-state" style={{ padding: '36px 20px' }}>
              <div className="empty-state-icon-badge" style={{ marginBottom: 14 }}>
                <Filter size={22} strokeWidth={1.8} />
              </div>
              <div className="empty-state-title" style={{ fontSize: '15px' }}>No matching settlements</div>
              <p className="empty-state-desc" style={{ marginBottom: 16 }}>Try adjusting your search query or filters.</p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchQuery('');
                  setFriendFilter('all');
                  setTypeFilter('all');
                }}
              >
                Reset Filters
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={listContainerRef}
            className="settlement-compact-list"
            style={{
              position: 'relative',
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              display: 'block',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const rowSettlements = rows[virtualRow.index];
              if (!rowSettlements) return null;

              return (
                <div
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                    display: 'grid',
                    gridTemplateColumns: numColumns > 1 ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                    gap: '12px',
                  }}
                >
                  {rowSettlements.map((s) => (
                    <SettlementCompactCard
                      key={s.id}
                      settlement={s}
                      friend={friendsMap.get(s.friendId)}
                      wallet={s.walletId ? walletsMap.get(s.walletId) : undefined}
                      currency={currency}
                      onSelect={setDetailSettlement}
                      onUndo={setDelId}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SettlementFilterDrawer
        isOpen={showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        friendFilter={friendFilter}
        setFriendFilter={setFriendFilter}
        timeframeFriends={timeframeFriends}
        totalTimeframeCount={timeframeFiltered.length}
        filteredCount={filteredSettlements.length}
        onResetFilters={handleResetFilters}
        activeFilterCount={activeFilterCount}
      />

      {settleFriend && <SettleModal friend={settleFriend} onClose={() => setSettleFriend(null)} />}
      {detailSettlement && (
        <SettlementDetailModal
          settlement={detailSettlement}
          onClose={() => setDetailSettlement(null)}
          onUndo={id => {
            setDelId(id);
          }}
        />
      )}
      {delId && (
        <ConfirmDialog
          title="Undo Settlement"
          message={`Are you sure you want to undo this settlement with ${
            targetF?.name || 'friend'
          }? ${fmtMoney(Math.abs(Number(targetS?.amount) || 0), currency)} will be restored to your ${targetWName} wallet and ${
            Array.isArray(targetS?.expenseIds) ? targetS.expenseIds.length : 0
          } expense(s) will be marked as unsettled again.`}
          confirmLabel="Undo Settlement"
          danger={false}
          onConfirm={() => handleDelete(delId)}
          onClose={() => setDelId(null)}
        />
      )}
    </div>
  );
}
