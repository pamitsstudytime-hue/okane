import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, Pencil, Trash2, X, Store, FileText, Wallet as WalletIcon, Tag, ArrowUpRight, ArrowDownLeft, Repeat, RotateCcw, Check
} from 'lucide-react';
import CategoryIcon, { CategoryBadge } from './CategoryIcon';
import {
  fmtMoney,
  fmtDate,
  friendInitial,
  cleanExpenseDescription,
  cleanSettlementDescription,
  getGroupSettlementStatus,
  type GroupedExpense
} from '../utils';
import type { Expense, Friend, Wallet, Category, Settlement } from '../types';
import { renderWalletIcon } from './WalletIconRenderer';
import { useStore } from '../store';
import { friendBalance } from '../db';

interface ExpenseDetailDrawerProps {
  ge: GroupedExpense;
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onUndo?: (id: string) => void;
  currency?: string;
  friends?: Friend[];
  wallets?: Wallet[];
  categories?: Category[];
  settlements?: Settlement[];
}

export const ExpenseDetailDrawer: React.FC<ExpenseDetailDrawerProps> = ({
  ge,
  onClose,
  onEdit,
  onDelete,
  onUndo,
  currency: currencyProp,
  friends: friendsProp,
  wallets: walletsProp,
  categories: categoriesProp,
  settlements: settlementsProp,
}) => {
  const { db } = useStore();
  const friends = friendsProp || db.friends;
  const wallets = walletsProp || db.wallets;
  const categories = categoriesProp || db.settings.categories;
  const settlements = settlementsProp || db.settlements;
  const currency = currencyProp || db.settings.currency || 'INR';

  const friendsMap = useMemo(() => new Map((friends || []).map(f => [f.id, f])), [friends]);
  const walletsMap = useMemo(() => new Map((wallets || []).map(w => [w.id, w])), [wallets]);
  const categoriesMap = useMemo(() => new Map((categories || []).map(c => [c.name, c])), [categories]);
  const settlementsMap = useMemo(() => new Map((settlements || []).map(s => [s.id, s])), [settlements]);

  const primaryItem = ge.items[0] || (ge as unknown as Expense);
  const categoryObj = categoriesMap.get(ge.category);
  const walletObj = walletsMap.get(ge.walletId);
  const settlementObj = ge.settlementId ? settlementsMap.get(ge.settlementId) : null;
  const groupStatus = getGroupSettlementStatus(ge);

  let effectiveWalletName = walletObj?.name || settlementObj?.paymentMethod || '—';
  if (ge.category === 'Transfer') {
    if (ge.fromWalletName && ge.toWalletName) {
      effectiveWalletName = `${ge.fromWalletName} → ${ge.toWalletName}`;
    } else {
      const outItem = ge.items.find((i: Expense) => i.flow === 'out');
      const inItem = ge.items.find((i: Expense) => i.flow === 'in');
      const fromW = outItem ? walletsMap.get(outItem.walletId) : null;
      const toW = inItem ? walletsMap.get(inItem.walletId) : null;
      if (fromW || toW) {
        effectiveWalletName = `${fromW?.name || 'Wallet'} → ${toW?.name || 'Wallet'}`;
      }
    }
  }

  const isSettlement = ge.isSettlementGroup || ge.category === 'Settlement';
  const isTransfer = ge.category === 'Transfer' || ge.items.some((i: Expense) => i.category === 'Transfer');
  const isDebit = ge.flow === 'out';
  const flowSign = isDebit ? '-' : '+';

  const isContactVendor = (f: Friend | null | undefined): boolean => {
    if (!f) return false;
    if (f.type === 'vendor') return true;
    if (f.category?.toLowerCase() === 'vendor' || f.category?.toLowerCase() === 'store') return true;
    if (ge.vendorId === f.id || ge.items.some((i: Expense) => i.vendorId === f.id)) return true;
    const n = (f.name || '').toLowerCase();
    return /tiffin|aunty|vendor|store|merchant|canteen|mess|hotel|shop|restaurant|mart|supermarket|bazaar|swiggy|zomato|grocer/i.test(n);
  };

  const allFriendIds = Array.from(new Set([
    ...ge.friendIds,
    ...ge.items.map(i => i.friendId).filter(Boolean) as string[],
    ...(ge.settlementId ? [settlementsMap.get(ge.settlementId)?.friendId].filter(Boolean) as string[] : []),
  ]));
  const rawFriends = allFriendIds.map((fid: string) => friendsMap.get(fid)).filter((f): f is Friend => Boolean(f));
  
  const explicitVendorId = ge.vendorId || ge.items.find((i: Expense) => i.vendorId)?.vendorId;
  const explicitVendor = explicitVendorId ? friendsMap.get(explicitVendorId) : null;
  const detectedVendor = explicitVendor || rawFriends.find(isContactVendor) || null;

  // Filter out vendor so friends and vendor are never lumped together
  const nonVendorFriends = rawFriends.filter(f => f.id !== detectedVendor?.id);

  let friendsToShow = nonVendorFriends;
  if (friendsToShow.length === 0 && isSettlement && !detectedVendor) {
    const m = ge.description.match(/^Settlement:\s*(Paid\s+to|Received\s+from)\s+(.+?)(?:\s*\((.*?)\))?$/i);
    if (m && m[2]) {
      friendsToShow = [{ id: 'synthetic_friend', name: m[2].trim() } as Friend];
    }
  }

  interface FriendRoleInfo {
    friend: Friend;
    role: 'i_owe' | 'owes_me' | 'neutral';
    amount?: number;
    statusText: string;
    isSettled: boolean;
  }

  const categorizedFriends = useMemo(() => {
    return friendsToShow.map((friend): FriendRoleInfo => {
      const friendItems = ge.items.filter(i => i.friendId === friend.id);
      const hasByFriend = friendItems.some(i => i.type === 'by_friend');
      const hasForFriend = friendItems.some(i => i.type === 'for_friend');
      const friendItemTotal = friendItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const allItemsSettled = friendItems.length > 0 && friendItems.every(i => i.settled || i.settlementId);

      const b = friendBalance(db, friend.id);

      let role: 'i_owe' | 'owes_me' | 'neutral' = 'neutral';
      const isSettled = allItemsSettled;

      if (hasByFriend && !hasForFriend) {
        role = 'i_owe';
      } else if (hasForFriend && !hasByFriend) {
        role = 'owes_me';
      } else if (b.net < -0.01) {
        role = 'i_owe';
      } else if (b.net > 0.01) {
        role = 'owes_me';
      } else if (isSettlement) {
        role = isDebit ? 'i_owe' : 'owes_me';
      }

      let statusText = '';
      if (isSettled) {
        statusText = role === 'i_owe' ? 'Settled (Paid)' : (role === 'owes_me' ? 'Settled (Received)' : 'Settled');
      } else {
        statusText = role === 'i_owe' ? 'You owe' : (role === 'owes_me' ? 'Owes you' : 'Participant');
      }

      return {
        friend,
        role,
        amount: friendItemTotal > 0 ? friendItemTotal : undefined,
        statusText,
        isSettled,
      };
    });
  }, [friendsToShow, ge.items, isDebit, isSettlement, db]);

  const friendsIOwe = categorizedFriends.filter(cf => cf.role === 'i_owe');
  const friendsOweMe = categorizedFriends.filter(cf => cf.role === 'owes_me');
  const friendsNeutral = categorizedFriends.filter(cf => cf.role === 'neutral');

  const categoryColor = categoryObj?.color || 'var(--accent)';

  const renderFriendChip = (cf: FriendRoleInfo, themeColor: string) => {
    const { friend, isSettled } = cf;
    const friendColor = friend.color || themeColor;
    return (
      <span
        key={friend.id}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '3px 10px 3px 4px',
          borderRadius: 9999,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--text)',
          lineHeight: 1.2,
          maxWidth: '100%',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        }}
        title={friend.name}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 750,
            color: '#ffffff',
            flexShrink: 0,
            background: friendColor,
            boxShadow: `0 1px 4px ${friendColor}35`,
          }}
        >
          {friendInitial(friend.name, friend.avatarNumber)}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {friend.name}
        </span>
        {isSettled && (
          <Check size={12} strokeWidth={2.8} style={{ color: '#10b981', flexShrink: 0, marginLeft: 1 }} />
        )}
      </span>
    );
  };

  return createPortal(
    <div
      className="modal-backdrop"
      style={{ zIndex: 100050 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal expense-drawer-modal"
        style={{
          maxWidth: 440,
          maxHeight: 'min(92vh, 92dvh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--drawer-bg, #131418)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          overflow: 'hidden',
          animation: 'slidein 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.7)',
          color: 'var(--text)',
        }}
      >
        {/* Top Drag Handle */}
        <div className="modal-handle-bar" style={{ padding: '10px 0 2px', display: 'flex', justifyContent: 'center' }}>
          <div className="modal-handle" style={{ width: 38, height: 4, background: '#323540', borderRadius: 9999 }} />
        </div>

        {/* Drawer Header matching Image 2 reference */}
        <div
          className="modal-header"
          style={{
            padding: '10px 16px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 'none',
            flexShrink: 0,
            background: 'transparent',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            {/* Squircle Category Icon Badge */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: categoryObj?.color ? `${categoryObj.color}20` : 'rgba(16, 185, 129, 0.16)',
                border: `1px solid ${categoryObj?.color ? categoryObj.color + '35' : 'rgba(16, 185, 129, 0.28)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: categoryColor,
              }}
            >
              <CategoryIcon category={ge.category} icon={categoryObj?.icon} size={22} style={{ color: categoryColor }} />
            </div>

            {/* Title and metadata */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 750, fontSize: 17, color: 'var(--text)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cleanSettlementDescription(ge.description)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, color: 'var(--text-2)', fontSize: 12.5 }}>
                {!isSettlement && (
                  <>
                    <span>{ge.category}</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 10 }}>•</span>
                  </>
                )}
                <span>📅 {fmtDate(ge.date)}</span>
              </div>
            </div>
          </div>

          {/* Close circular button */}
          <button
            type="button"
            className="compact-close-btn"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          className="modal-body"
          style={{
            padding: '2px 14px 6px',
            overflowY: 'auto',
            minHeight: 0,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: 'transparent',
          }}
        >
          {/* Main Hero Card: Total Amount & Status Badges */}
          <div
            style={{
              padding: '14px 16px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Total Amount
              </span>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 22,
                  color: isDebit ? 'var(--debit, #ef4444)' : 'var(--credit, #10b981)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.4px',
                  marginTop: 2,
                }}
              >
                {flowSign}{fmtMoney(ge.totalAmount, currency)}
              </div>
              {ge.isSplit && ge.personalShare > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', fontWeight: 500, marginTop: 2 }}>
                  Your share: {fmtMoney(ge.personalShare, currency)}
                </div>
              )}
            </div>

            {/* Badges & Status */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              {/* Flow Pill */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 9999,
                  fontSize: 11,
                  fontWeight: 650,
                  whiteSpace: 'nowrap',
                  background: isTransfer ? 'var(--accent-soft)' : (isDebit ? 'var(--debit-bg)' : 'var(--credit-bg)'),
                  border: `1px solid ${isTransfer ? 'var(--accent-border-soft, var(--border))' : (isDebit ? 'var(--debit-border)' : 'var(--credit-border)')}`,
                  color: isTransfer ? 'var(--accent)' : (isDebit ? 'var(--debit)' : 'var(--credit)'),
                }}
              >
                {isTransfer ? <Repeat size={11} /> : (isDebit ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />)}
                <span>{isTransfer ? 'Transfer' : (isDebit ? 'Expense' : 'Income')}</span>
              </span>

              {/* Group / Settlement Status */}
              {groupStatus.statusKey !== 'none' && groupStatus.statusLabel && (() => {
                const isPositiveStatus =
                  groupStatus.statusKey === 'settled' ||
                  groupStatus.statusKey === 'paid' ||
                  groupStatus.statusKey === 'completed';
                const isPartial = groupStatus.statusKey === 'partial';
                const badgeBg = isPositiveStatus
                  ? 'var(--credit-bg, rgba(16, 185, 129, 0.12))'
                  : isPartial
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'var(--debit-bg, rgba(239, 68, 68, 0.12))';
                const badgeBorder = isPositiveStatus
                  ? 'var(--credit-border, rgba(16, 185, 129, 0.28))'
                  : isPartial
                  ? 'rgba(245, 158, 11, 0.3)'
                  : 'var(--debit-border, rgba(239, 68, 68, 0.25))';
                const badgeColor = isPositiveStatus
                  ? 'var(--credit, #10b981)'
                  : isPartial
                  ? '#f59e0b'
                  : 'var(--debit, #ef4444)';

                return (
                  <span
                    style={{
                      padding: '3px 9px',
                      fontSize: 11,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      borderRadius: 9999,
                      background: badgeBg,
                      border: `1px solid ${badgeBorder}`,
                      color: badgeColor,
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: badgeColor,
                      }}
                    />
                    {ge.isSplit && <Users size={10} />}
                    <span>{groupStatus.statusLabel}</span>
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Details Section Card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              padding: '16px 18px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 20,
            }}
          >
            {/* Top Row: Wallet and Category (Date is already displayed cleanly in the header) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 14,
                alignItems: 'center',
              }}
            >
              {/* Wallet */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <WalletIcon size={11} style={{ color: 'var(--text-3)' }} />
                  Wallet
                </span>
                <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--text)', wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {walletObj ? (
                    <>
                      {renderWalletIcon(walletObj.icon || walletObj.name, 13, walletObj.color)}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{effectiveWalletName}</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{effectiveWalletName}</span>
                  )}
                </span>
              </div>

              {/* Category */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Tag size={11} style={{ color: 'var(--text-3)' }} />
                  Category
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                  <CategoryBadge category={ge.category} color={categoryObj?.color} icon={categoryObj?.icon} size={11.5} />
                </div>
              </div>
            </div>

            {/* Vendor / Store Section if detected */}
            {detectedVendor && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.035)',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: detectedVendor.color || 'var(--accent, #6366f1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontWeight: 750,
                      fontSize: 12,
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                    }}
                  >
                    <Store size={15} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      Store / Vendor
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {detectedVendor.name}
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 9999,
                    background: 'rgba(234, 179, 8, 0.14)',
                    color: '#eab308',
                    border: '1px solid rgba(234, 179, 8, 0.32)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Vendor
                </span>
              </div>
            )}

            {/* Friends Categorized: "You Owe" vs "Owes You" vs "Participants" */}
            {categorizedFriends.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {/* 1. Friends the user owes ("I owe some") */}
                {friendsIOwe.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 750, color: 'var(--debit, #ef4444)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ArrowDownLeft size={12} strokeWidth={2.5} />
                        You Owe
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999, background: 'rgba(239, 68, 68, 0.14)', color: '#ef4444' }}>
                        {friendsIOwe.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {friendsIOwe.map(cf => renderFriendChip(cf, 'var(--debit, #ef4444)'))}
                    </div>
                  </div>
                )}

                {/* 2. Friends who owe the user ("Some owe me") */}
                {friendsOweMe.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 750, color: 'var(--credit, #10b981)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ArrowUpRight size={12} strokeWidth={2.5} />
                        Owes You
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999, background: 'rgba(16, 185, 129, 0.14)', color: '#10b981' }}>
                        {friendsOweMe.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {friendsOweMe.map(cf => renderFriendChip(cf, 'var(--credit, #10b981)'))}
                    </div>
                  </div>
                )}

                {/* 3. Neutral or general participants if any */}
                {friendsNeutral.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={12} />
                        Participants
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999, background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-2)' }}>
                        {friendsNeutral.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {friendsNeutral.map(cf => renderFriendChip(cf, 'var(--accent)'))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes if exists */}
            {primaryItem.notes && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FileText size={11} style={{ color: 'var(--text-3)' }} />
                  Notes
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text)',
                    lineHeight: 1.45,
                    fontWeight: 500,
                    wordBreak: 'break-word',
                  }}
                >
                  {primaryItem.notes}
                </span>
              </div>
            )}
          </div>

          {/* Split / Settlement Breakdown with Image 2 Circular Checkboxes */}
          {!isTransfer && (ge.isSplit || ge.isSettlementGroup || ge.items.length > 1 || rawFriends.length > 1) && (
            <div
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 18,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Users size={13} style={{ color: 'var(--text-2)' }} />
                  <span>{ge.isSettlementGroup ? 'Settlement Breakdown' : 'Split Breakdown'}</span>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 650, color: 'var(--text-2)', background: 'var(--surface3)', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 9999 }}>
                  Total {fmtMoney(ge.totalAmount, currency)}
                </span>
              </div>

              {/* Participants Checklist Rows (matching Image 2 checklist items) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ge.items
                  .filter((item: Expense) => !(item.type === 'personal' && (Number(item.amount) || 0) <= 0))
                  .map((item: Expense, idx: number) => {
                    const itemFriend = item.friendId ? friendsMap.get(item.friendId) : null;
                    const itemVendor = item.vendorId ? friendsMap.get(item.vendorId) : (itemFriend && isContactVendor(itemFriend) ? itemFriend : null);
                    const isMine = item.type === 'personal';
                    const isVendorItem = Boolean(itemVendor || (itemFriend && isContactVendor(itemFriend)));
                    
                    let primaryName = itemFriend?.name ?? (itemVendor?.name ?? 'Contact');
                    let actionSubtitle = 'Split share';
                    let roleBadge: { label: string; color: string; bg: string; border: string } | null = null;
                    const isSettled = item.settled || isMine || ge.isSettlementGroup;

                    if (isVendorItem) {
                      primaryName = itemVendor?.name || itemFriend?.name || 'Vendor';
                      actionSubtitle = isSettled ? 'Vendor bill settled' : 'Vendor bill';
                      roleBadge = { label: 'Vendor', color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.28)' };
                    } else if (isMine) {
                      primaryName = 'You';
                      actionSubtitle = 'Your personal share';
                      roleBadge = { label: 'You', color: 'var(--accent)', bg: 'var(--accent-soft)', border: 'var(--accent-border-soft)' };
                    } else if (item.type === 'for_friend') {
                      primaryName = itemFriend?.name || 'Friend';
                      actionSubtitle = item.settled ? 'Paid their share to you' : 'Owes you their share';
                      roleBadge = { label: 'Owes You', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.28)' };
                    } else if (item.type === 'by_friend') {
                      primaryName = itemFriend?.name || 'Friend';
                      actionSubtitle = item.settled ? 'Settled debt you owed' : 'You owe them';
                      roleBadge = { label: 'You Owe', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.28)' };
                    } else if (ge.isSettlementGroup) {
                      const itemDesc = cleanExpenseDescription(item.description);
                      if (itemFriend) {
                        primaryName = itemFriend.name;
                        const b = friendBalance(db, itemFriend.id);
                        if (b.net < 0) {
                          actionSubtitle = 'Settled debt you owed';
                          roleBadge = { label: 'You Owe', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.28)' };
                        } else {
                          actionSubtitle = 'Settled share received';
                          roleBadge = { label: 'Owes You', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.28)' };
                        }
                      } else {
                        primaryName = itemDesc;
                        actionSubtitle = `Date: ${fmtDate(item.originalDate || item.date)}`;
                      }
                    }

                    const isSubDebit = item.type === 'by_friend' || (item.type === 'personal' && !isVendorItem);
                    const subSign = isSubDebit ? '-' : '+';
                    const subColor = isSubDebit ? 'var(--debit, #dc2626)' : 'var(--credit, #16a34a)';

                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: 14,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          {/* Circular Checkbox */}
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              backgroundColor: isSettled ? '#10b981' : 'transparent',
                              border: isSettled ? '2px solid #10b981' : '2px solid #525562',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              color: '#ffffff',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isSettled && <Check size={13} strokeWidth={3} />}
                          </div>

                          {/* Avatar if vendor or contact */}
                          {isVendorItem ? (
                            <span
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 750,
                                color: '#ffffff',
                                flexShrink: 0,
                                background: itemVendor?.color || '#eab308',
                              }}
                            >
                              <Store size={12} />
                            </span>
                          ) : !isMine && itemFriend ? (
                            <span
                              className="avatar avatar-sm"
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 750,
                                color: '#ffffff',
                                flexShrink: 0,
                                background: itemFriend?.color || 'var(--accent)',
                                boxShadow: `0 1px 4px ${itemFriend?.color ? itemFriend.color + '40' : 'rgba(0,0,0,0.2)'}`,
                              }}
                            >
                              {friendInitial(itemFriend?.name ?? '?', itemFriend?.avatarNumber)}
                            </span>
                          ) : null}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: 13,
                                  color: 'var(--text)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {primaryName}
                              </span>
                              {roleBadge && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 9999,
                                    color: roleBadge.color,
                                    background: roleBadge.bg,
                                    border: `1px solid ${roleBadge.border}`,
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  {roleBadge.label}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {actionSubtitle}
                            </span>
                          </div>
                        </div>

                        <span
                          style={{
                            fontWeight: 750,
                            fontSize: 13.5,
                            marginLeft: 8,
                            color: subColor,
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {subSign}{fmtMoney(Number(item.amount) || 0, currency)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Clean Capsule Action Buttons */}
        <div
          className="modal-footer"
          style={{
            padding: '6px 16px calc(24px + env(safe-area-inset-bottom, 0px))',
            background: 'transparent',
            borderTop: 'none',
            display: 'flex',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {onUndo && (ge.isSettlementGroup || ge.settlementId || ge.items.some(i => i.settled || i.settlementId || i.vendorSettled)) && (
            <button
              type="button"
              className="btn"
              style={{
                flex: 1,
                height: 44,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                fontSize: 13.5,
                fontWeight: 700,
                borderRadius: 9999,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.15s ease',
              }}
              onClick={() => {
                onClose();
                onUndo(ge.settlementId || ge.id);
              }}
            >
              <RotateCcw size={15} style={{ color: 'var(--text)' }} />
              <span>Undo</span>
            </button>
          )}
          {!ge.isSettlementGroup && (
            <button
              type="button"
              className="btn"
              style={{
                flex: 1,
                height: 44,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                fontSize: 13.5,
                fontWeight: 700,
                borderRadius: 9999,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.15s ease',
              }}
              onClick={() => {
                onClose();
                onEdit(primaryItem);
              }}
            >
              <Pencil size={15} style={{ color: 'var(--text)' }} />
              <span>Edit</span>
            </button>
          )}
          <button
            type="button"
            className="btn"
            style={{
              flex: 1,
              height: 44,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: 13.5,
              fontWeight: 700,
              borderRadius: 9999,
              background: 'var(--debit-bg)',
              border: '1px solid var(--debit-border)',
              color: 'var(--debit)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
              transition: 'all 0.15s ease',
            }}
            onClick={() => {
              onClose();
              onDelete(ge.id);
            }}
          >
            <Trash2 size={15} style={{ color: 'var(--debit)' }} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExpenseDetailDrawer;

