import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { Settlement, Friend, Wallet } from '../../types';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle } from '../../utils';

interface SettlementCompactCardProps {
  settlement: Settlement;
  friend?: Friend;
  wallet?: Wallet;
  currency: string;
  onSelect: (s: Settlement) => void;
  onUndo: (id: string) => void;
}

export const SettlementCompactCard: React.FC<SettlementCompactCardProps> = React.memo(({
  settlement,
  friend,
  wallet,
  currency,
  onSelect,
  onUndo,
}) => {
  const walletName = wallet?.name || settlement.paymentMethod;
  const amtVal = Number(settlement.amount) || 0;
  const isReceived = amtVal >= 0;

  return (
    <div
      className="settlement-compact-card"
      onClick={() => onSelect(settlement)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(settlement);
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        {friend && (
          <div
            className="avatar"
            style={{
              ...getAvatarStyle(friend.color),
              width: 32,
              height: 32,
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {friendInitial(friend.name, friend.avatarNumber)}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13.5,
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {friend ? friend.name : 'Deleted friend'}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-3)',
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {fmtDate(settlement.date)}{walletName ? ` · ${walletName}` : ''}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 10 }}>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: isReceived ? 'var(--credit)' : 'var(--debit)',
            }}
          >
            {isReceived ? '+' : '-'}{fmtMoney(Math.abs(amtVal), currency)}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-undo"
          onClick={(e) => {
            e.stopPropagation();
            onUndo(settlement.id);
          }}
          title="Undo settlement"
          aria-label="Undo settlement"
          style={{
            width: 28,
            height: 28,
            padding: 0,
            borderRadius: 7,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <RotateCcw size={12.5} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
});

SettlementCompactCard.displayName = 'SettlementCompactCard';
