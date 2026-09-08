import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, Pencil, Trash2, X, Store, FileText, Calendar, Wallet as WalletIcon, Tag, ArrowUpRight, ArrowDownLeft, Repeat, RotateCcw, Check
} from 'lucide-react';
import CategoryIcon, { CategoryBadge } from './CategoryIcon';
import {
  fmtMoney,
  fmtDate,
  friendInitial,
  getAvatarStyle,
  cleanExpenseDescription,
  cleanSettlementDescription,
  getGroupSettlementStatus,
  type GroupedExpense
} from '../utils';
import type { Expense, Friend, Wallet, Category, Settlement } from '../types';
import { renderWalletIcon } from './WalletIconRenderer';
import { useStore } from '../store';

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

  const isTransfer = ge.category === 'Transfer' || ge.items.some((i: Expense) => i.category === 'Transfer');
  const rawFriends = ge.friendIds.map((fid: string) => friendsMap.get(fid)).filter((f): f is Friend => Boolean(f));
  const vendorId = ge.vendorId || ge.items.find((i: Expense) => i.vendorId)?.vendorId;
  const vendor = vendorId ? friendsMap.get(vendorId) : null;
  const friendsToShow = ge.isSettlementGroup ? rawFriends : (vendor ? rawFriends.filter(f => f.id !== vendor.id) : rawFriends);

  const categoryColor = categoryObj?.color || 'var(--accent)';
  const isDebit = ge.flow === 'out';
  const flowSign = isDebit ? '-' : '+';

  // Compute settlement/split progress
  const splitItems = ge.items.filter((item: Expense) => !(item.type === 'personal' && (Number(item.amount) || 0) <= 0));
  const totalItemsCount = splitItems.length;
  const settledItemsCount = splitItems.filter(item => item.settled || item.type === 'personal').length;
  const settledPercent = totalItemsCount > 0 ? Math.round((settledItemsCount / totalItemsCount) * 100) : 100;
  const hasMultipleParticipants = totalItemsCount > 1 || ge.isSplit || ge.isSettlementGroup;

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
                <span>{ge.category}</span>
                {friendsToShow.length > 0 && (
                  <>
                    <span style={{ color: 'var(--text-3)', fontSize: 10 }}>•</span>
                    <span style={{ fontWeight: 600 }}>{friendsToShow.map(f => f.name).join(', ')}</span>
                  </>
                )}
                <span style={{ color: 'var(--text-3)', fontSize: 10 }}>•</span>
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

        {/* Settlement / Multi-Item Progress Block (Image 2 style) */}
        {hasMultipleParticipants && (
          <div
            style={{
              padding: '12px 14px',
              margin: '0 14px 6px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>Progress</span>
              <span style={{ color: 'var(--text)', fontWeight: 750 }}>{settledPercent}%</span>
            </div>
            {/* White progress bar on dark track */}
            <div style={{ height: 6, background: '#232530', borderRadius: 9999, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${settledPercent}%`,
                  background: '#ffffff',
                  borderRadius: 9999,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-2)', paddingTop: 1 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: settledPercent === 100 ? '#10b981' : 'var(--text-2)', fontWeight: 600 }}>
                {settledPercent === 100 ? '✓ All completed' : (ge.isSplit ? 'Split tracking' : 'In progress')}
              </span>
              <span>{settledItemsCount}/{totalItemsCount} completed</span>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div
          className="modal-body"
          style={{
            padding: '2px 14px 10px',
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
              {groupStatus.statusKey !== 'none' && groupStatus.statusLabel && (
                <span
                  style={{
                    padding: '3px 9px',
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: 9999,
                    background: groupStatus.statusKey === 'settled' ? 'var(--credit-bg)' : 'var(--debit-bg)',
                    border: `1px solid ${groupStatus.statusKey === 'settled' ? 'var(--credit-border)' : 'var(--debit-border)'}`,
                    color: groupStatus.statusKey === 'settled' ? 'var(--credit)' : 'var(--debit)',
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: groupStatus.statusKey === 'settled' ? 'var(--credit)' : 'var(--debit)' }} />
                  {ge.isSplit && <Users size={10} />}
                  <span>{groupStatus.statusLabel}</span>
                </span>
              )}
            </div>
          </div>

          {/* Details Grid Section */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              padding: '14px 16px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 18,
            }}
          >
            {/* Wallet */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <WalletIcon size={11} style={{ color: 'var(--text-3)' }} />
                Wallet
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)', wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 5 }}>
                {walletObj ? (
                  <>
                    {renderWalletIcon(walletObj.icon || walletObj.name, 12, walletObj.color)}
                    <span>{effectiveWalletName}</span>
                  </>
                ) : (
                  <span style={{ color: 'var(--text-2)' }}>{effectiveWalletName}</span>
                )}
              </span>
            </div>

            {/* Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} style={{ color: 'var(--text-3)' }} />
                Date
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)' }}>
                {fmtDate(ge.date)}
              </span>
            </div>

            {/* Category */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tag size={11} style={{ color: 'var(--text-3)' }} />
                Category
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <CategoryBadge category={ge.category} color={categoryObj?.color} icon={categoryObj?.icon} size={12} />
              </div>
            </div>

            {/* Vendor / Store if exists */}
            {vendor && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Store size={11} style={{ color: 'var(--text-3)' }} />
                  Store / Vendor
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)' }}>
                  {vendor.name}
                </span>
              </div>
            )}

            {/* Notes if exists */}
            {primaryItem.notes && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
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
          {!isTransfer && (ge.isSplit || ge.isSettlementGroup || (ge.items.length > 1 && ge.friendIds.length > 0)) && (
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
                    const isMine = item.type === 'personal';
                    const name = itemFriend?.name ?? 'Contact';

                    let primaryName = name;
                    let actionSubtitle = 'Split share';
                    const isSettled = item.settled || isMine || ge.isSettlementGroup;

                    if (ge.isSettlementGroup) {
                      const itemDesc = cleanExpenseDescription(item.description);
                      const itemDateStr = fmtDate(item.originalDate || item.date);
                      primaryName = itemDesc;
                      actionSubtitle = `Date: ${itemDateStr}`;
                    } else if (isMine) {
                      primaryName = 'You';
                      actionSubtitle = 'Your personal share';
                    } else if (item.type === 'for_friend') {
                      primaryName = name;
                      actionSubtitle = item.settled ? 'Paid their share to you' : 'Owes you their share';
                    } else if (item.type === 'by_friend') {
                      primaryName = name;
                      actionSubtitle = item.settled ? 'Paid bill' : (vendor ? 'Vendor bill' : 'You owe them');
                    }

                    const isSubDebit = item.type === 'by_friend' || item.type === 'personal';
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
                          {/* Circular Checkbox (Image 2 design) */}
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

                          {/* Avatar if contact */}
                          {!isMine && itemFriend && (
                            <span
                              className="avatar avatar-sm"
                              style={{
                                ...getAvatarStyle(itemFriend?.color),
                                width: 26,
                                height: 26,
                                fontSize: 10,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {friendInitial(itemFriend?.name ?? '?', itemFriend?.avatarNumber)}
                            </span>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: 13.5,
                                color: isSettled ? 'var(--text)' : 'var(--text)',
                                textDecoration: isSettled && !isMine ? 'none' : 'none',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {primaryName}
                            </span>
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
            padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))',
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
                height: 42,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 13.5,
                fontWeight: 700,
                borderRadius: 9999,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--accent)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onClick={() => {
                onClose();
                onUndo(ge.settlementId || ge.id);
              }}
            >
              <RotateCcw size={15} style={{ color: 'var(--accent)' }} />
              <span>Undo</span>
            </button>
          )}
          {!ge.isSettlementGroup && (
            <button
              type="button"
              className="btn"
              style={{
                flex: 1,
                height: 42,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 13.5,
                fontWeight: 700,
                borderRadius: 9999,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
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
              height: 42,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 13.5,
              fontWeight: 700,
              borderRadius: 9999,
              background: 'var(--debit-bg)',
              border: '1px solid var(--debit-border)',
              color: 'var(--debit)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
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

