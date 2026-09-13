import React from 'react';
import { Wallet as WalletIcon } from 'lucide-react';
import type { Settlement, Friend, Wallet } from '../../types';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle } from '../../utils';
import { renderWalletIcon } from '../WalletIconRenderer';

interface SettlementCompactCardProps {
  settlement: Settlement;
  friend?: Friend;
  wallet?: Wallet;
  currency: string;
  onSelect: (s: Settlement) => void;
  onUndo?: (id: string) => void;
}

function getWalletIconNode(keyOrName?: string) {
  if (!keyOrName) return <WalletIcon size={13} strokeWidth={2} />;
  const rendered = renderWalletIcon(keyOrName, 13);
  return rendered || <WalletIcon size={13} strokeWidth={2} />;
}

export const SettlementCompactCard: React.FC<SettlementCompactCardProps> = React.memo(({
  settlement,
  friend,
  wallet,
  currency,
  onSelect,
}) => {
  const walletName = wallet?.name || settlement.paymentMethod;
  const amtVal = Number(settlement.amount) || 0;
  const isReceived = amtVal >= 0;
  const walletKeyOrName = wallet?.icon || wallet?.name || settlement.paymentMethod;
  const hasWallet = Boolean(walletKeyOrName);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
        {friend && (
          <div
            className="avatar"
            style={{
              ...getAvatarStyle(friend.color),
              width: 38,
              height: 38,
              fontSize: 13.5,
              fontWeight: 700,
              flexShrink: 0,
              borderRadius: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {friendInitial(friend.name, friend.avatarNumber)}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14.5,
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.3,
            }}
          >
            {friend ? friend.name : 'Deleted friend'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-3)',
              marginTop: 2.5,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ flexShrink: 0 }}>{fmtDate(settlement.date)}</span>
            {hasWallet && (
              <span
                title={walletName || 'Wallet'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 6px',
                  borderRadius: 6,
                  backgroundColor: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  fontSize: 11,
                  fontWeight: 550,
                  color: 'var(--text-2)',
                  flexShrink: 0,
                  lineHeight: 1.2,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, width: 13, height: 13 }}>
                  {getWalletIconNode(walletKeyOrName)}
                </span>
                {walletName && (
                  <span className="settlement-wallet-name-desktop" style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120, whiteSpace: 'nowrap' }}>
                    {walletName}
                  </span>
                )}
              </span>
            )}
            {settlement.note && (
              <span style={{ color: 'var(--text-3)', fontStyle: 'italic', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                "{settlement.note}"
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 14.5,
            color: isReceived ? 'var(--credit)' : 'var(--debit)',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {isReceived ? '+' : '-'}{fmtMoney(Math.abs(amtVal), currency)}
        </div>
      </div>
    </div>
  );
});

SettlementCompactCard.displayName = 'SettlementCompactCard';


