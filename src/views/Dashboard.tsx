import { useState, useMemo } from 'react';
import { Plus, TrendingUp, TrendingDown, Users, ReceiptText, ArrowLeftRight, Store, ArrowRight, Eye, EyeOff, PieChart, ChevronDown, Check, Flame } from 'lucide-react';
import { useStore } from '../store';
import { walletBalance, totalWalletBalance, expenseFlow, monthKey, allFriendBalances } from '../db';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, groupExpenses, resolveCategoryMeta, cleanSettlementDescription, type GroupedExpense } from '../utils';
import type { Friend, ViewName, Expense } from '../types';
import { CategoryBadge } from '../components/CategoryIcon';
import TransferModal from '../components/TransferModal';
import { ExpenseDetailDrawer } from '../components/ExpenseDetailDrawer';
import ExpenseModal from '../components/ExpenseModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { renderWalletIcon } from '../components/WalletIconRenderer';

interface Props {
  onNavigate: (v: ViewName, arg?: string) => void;
  onAddExpense: () => void;
}

export default function Dashboard({ onNavigate, onAddExpense }: Props) {
  const { db, deleteExpense, showToast } = useStore();
  const { expenses, wallets, settings: { currency } } = db;
  const hideAmounts = Boolean(db.settings?.hideAmounts);
  const [tempReveal, setTempReveal] = useState(false);
  const isCardMasked = hideAmounts && !tempReveal;
  const visibleWallets = useMemo(() => wallets.filter(w => !w.isHidden), [wallets]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedDetailGe, setSelectedDetailGe] = useState<GroupedExpense | null>(null);
  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const now = new Date();
  const thisKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const [selectedCatMonth, setSelectedCatMonth] = useState<string>(thisKey);
  const [isCatMonthPickerOpen, setIsCatMonthPickerOpen] = useState(false);
  const activeCatMonth = selectedCatMonth || thisKey;

  const expenseMonths = useMemo(() => {
    const set = new Set<string>([thisKey]);
    expenses.forEach(e => {
      if (e.type === 'personal' && e.date) {
        const k = monthKey(e.date);
        if (k) set.add(k);
      }
    });
    // Add past 6 months to ensure user can select previous months even if empty
    const [yStr, mStr] = thisKey.split('-');
    const baseDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
    for (let i = 0; i < 6; i++) {
      const k = baseDate.getFullYear() + '-' + String(baseDate.getMonth() + 1).padStart(2, '0');
      set.add(k);
      baseDate.setMonth(baseDate.getMonth() - 1);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [expenses, thisKey]);

  const formatMonthLabel = (key: string) => {
    const parts = key.split('-');
    if (parts.length !== 2) return key;
    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const d = new Date(year, monthIdx, 1);
    const mName = d.toLocaleDateString(undefined, { month: 'long' });
    if (key === thisKey) return mName;
    return year === now.getFullYear() ? mName : `${mName} ${year}`;
  };

  const totalBalance = useMemo(() => totalWalletBalance(db), [db]);

  const { monthSpend, monthIncome } = useMemo(() => {
    let spend = 0;
    let income = 0;
    expenses.forEach(e => {
      if (monthKey(e.date) === thisKey && e.type === 'personal' && e.status !== 'unpaid' && e.category !== 'Transfer') {
        const amt = Number(e.amount) || 0;
        if (expenseFlow(e) === 'out') {
          spend += amt;
        } else if (expenseFlow(e) === 'in') {
          income += amt;
        }
      }
    });
    return { monthSpend: spend, monthIncome: income };
  }, [expenses, thisKey]);

  const highestExpenseObj = useMemo<Expense | null>(() => {
    let maxAmt = 0;
    let maxExp: Expense | null = null;
    expenses.forEach((e: Expense) => {
      if (
        monthKey(e.date) === thisKey &&
        e.type === 'personal' &&
        e.status !== 'unpaid' &&
        e.category !== 'Transfer' &&
        expenseFlow(e) === 'out'
      ) {
        const amt = Number(e.amount) || 0;
        if (amt > maxAmt) {
          maxAmt = amt;
          maxExp = e;
        }
      }
    });
    return maxExp;
  }, [expenses, thisKey]);

  const highestExpenseGrouped = useMemo(() => {
    if (!highestExpenseObj) return null;
    const grouped = groupExpenses([highestExpenseObj], db.wallets, db.friends);
    return grouped[0] || null;
  }, [highestExpenseObj, db.wallets, db.friends]);

  const { allBalances, netFriends } = useMemo(() => {
    let credit = 0;
    let debt = 0;
    const balances = allFriendBalances(db).filter(b => (b.friend.type || 'friend') === 'friend');
    balances.forEach(b => {
      if (b.net > 0) credit += b.net;
      else if (b.net < 0) debt += Math.abs(b.net);
    });
    return { allBalances: balances, netFriends: credit - debt };
  }, [db]);

  const recentExpenses = useMemo(() => groupExpenses(expenses, db.wallets, db.friends, db.settlements).slice(0, 5), [expenses, db.wallets, db.friends, db.settlements]);

  const balancedFriends = useMemo(() =>
    allBalances
      .filter(b => Math.abs(b.net) > 0.004)
      .slice(0, 4),
    [allBalances]
  );

  const { catTotals, totalCatSpend } = useMemo(() => {
    const totals: Record<string, number> = {};
    let grandTotal = 0;
    expenses.forEach(e => {
      if (e.type !== 'personal' || expenseFlow(e) !== 'out') return;
      const key = monthKey(e.date);
      if (key !== activeCatMonth) return;
      const catLower = (e.category || '').toLowerCase();
      if (catLower.includes('refund') || catLower.includes('income') || catLower.includes('salary') || catLower.includes('cashback') || catLower.includes('deposit')) return;
      const amt = Number(e.amount) || 0;
      totals[e.category] = (totals[e.category] || 0) + amt;
      grandTotal += amt;
    });
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { catTotals: sorted, totalCatSpend: grandTotal };
  }, [expenses, activeCatMonth]);

  const monthName = now.toLocaleDateString(undefined, { month: 'long' });
  const shortMonthName = now.toLocaleDateString(undefined, { month: 'short' });

  return (
    <div className="view-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary desktop-only" onClick={onAddExpense}>
            <Plus size={16} />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Hero Financial Overview Header Card */}
      <div className="dashboard-hero-card">
        <div className="dashboard-hero-content">

          {/* Top/Left Section: Total Net Worth & Interactive Wallet Chips */}
          <div className="dashboard-hero-top">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Total Net Worth
                  </span>
                  {hideAmounts && (
                    <button
                      type="button"
                      onClick={() => setTempReveal(!tempReveal)}
                      title={isCardMasked ? "Click to show amounts" : "Click to hide amounts"}
                      style={{
                        background: isCardMasked ? 'var(--surface)' : 'var(--surface2)',
                        border: `1px solid ${isCardMasked ? 'var(--border2)' : 'var(--border)'}`,
                        borderRadius: 999,
                        padding: '2px 8px',
                        color: isCardMasked ? 'var(--text)' : 'var(--text-3)',
                        boxShadow: isCardMasked ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10.5,
                        fontWeight: isCardMasked ? 650 : 500,
                        transition: 'all 0.2s ease',
                        lineHeight: 1,
                      }}
                    >
                      {isCardMasked ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{isCardMasked ? 'Hidden' : 'Shown'}</span>
                    </button>
                  )}
                </div>
                <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text-2)', fontSize: 11 }}>
                  {visibleWallets.length} Active Wallet{visibleWallets.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ fontSize: 32, fontWeight: 800, color: totalBalance < 0 ? 'var(--debit)' : 'var(--text)', marginTop: 4, letterSpacing: '-0.8px' }}>
                {fmtMoney(totalBalance, currency, isCardMasked)}
              </div>
            </div>

            {/* Quick Wallet Breakdown Chips */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, minHeight: 30 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center' }}>
                  Wallets Breakdown
                </div>
                {visibleWallets.length >= 2 && (
                  <button
                    type="button"
                    className="btn-header-pill"
                    onClick={() => setShowTransfer(true)}
                    title="Transfer funds between wallets"
                  >
                    <ArrowLeftRight size={13} />
                    <span>Transfer</span>
                  </button>
                )}
              </div>
              <div className="dashboard-wallet-chips-scroll">
                {visibleWallets.map(w => {
                  const bal = walletBalance(db, w.id);
                  return (
                    <div
                      key={w.id}
                      className="dashboard-wallet-chip"
                      onClick={() => onNavigate('wallets')}
                      title={`Click to view ${w.name} in Wallets`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {renderWalletIcon(w.icon || w.name || 'other_upi', 18, w.color)}
                      </div>
                      <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{w.name}:</span>
                      <span style={{ fontWeight: 700, color: bal < 0 ? 'var(--debit)' : 'var(--text)' }}>
                        {fmtMoney(bal, currency, isCardMasked)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stats Section: 4 Mini Metric Cards Grid */}
          <div className="dashboard-hero-stats">
            <div className="dashboard-stats-grid">
              <div
                className="dashboard-mini-stat dashboard-mini-stat-spend"
                onClick={() => onNavigate('expenses')}
                title={`View ${monthName} Expenses`}
              >
                <div className="dashboard-mini-stat-header">
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    background: 'var(--debit-bg, rgba(239, 68, 68, 0.12))',
                    border: '1px solid var(--debit-border, rgba(239, 68, 68, 0.25))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--debit)',
                    flexShrink: 0
                  }}>
                    <TrendingDown size={12} />
                  </div>
                  <span>{shortMonthName} Spend</span>
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: 'var(--debit)' }}>
                  {fmtMoney(monthSpend, currency)}
                </div>
              </div>

              <div
                className="dashboard-mini-stat dashboard-mini-stat-income"
                onClick={() => onNavigate('expenses')}
                title={`View ${monthName} Income`}
              >
                <div className="dashboard-mini-stat-header">
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    background: 'var(--credit-bg, rgba(34, 197, 94, 0.12))',
                    border: '1px solid var(--credit-border, rgba(34, 197, 94, 0.25))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--credit)',
                    flexShrink: 0
                  }}>
                    <TrendingUp size={12} />
                  </div>
                  <span>{shortMonthName} Income</span>
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: 'var(--credit)' }}>
                  {fmtMoney(monthIncome, currency)}
                </div>
              </div>

              <div
                className="dashboard-mini-stat dashboard-mini-stat-friends"
                onClick={() => onNavigate('friends')}
                title={netFriends > 0 ? 'Friends owe you in total (Click to view)' : netFriends < 0 ? 'You owe friends in total (Click to view)' : 'All balances settled (Click to view)'}
              >
                <div className="dashboard-mini-stat-header">
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    background: netFriends > 0
                      ? 'var(--credit-bg, rgba(34, 197, 94, 0.12))'
                      : netFriends < 0
                      ? 'var(--debit-bg, rgba(239, 68, 68, 0.12))'
                      : 'var(--surface3)',
                    border: `1px solid ${netFriends > 0 ? 'var(--credit-border, rgba(46, 125, 50, 0.22))' : netFriends < 0 ? 'var(--debit-border, rgba(211, 47, 47, 0.22))' : 'var(--border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: netFriends > 0 ? 'var(--credit)' : netFriends < 0 ? 'var(--debit)' : 'var(--text-2)',
                    flexShrink: 0
                  }}>
                    <Users size={12} />
                  </div>
                  <span>Friends Net</span>
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: netFriends > 0 ? 'var(--credit)' : netFriends < 0 ? 'var(--debit)' : 'var(--text)' }}>
                  {fmtMoney(Math.abs(netFriends), currency)}
                </div>
              </div>

              <div
                className="dashboard-mini-stat dashboard-mini-stat-highest"
                onClick={() => {
                  if (highestExpenseGrouped) {
                    setSelectedDetailGe(highestExpenseGrouped);
                  } else {
                    onNavigate('expenses');
                  }
                }}
                title={highestExpenseObj ? `${highestExpenseObj.description || highestExpenseObj.category || 'Expense'} (${highestExpenseObj.category || 'Expense'}) - Click to view drawer` : 'Highest Expense'}
              >
                <div className="dashboard-mini-stat-header">
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    background: 'var(--amber-bg, rgba(245, 158, 11, 0.12))',
                    border: '1px solid var(--amber-border, rgba(245, 158, 11, 0.25))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--amber, #f59e0b)',
                    flexShrink: 0
                  }}>
                    <Flame size={12} />
                  </div>
                  <span>
                    Highest Exp
                  </span>
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: 'var(--amber, #f59e0b)' }}>
                  {highestExpenseObj ? fmtMoney(highestExpenseObj.amount, currency) : fmtMoney(0, currency)}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="dashboard-grid">
        {/* Recent Expenses */}
        <div className="card" style={{ gridColumn: '1 / -1', minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, width: '100%', minWidth: 0, minHeight: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <div className="dashboard-card-icon">
                <ReceiptText size={17} />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, display: 'flex', alignItems: 'center' }}>Recent Expenses</h2>
            </div>
            <button className="btn-view-all" onClick={() => onNavigate('expenses')}>
              <span>View all</span>
              <ArrowRight size={14} className="btn-view-all-arrow" />
            </button>
          </div>
          {recentExpenses.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <p>No expenses yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', minWidth: 0 }}>
              {recentExpenses.map((ge) => {
                const cat = db.settings.categories.find(c => c.name === ge.category);
                const isSettlement = ge.isSettlementGroup || ge.category === 'Settlement';
                const catMeta = resolveCategoryMeta(ge.category, cat, isSettlement);
                const isIn = ge.flow === 'in' && ge.category !== 'Transfer';
                const friendsInGroup = ge.friendIds.map(fid => db.friends.find(f => f.id === fid)).filter(Boolean);
                const vendorId = ge.vendorId || ge.items.find(i => i.vendorId)?.vendorId;
                const vendor = vendorId ? db.friends.find(f => f.id === vendorId) : null;
                return (
                  <div
                    key={ge.id}
                    onClick={() => setSelectedDetailGe(ge)}
                    role="button"
                    tabIndex={0}
                    className="recent-expense-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 10,
                      gap: 12,
                      width: 'calc(100% + 12px)',
                      margin: '0 -6px',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDetailGe(ge);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                      <CategoryBadge category={catMeta.name} color={catMeta.color} icon={catMeta.icon} size={15} showLabel={false} />
                      <div style={{ minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, width: '100%' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto' }}>{cleanSettlementDescription(ge.description)}</span>
                          {vendor && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: 'var(--surface2)',
                                color: 'var(--text-2)',
                                border: '1px solid var(--border)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                              title={`Vendor: ${vendor.name}`}
                            >
                              <Store size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            </span>
                          )}
                          {!isSettlement && ge.isSplit && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: 'var(--accent-soft)',
                              color: 'var(--accent)',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>Split</span>
                          )}
                        </div>
                        <div style={{
                          fontSize: 11,
                          color: 'var(--text-3)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          minWidth: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5
                        }}>
                          <span style={{ flexShrink: 0 }}>{fmtDate(ge.date)}</span>
                          {!isSettlement && (
                            <>
                              <span style={{ flexShrink: 0 }}>•</span>
                              <span style={{ flexShrink: 0 }}>{ge.category}</span>
                            </>
                          )}
                          {friendsInGroup.length > 0 && (
                            <>
                              <span style={{ flexShrink: 0 }}>•</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {friendsInGroup.map((f) => f && (
                                  <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3.5, flexShrink: 0 }}>
                                    <span
                                      className="avatar avatar-sm"
                                      style={{
                                        ...getAvatarStyle(f.color),
                                        width: 14,
                                        height: 14,
                                        fontSize: 8,
                                        flexShrink: 0,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      {f.type === 'vendor' ? <Store size={8} /> : friendInitial(f.name, f.avatarNumber)}
                                    </span>
                                    <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>
                                      {f.name}
                                    </span>
                                  </span>
                                ))}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      textAlign: 'right',
                      fontWeight: 700,
                      fontSize: 13,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                      color: isSettlement
                        ? (ge.flow === 'in' ? 'var(--credit)' : 'var(--debit)')
                        : (isIn ? 'var(--credit)' : 'var(--text)')
                    }}>
                      {isSettlement
                        ? (ge.flow === 'in' ? '+' : '-')
                        : (isIn ? '+' : '')}
                      {fmtMoney(ge.totalAmount, currency)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Friend Balances */}
        <div className="card" style={{ minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, width: '100%', minWidth: 0, minHeight: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <div className="dashboard-card-icon">
                <Users size={17} />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, display: 'flex', alignItems: 'center' }}>Friends</h2>
            </div>
            <button className="btn-view-all" onClick={() => onNavigate('friends')}>
              <span>View all</span>
              <ArrowRight size={14} className="btn-view-all-arrow" />
            </button>
          </div>
          {balancedFriends.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: 12.5, padding: '16px 0', textAlign: 'center' }}>
              All settled up! No outstanding balances.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', minWidth: 0 }}>
              {balancedFriends.map(({ friend, net }: { friend: Friend; net: number }) => {
                const isOwed = net > 0;
                return (
                  <div
                    key={friend.id}
                    onClick={() => onNavigate('friend-detail', friend.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      cursor: 'pointer',
                      padding: '8px 10px',
                      borderRadius: 10,
                      margin: '0 -6px',
                      transition: 'background 0.15s ease',
                      width: 'calc(100% + 12px)',
                      boxSizing: 'border-box'
                    }}
                    className="friend-balance-row"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                      <div
                        className="avatar"
                        style={{
                          ...getAvatarStyle(friend.color),
                          width: 28,
                          height: 28,
                          fontSize: 11,
                          fontWeight: 600,
                          flexShrink: 0,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {friendInitial(friend.name, friend.avatarNumber)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {friend.name}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: isOwed ? 'var(--credit)' : 'var(--debit)',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums'
                      }}>
                        {isOwed ? '+' : ''}{fmtMoney(net, currency)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Spend */}
        <div className="card" style={{ minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, minHeight: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="dashboard-card-icon">
                <PieChart size={17} />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center' }}>Top Categories</h2>
            </div>

            {/* Month Selector Badge */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-header-pill"
                onClick={() => setIsCatMonthPickerOpen(prev => !prev)}
                title="Select month for top categories"
              >
                <span>{formatMonthLabel(activeCatMonth)}</span>
                <ChevronDown
                  size={13}
                  className="btn-header-pill-chevron"
                  style={{
                    transform: isCatMonthPickerOpen ? 'rotate(180deg)' : 'none',
                  }}
                />
              </button>

              {isCatMonthPickerOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                    onClick={() => setIsCatMonthPickerOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      zIndex: 100,
                      background: 'var(--surface)',
                      border: '1px solid var(--border-soft, rgba(255, 255, 255, 0.08))',
                      borderRadius: 12,
                      boxShadow: 'var(--shadow-lg)',
                      padding: '6px',
                      minWidth: 150,
                      maxHeight: 220,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Select Month
                    </div>
                    {expenseMonths.map(mKey => {
                      const isSelected = mKey === activeCatMonth;
                      const label = formatMonthLabel(mKey);
                      return (
                        <button
                          key={mKey}
                          type="button"
                          onClick={() => {
                            setSelectedCatMonth(mKey);
                            setIsCatMonthPickerOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 10px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: isSelected ? 700 : 500,
                            background: isSelected ? 'var(--surface2)' : 'transparent',
                            color: isSelected ? 'var(--text)' : 'var(--text-2)',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <span>{label}</span>
                          {isSelected && <Check size={13} style={{ color: 'var(--text)' }} />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {catTotals.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {catTotals.map(([cat, total]) => {
                const catObj = db.settings.categories.find(c => c.name === cat);
                const catColor = catObj?.color ?? '#6B7280';
                const pct = totalCatSpend > 0 ? Math.round((total / totalCatSpend) * 100) : 0;
                const fillPct = totalCatSpend > 0 ? Math.min(100, Math.max(2, (total / totalCatSpend) * 100)) : 0;

                return (
                  <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <CategoryBadge category={cat} color={catColor} icon={catObj?.icon} size={14} showLabel={true} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'var(--surface2)',
                          color: 'var(--text-3)'
                        }}>
                          {pct}%
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtMoney(total, currency)}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      width: '100%',
                      height: 6,
                      borderRadius: 999,
                      background: 'var(--surface2)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${fillPct}%`,
                        background: catColor,
                        borderRadius: 999,
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              No personal spending recorded in {formatMonthLabel(activeCatMonth)}
            </div>
          )}
        </div>
      </div>

      <TransferModal
        isOpen={showTransfer}
        onClose={() => setShowTransfer(false)}
      />

      {selectedDetailGe && (
        <ExpenseDetailDrawer
          ge={selectedDetailGe}
          currency={currency}
          onClose={() => setSelectedDetailGe(null)}
          onEdit={(exp) => {
            setSelectedDetailGe(null);
            setEditExp(exp);
          }}
          onDelete={(id) => {
            setSelectedDetailGe(null);
            setDelId(id);
          }}
        />
      )}

      {editExp && (
        <ExpenseModal
          expense={editExp}
          onClose={() => setEditExp(null)}
        />
      )}

      {delId && (
        <ConfirmDialog
          title="Delete Expense"
          message="Are you sure you want to delete this expense? Any amount deducted from your wallet will be added back automatically."
          onConfirm={() => {
            deleteExpense(delId);
            setDelId(null);
            showToast('Expense deleted & balance updated');
          }}
          onClose={() => setDelId(null)}
        />
      )}
    </div>
  );
}
