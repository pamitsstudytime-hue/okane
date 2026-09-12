import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, Calendar, ReceiptText, Feather, Wallet, Check } from 'lucide-react';
import { useStore } from '../store';
import type { Friend } from '../types';
import { expenseFlow, unsettledExpensesForFriend, todayISO } from '../db';
import { fmtMoney, friendInitial, getAvatarStyle } from '../utils';
import SettleExpensePickerModal from './SettleExpensePickerModal';
import { NoteEditorModal } from './common/NoteEditorModal';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

interface Props {
  friend: Friend;
  onClose: () => void;
}

export default function SettleModal({ friend, onClose }: Props) {
  useBackButtonModal(true, onClose, { priority: BackPriority.MODAL });

  const { db, recordSettlement, showToast } = useStore();
  const { wallets, settings: { currency } } = db;

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const unsettled = useMemo(() => unsettledExpensesForFriend(db, friend.id), [db, friend.id]);
  const [selected, setSelected] = useState<Set<string>>(new Set(unsettled.map(e => e.id)));
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  useBackButtonModal(isPickerOpen, () => setIsPickerOpen(false), { priority: BackPriority.DIALOG });
  useBackButtonModal(isNoteModalOpen, () => setIsNoteModalOpen(false), { priority: BackPriority.DIALOG });
  const [selectedWalletId, setSelectedWalletId] = useState<string>(
    db.settings.defaultWalletId || wallets[0]?.id || ''
  );
  const [settleDate, setSettleDate] = useState<string>(todayISO());
  const [note, setNote] = useState('');

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customAmountStr, setCustomAmountStr] = useState('');

  const selectedArr = unsettled.filter(e => selected.has(e.id));

  const { owedToMe, owedByMe } = useMemo(() => {
    let toMe = 0;
    let byMe = 0;
    selectedArr.forEach(e => {
      const amt = Number(e.amount) || 0;
      const isIncoming = expenseFlow(e) === 'in';
      const isSettlingVendor = e.vendorId === friend.id;
      const isSettlingFriend = e.friendId === friend.id;

      if (isSettlingVendor) {
        if (isIncoming) toMe += amt;
        else byMe += amt;
      } else if (isSettlingFriend) {
        if (e.type === 'for_friend') {
          if (isIncoming) toMe -= amt;
          else toMe += amt;
        } else if (e.type === 'by_friend') {
          if (isIncoming) byMe -= amt;
          else byMe += amt;
        } else if (e.status === 'unpaid') {
          if (isIncoming) toMe += amt;
          else byMe += amt;
        }
      } else {
        if (isIncoming) toMe += amt;
        else byMe += amt;
      }
    });
    return { owedToMe: toMe, owedByMe: byMe };
  }, [selectedArr, friend.id]);

  const net = owedToMe - owedByMe;
  const absNet = Math.abs(net);

  const parsedCustom = parseFloat(customAmountStr);
  const effectiveSettleAmt = isCustomMode && !isNaN(parsedCustom) && parsedCustom > 0 ? parsedCustom : absNet;
  const remainingBalance = Math.max(0, absNet - effectiveSettleAmt);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(unsettled.map(e => e.id)));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const openNoteModal = () => {
    setIsNoteModalOpen(true);
  };

  const handleSettle = () => {
    if (!selected.size) return;
    const customVal = isCustomMode && !isNaN(parsedCustom) && parsedCustom > 0 ? parsedCustom : undefined;
    recordSettlement(friend.id, Array.from(selected), note, selectedWalletId, customVal, settleDate);
    const targetWallet = wallets.find(w => w.id === selectedWalletId);
    const wName = targetWallet?.name || 'Wallet';
    const actionText = net >= 0 ? `credited to ${wName}` : `deducted from ${wName}`;
    const remText = remainingBalance > 0 ? ` • ${fmtMoney(remainingBalance, currency)} remaining` : '';
    showToast(`Settled ${fmtMoney(effectiveSettleAmt, currency)} (${actionText})${remText}`);
    onClose();
  };

  const activeWallet = wallets.find(w => w.id === selectedWalletId);

  return createPortal(
    <div className="modal-backdrop-motion">
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="modal-backdrop-overlay"
        onClick={onClose}
      />

      {/* Sheet panel / Desktop center dialog */}
      <motion.div
        initial={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        animate={isMobileScreen ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: isMobileScreen ? 0.32 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="modal modal-dialog-panel"
        style={{
          maxWidth: 560,
          width: '100%',
          maxHeight: 'min(90vh, 90dvh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag Handle Indicator */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'var(--border2)',
            margin: '12px auto 10px',
            flexShrink: 0,
          }}
        />

        {/* Themed Modal Header */}
        <div className="modal-header" style={{ padding: '0 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
                flexShrink: 0,
              }}
            >
              <div className="avatar" style={{ ...getAvatarStyle(friend.color), width: 34, height: 34, borderRadius: 10 }}>
                {friendInitial(friend.name, friend.avatarNumber)}
              </div>
            </div>
            <div>
              <span className="modal-title" style={{ fontSize: 16, fontWeight: 700 }}>
                Settle with {friend.name}
              </span>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                {unsettled.length} unsettled transaction{unsettled.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Note Drawer Button Trigger */}
            <button
              type="button"
              className={`btn-icon ${note ? 'has-note' : ''}`}
              onClick={openNoteModal}
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: note ? 'var(--text)' : 'var(--text-3)',
                background: note ? 'var(--surface2)' : 'transparent',
                border: note ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={note ? `Note: "${note}"` : 'Add note'}
              aria-label={note ? 'Edit note' : 'Add note'}
            >
              <Feather size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '16px 20px 20px' }}>
          {unsettled.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <p>No unsettled expenses with {friend.name}.</p>
            </div>
          ) : (
            <>
              {/* Tap to Select Expenses Banner */}
              <div style={{ marginBottom: 14 }}>
                <div
                  onClick={() => setIsPickerOpen(true)}
                  style={{
                    padding: '12px 16px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      <ReceiptText size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selected.size === 0
                          ? 'Tap to Select Expenses'
                          : selected.size === unsettled.length
                          ? `All ${unsettled.length} Expenses Selected`
                          : `${selected.size} of ${unsettled.length} Expenses Selected`}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selected.size > 0 ? (
                          <>
                            Net Total: <strong style={{ color: net >= 0 ? 'var(--credit)' : 'var(--debit)' }}>{fmtMoney(absNet, currency)}</strong>
                            {' • '}
                            <span>{unsettled.length} available</span>
                          </>
                        ) : (
                          `Choose from ${unsettled.length} unsettled transaction${unsettled.length !== 1 ? 's' : ''}`
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--accent-contrast, #ffffff)',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    {selected.size > 0 ? 'Edit' : '+ Select'}
                  </button>
                </div>
              </div>

              {/* Settle Amount Mode Segment Toggle */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
                  Settle Mode
                </div>
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 3,
                    gap: 3,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: !isCustomMode ? 650 : 500,
                      borderRadius: 6,
                      border: !isCustomMode ? '1px solid var(--border2)' : '1px solid transparent',
                      background: !isCustomMode ? 'var(--surface)' : 'transparent',
                      color: !isCustomMode ? 'var(--text)' : 'var(--text-3)',
                      boxShadow: !isCustomMode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => {
                      setIsCustomMode(false);
                      setCustomAmountStr('');
                    }}
                  >
                    Full ({fmtMoney(absNet, currency)})
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: isCustomMode ? 650 : 500,
                      borderRadius: 6,
                      border: isCustomMode ? '1px solid var(--border2)' : '1px solid transparent',
                      background: isCustomMode ? 'var(--surface)' : 'transparent',
                      color: isCustomMode ? 'var(--text)' : 'var(--text-3)',
                      boxShadow: isCustomMode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => {
                      setIsCustomMode(true);
                      if (!customAmountStr) setCustomAmountStr(String(absNet));
                    }}
                  >
                    Custom / Partial
                  </button>
                </div>
              </div>

              {/* Compact Custom Amount Input Field */}
              {isCustomMode && (
                <div style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>
                      Custom Amount ({currency})
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      Total due: {fmtMoney(absNet, currency)}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    placeholder={`Enter amount (e.g. ${Math.round(absNet / 2)})`}
                    value={customAmountStr}
                    onChange={e => setCustomAmountStr(e.target.value)}
                    style={{
                      width: '100%',
                      fontWeight: 700,
                      fontSize: 14,
                      height: 38,
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      padding: '0 10px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              {/* Clean Summary Card */}
              <div
                style={{
                  background: 'var(--surface2)',
                  borderRadius: 'var(--radius)',
                  padding: '10px 14px',
                  marginBottom: 14,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, marginBottom: 5 }}>
                  <span style={{ color: 'var(--text-3)' }}>Total Debt Selected</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fmtMoney(absNet, currency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: remainingBalance > 0 ? 5 : 0 }}>
                  <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>Amount Settling Now</span>
                  <span style={{ fontWeight: 700, color: net >= 0 ? 'var(--credit)' : 'var(--debit)', fontSize: 13.5 }}>
                    {net >= 0 ? '+' : '-'}{fmtMoney(effectiveSettleAmt, currency)}
                  </span>
                </div>
                {isCustomMode && remainingBalance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-3)', borderTop: '1px dashed var(--border)', paddingTop: 6, marginTop: 5 }}>
                    <span>Remaining Balance</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                      {fmtMoney(remainingBalance, currency)}
                    </span>
                  </div>
                )}
              </div>

              {/* Date & Payment Method in One Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 6 }}>
                {/* Settle Date */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <Calendar size={13} style={{ color: 'var(--accent)' }} />
                    <span>Settle Date</span>
                  </label>
                  <input
                    type="date"
                    value={settleDate}
                    onChange={e => setSettleDate(e.target.value)}
                    style={{
                      width: '100%',
                      fontWeight: 600,
                      height: 40,
                      fontSize: 12.5,
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      padding: '0 10px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Payment Method (Wallet) Dropdown */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <Wallet size={13} style={{ color: 'var(--accent)' }} />
                    <span>Payment Method</span>
                  </label>
                  <div>
                    <select
                      value={selectedWalletId}
                      onChange={e => {
                        const wId = e.target.value;
                        setSelectedWalletId(wId);
                        const selW = wallets.find(w => w.id === wId);
                        if (selW && (!note || note.startsWith('Paid via ') || note.startsWith('Settled via '))) {
                          setNote(`Paid via ${selW.name}`);
                        }
                      }}
                      style={{
                        width: '100%',
                        height: 40,
                        fontSize: 12.5,
                        fontWeight: 600,
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface2)',
                        color: 'var(--text)',
                        padding: '0 12px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    >
                      {wallets.map(w => (
                        <option key={w.id} value={w.id} style={{ background: 'var(--surface)', color: 'var(--text)' }}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '10px 20px 16px',
            display: 'flex',
            gap: 10,
            borderTop: 'none',
            background: 'transparent',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={onClose}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 650,
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              cursor: 'pointer',
              padding: '0 16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <X size={15} style={{ color: 'var(--text)' }} />
            <span>Cancel</span>
          </button>
          {unsettled.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selected.size || (isCustomMode && (!customAmountStr || effectiveSettleAmt <= 0))}
              onClick={handleSettle}
              style={{
                flex: 1.35,
                height: 40,
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 700,
                background: 'var(--text)',
                border: '1px solid var(--text)',
                color: 'var(--bg)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                cursor: 'pointer',
                padding: '0 18px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Check size={15} style={{ color: 'inherit' }} />
              <span>Settle ({fmtMoney(effectiveSettleAmt, currency)})</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Separate Dedicated Note Modal */}
      <NoteEditorModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title="Settle Note"
        initialNote={note}
        onSave={(newNote) => setNote(newNote)}
        placeholder="Add optional settle remarks, payment reference or note..."
        quickTags={
          activeWallet
            ? [`Paid via ${activeWallet.name}`, 'Cash repayment', 'Settled in full', 'Bill share', 'UPI Transfer', 'Bank Transfer']
            : ['Paid via Google Pay', 'Cash repayment', 'Settled in full', 'Bill share', 'UPI Transfer', 'Bank Transfer']
        }
      />

      {/* Settle Expense Picker Drawer Modal */}
      {isPickerOpen && (
        <SettleExpensePickerModal
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          friend={friend}
          expenses={unsettled}
          selectedIds={selected}
          onToggle={toggle}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          currency={currency}
          db={db}
          title="Select Expenses to Settle"
        />
      )}
    </div>,
    document.body
  );
}
