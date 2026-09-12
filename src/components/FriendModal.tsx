import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  X,
  User,
  Store,
  Tv,
  Pipette,
  Feather,
  RotateCcw,
  Plus,
  Calendar,
  Sparkles,
  Repeat,
  Check,
} from 'lucide-react';
import { useStore } from '../store';
import type { Friend, ContactType } from '../types';
import { FRIEND_PALETTE } from '../db';
import { getAvatarStyle } from '../utils';
import { POPULAR_SUBSCRIPTIONS, renderBrandLogo, detectBrandPreset } from './BrandIcons';
import { NoteEditorModal } from './common/NoteEditorModal';
import { showSoftKeyboard } from '../utils/keyboard';

interface Props {
  friend?: Friend | null;
  defaultType?: ContactType;
  onClose: () => void;
  onSuccess?: (createdFriend: Friend) => void;
}

interface CycleChoice {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeType?: 'accent' | 'success' | 'neutral';
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
}

const BILLING_CYCLE_CHOICES: CycleChoice[] = [
  {
    id: 'monthly',
    title: 'Monthly',
    subtitle: 'Billed once every month (30 days)',
    badge: 'Popular',
    badgeType: 'accent',
    icon: Calendar,
  },
  {
    id: 'yearly',
    title: 'Yearly / Annual',
    subtitle: 'Billed once every 12 months (annual plan)',
    badge: 'Save ~15%',
    badgeType: 'success',
    icon: Sparkles,
  },
  {
    id: 'custom',
    title: 'Custom Months',
    subtitle: 'Custom recurring period (e.g., 3 months, 6 months)',
    badge: 'Flexible',
    badgeType: 'neutral',
    icon: Repeat,
  },
];

const getCycleDisplayInfo = (cycle: string, amountStr?: string, currency = '₹') => {
  const amount = parseFloat(amountStr || '0') || 0;
  if (cycle === 'monthly') {
    return {
      title: 'Monthly Billing',
      sub: amount > 0 ? `Renews every month • ≈ ${currency} ${(amount * 12).toLocaleString()}/yr` : 'Renews every month (30 days)',
      badge: 'Monthly',
    };
  }
  if (cycle === 'yearly') {
    return {
      title: 'Yearly / Annual Billing',
      sub: amount > 0 ? `Renews annually • ≈ ${currency} ${(amount / 12).toFixed(1)}/mo` : 'Billed once a year (12 months)',
      badge: 'Yearly',
    };
  }
  // Custom months format (e.g., "every 3 months" or "3 months" or "custom")
  const match = cycle.match(/(\d+)/);
  const months = match ? parseInt(match[1]) : 3;
  return {
    title: `Every ${months} Month${months > 1 ? 's' : ''}`,
    sub: amount > 0 ? `Renews every ${months} mo • ≈ ${currency} ${(amount / months).toFixed(1)}/mo` : `Custom cycle: billed every ${months} months`,
    badge: `${months} Months`,
  };
};

export default function FriendModal({ friend, defaultType = 'friend', onClose, onSuccess }: Props) {
  const { db, addFriend, updateFriend, showToast } = useStore();
  const [type, setType] = useState<ContactType>(friend?.type ?? defaultType);
  const [name, setName] = useState(friend?.name ?? '');
  const [category, setCategory] = useState(friend?.category ?? (db.settings.categories[0]?.name || 'Food'));
  const [defaultAmount, setDefaultAmount] = useState(friend?.defaultAmount ? String(friend.defaultAmount) : '');
  const [billingCycle, setBillingCycle] = useState<string>(friend?.billingCycle ?? 'monthly');
  const [website] = useState(friend?.website ?? '');
  const [notes, setNotes] = useState(friend?.notes ?? '');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  // Billing Cycle Drawer State
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [tempCycle, setTempCycle] = useState<string>(() => {
    if (!friend?.billingCycle) return 'monthly';
    if (friend.billingCycle === 'monthly' || friend.billingCycle === 'yearly') return friend.billingCycle;
    return 'custom';
  });
  const [customMonths, setCustomMonths] = useState<number>(() => {
    if (friend?.billingCycle) {
      const match = friend.billingCycle.match(/(\d+)/);
      if (match) return parseInt(match[1]);
    }
    return 3;
  });

  const [color, setColor] = useState(() => friend?.color ?? FRIEND_PALETTE[Math.floor(Math.random() * FRIEND_PALETTE.length)]);
  const [avatarNumber, setAvatarNumber] = useState(friend?.avatarNumber ?? '');
  const [showNumberPicker, setShowNumberPicker] = useState(() => Boolean(friend?.avatarNumber));
  const [error, setError] = useState('');
  const friendColorInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus name input when contact/vendor/subscription modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      if (nameInputRef.current) {
        showSoftKeyboard(nameInputRef.current, { placeCursorAtEnd: true, scroll: true });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  const openNoteModal = () => {
    setIsNoteModalOpen(true);
  };

  const openCycleModal = () => {
    if (billingCycle === 'monthly' || billingCycle === 'yearly') {
      setTempCycle(billingCycle);
    } else {
      setTempCycle('custom');
      const match = billingCycle.match(/(\d+)/);
      if (match) setCustomMonths(parseInt(match[1]) || 3);
    }
    setIsCycleModalOpen(true);
  };

  const saveCycleFromModal = () => {
    if (tempCycle === 'custom') {
      setBillingCycle(`every ${customMonths} months`);
    } else {
      setBillingCycle(tempCycle);
    }
    setIsCycleModalOpen(false);
  };

  const handleClear = () => {
    setName('');
    setType(defaultType);
    setColor(friend?.color ?? FRIEND_PALETTE[0]);
    setAvatarNumber('');
    setShowNumberPicker(false);
    setDefaultAmount('');
    setBillingCycle('monthly');
    setNotes('');
    setError('');
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (type === 'subscription' && !friend) {
      const match = detectBrandPreset(val);
      if (match) {
        if (!defaultAmount && match.defaultAmount) setDefaultAmount(String(match.defaultAmount));
        if (match.color) setColor(match.color);
        if (match.category) setCategory(match.category);
      }
    }
  };

  const applyPreset = (preset: typeof POPULAR_SUBSCRIPTIONS[0]) => {
    setName(preset.name);
    setColor(preset.color);
    setCategory(preset.category);
    if (preset.defaultAmount) setDefaultAmount(String(preset.defaultAmount));
    setBillingCycle(preset.billingCycle);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!friend && db.friends.some(f => f.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('A contact with this name already exists.'); return;
    }

    const payload: Partial<Friend> = {
      name: name.trim(),
      type,
      category: type !== 'friend' ? category : undefined,
      defaultAmount: type === 'subscription' && defaultAmount ? parseFloat(defaultAmount) : undefined,
      billingCycle: type === 'subscription' ? billingCycle : undefined,
      website: website.trim(),
      notes: notes.trim(),
      color,
      avatarNumber: type === 'friend' && avatarNumber.trim() ? avatarNumber.trim() : undefined,
    };

    if (friend) {
      updateFriend(friend.id, payload);
      showToast(`${type === 'vendor' ? 'Vendor' : type === 'subscription' ? 'Subscription' : 'Friend'} updated`);
    } else {
      const created = addFriend(payload);
      showToast(`${type === 'vendor' ? 'Vendor' : type === 'subscription' ? 'Subscription' : 'Friend'} added`);
      if (onSuccess) {
        onSuccess(created);
      }
    }
    onClose();
  };

  const namePlaceholder =
    type === 'vendor'
      ? 'e.g. Tiffin Aunty, Amazon, Local Grocer'
      : type === 'subscription'
      ? 'e.g. Netflix, Spotify, ChatGPT'
      : 'e.g. Alex, Priya, Rahul';

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        className="modal friend-drawer-modal modal-dialog-panel"
        onClick={e => e.stopPropagation()}
      >
        {/* Top drag handle pill */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'var(--border2)',
            margin: '0 auto 16px',
          }}
        />

        {/* Themed Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '0 20px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
                flexShrink: 0,
              }}
            >
              {type === 'subscription' ? <Tv size={19} /> : type === 'vendor' ? <Store size={19} /> : <User size={19} />}
            </div>
            <div>
              <span className="modal-title" style={{ fontSize: 16, fontWeight: 700 }}>
                {friend
                  ? (type === 'subscription' ? 'Edit Subscription' : type === 'vendor' ? 'Edit Vendor' : 'Edit Friend')
                  : (type === 'subscription' ? 'New Subscription' : type === 'vendor' ? 'New Vendor' : 'New Contact')}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btn-icon"
              onClick={openNoteModal}
              title={notes ? `Note: "${notes}"` : 'Add note'}
              aria-label={notes ? 'Edit note' : 'Add note'}
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: notes ? 'var(--text)' : 'var(--text-3)',
                background: notes ? 'var(--surface2)' : 'transparent',
                border: notes ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px', gap: 14, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Type Selector (Segmented 3-tab control) */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    color: 'var(--text-3)',
                    marginBottom: 6,
                    textAlign: 'left',
                  }}
                >
                  Contact Type
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 4,
                    background: 'var(--surface2)',
                    padding: 4,
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                  }}
                >
                  {[
                    { id: 'friend' as const, label: 'Friend', icon: User },
                    { id: 'vendor' as const, label: 'Vendor', icon: Store },
                    { id: 'subscription' as const, label: 'Subscription', icon: Tv },
                  ].map(tab => {
                    const isSelected = type === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setType(tab.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '8px 6px',
                          borderRadius: 9,
                          border: isSelected ? '1px solid var(--text)' : '1px solid transparent',
                          background: isSelected ? 'var(--text)' : 'transparent',
                          color: isSelected ? 'var(--bg)' : 'var(--text-3)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: 12.5,
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 2px 6px rgba(0, 0, 0, 0.25)' : 'none',
                          minHeight: 38,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Icon size={15} style={{ color: isSelected ? 'var(--bg)' : 'inherit' }} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Popular Subscription Presets */}
              {type === 'subscription' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                        color: 'var(--text-3)',
                        margin: 0,
                        textAlign: 'left',
                      }}
                    >
                      Popular Presets
                    </label>
                    <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Tap to fill</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      width: '100%',
                    }}
                  >
                    {POPULAR_SUBSCRIPTIONS.slice(0, 4).map(sub => {
                      const isSelected = name.toLowerCase() === sub.name.toLowerCase();
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => applyPreset(sub)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 9999,
                            border: `1px solid ${isSelected ? 'var(--border2)' : 'var(--border)'}`,
                            background: isSelected ? 'var(--surface)' : 'var(--surface2)',
                            color: isSelected ? 'var(--text)' : 'var(--text-2)',
                            fontSize: 12,
                            fontWeight: isSelected ? 650 : 500,
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {sub.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Name Input */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    color: 'var(--text-3)',
                    marginBottom: 5,
                    textAlign: 'left',
                  }}
                >
                  {type === 'vendor' ? 'Vendor Name *' : type === 'subscription' ? 'Subscription Name *' : 'Name *'}
                </label>
                <input
                  ref={nameInputRef}
                  className="form-input"
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 10,
                    fontSize: 13.5,
                    fontWeight: 500,
                    textAlign: 'left',
                    padding: '0 12px',
                    border: error ? '1.5px solid var(--debit, #ef4444)' : '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                  value={name}
                  onChange={e => {
                    handleNameChange(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder={namePlaceholder}
                />
              </div>

              {/* Category & Cost Grid Row */}
              {type === 'subscription' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 10 }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          color: 'var(--text-3)',
                          marginBottom: 5,
                          textAlign: 'left',
                        }}
                      >
                        Category
                      </label>
                      <select
                        className="form-select"
                        style={{
                          width: '100%',
                          height: 40,
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 500,
                          padding: '0 10px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface2)',
                          color: 'var(--text)',
                          outline: 'none',
                        }}
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                      >
                        {db.settings.categories.map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          color: 'var(--text-3)',
                          marginBottom: 5,
                          textAlign: 'left',
                        }}
                      >
                        Cost ({db.settings.currency})
                      </label>
                      <input
                        className="form-input"
                        style={{
                          width: '100%',
                          height: 40,
                          borderRadius: 10,
                          fontSize: 13.5,
                          fontWeight: 500,
                          padding: '0 12px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface2)',
                          color: 'var(--text)',
                          outline: 'none',
                        }}
                        type="number"
                        step="any"
                        value={defaultAmount}
                        onChange={e => setDefaultAmount(e.target.value)}
                        placeholder="e.g. 649"
                      />
                    </div>
                  </div>

                  {/* Interactive Billing Cycle Banner Card */}
                  <div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={openCycleModal}
                      style={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: '10px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border-soft, var(--accent))')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'var(--accent-soft)',
                            color: 'var(--accent)',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            fontSize: 13,
                            flexShrink: 0,
                          }}
                        >
                          <Repeat size={16} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getCycleDisplayInfo(billingCycle, defaultAmount, db.settings.currency).title}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getCycleDisplayInfo(billingCycle, defaultAmount, db.settings.currency).sub}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          background: 'var(--text)',
                          color: 'var(--bg)',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          flexShrink: 0,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                        }}
                      >
                        <span>{getCycleDisplayInfo(billingCycle, defaultAmount, db.settings.currency).badge}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : type === 'vendor' ? (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      color: 'var(--text-3)',
                      marginBottom: 5,
                      textAlign: 'left',
                    }}
                  >
                    Category
                  </label>
                  <select
                    className="form-select"
                    style={{
                      width: '100%',
                      height: 40,
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 500,
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      outline: 'none',
                    }}
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    {db.settings.categories.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* Minimized Avatar Theme Color Row */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      color: 'var(--text-3)',
                      margin: 0,
                      textAlign: 'left',
                    }}
                  >
                    Avatar Color
                  </label>
                  {type === 'friend' && (
                    <button
                      type="button"
                      onClick={() => setShowNumberPicker(!showNumberPicker)}
                      style={{
                        fontSize: 11,
                        fontWeight: showNumberPicker || avatarNumber ? 650 : 500,
                        color: showNumberPicker || avatarNumber ? 'var(--text)' : 'var(--text-2)',
                        background: showNumberPicker || avatarNumber ? 'var(--surface)' : 'var(--surface2)',
                        border: '1px solid ' + (showNumberPicker || avatarNumber ? 'var(--border2)' : 'var(--border)'),
                        boxShadow: showNumberPicker || avatarNumber ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                        padding: '3px 10px',
                        borderRadius: 9999,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        transition: 'all 0.15s ease',
                      }}
                      title="Secret option: Use custom number badge instead of initial"
                    >
                      <span># Number Badge</span>
                      {avatarNumber ? (
                        <span style={{ background: 'var(--accent)', color: 'var(--accent-contrast, #fff)', padding: '0 5px', borderRadius: 6, fontSize: 9, fontWeight: 700 }}>
                          {avatarNumber}
                        </span>
                      ) : null}
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'var(--surface2)',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Mini Avatar Preview */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      ...getAvatarStyle(color),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: avatarNumber && avatarNumber.length > 2 ? 9 : 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    }}
                  >
                    {type === 'subscription' && renderBrandLogo(name, 14)
                      ? renderBrandLogo(name, 14)
                      : type === 'vendor'
                      ? <Store size={13} />
                      : type === 'subscription'
                      ? <Tv size={13} />
                      : (avatarNumber.trim() || (name ? name.slice(0, 1).toUpperCase() : <User size={13} />))}
                  </div>

                  {/* Compact Swatches */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                    {FRIEND_PALETTE.map(c => {
                      const isSelected = color === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: c,
                            border: isSelected ? '2px solid var(--surface)' : '1px solid rgba(0,0,0,0.15)',
                            outline: isSelected ? '2px solid var(--accent)' : 'none',
                            outlineOffset: 1,
                            cursor: 'pointer',
                            padding: 0,
                            flexShrink: 0,
                            transition: 'transform 0.12s ease',
                            transform: isSelected ? 'scale(1.18)' : 'scale(1)',
                          }}
                          aria-label={`Select color ${c}`}
                        />
                      );
                    })}

                    {/* Custom Color Picker Swatch */}
                    <button
                      type="button"
                      onClick={() => {
                        if (friendColorInputRef.current) {
                          try {
                            if ('showPicker' in friendColorInputRef.current && typeof friendColorInputRef.current.showPicker === 'function') {
                              friendColorInputRef.current.showPicker();
                              return;
                            }
                          } catch {
                            // Fallback
                          }
                          friendColorInputRef.current.click();
                        }
                      }}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: !FRIEND_PALETTE.includes(color)
                          ? color
                          : 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                        border: !FRIEND_PALETTE.includes(color) ? '2px solid var(--surface)' : '1px solid var(--border)',
                        outline: !FRIEND_PALETTE.includes(color) ? '2px solid var(--accent)' : 'none',
                        outlineOffset: 1,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                      title="Pick custom color"
                    >
                      <Pipette size={9} color="#FFFFFF" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.8))' }} />
                    </button>

                    <input
                      ref={friendColorInputRef}
                      type="color"
                      value={color.startsWith('#') && color.length === 7 ? color : '#3B82F6'}
                      onChange={e => setColor(e.target.value)}
                      style={{
                        position: 'absolute',
                        opacity: 0,
                        width: 1,
                        height: 1,
                        pointerEvents: 'none',
                        visibility: 'hidden',
                      }}
                    />
                  </div>
                </div>

                {/* Secret Number Option Box */}
                {type === 'friend' && showNumberPicker && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-2)' }}>
                        Secret Number Badge (0 to 99)
                      </span>
                      {avatarNumber ? (
                        <button
                          type="button"
                          onClick={() => setAvatarNumber('')}
                          style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          Reset to Initial ({name ? name.slice(0, 1).toUpperCase() : 'A'})
                        </button>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="0-99"
                        value={avatarNumber}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                          setAvatarNumber(val);
                        }}
                        style={{
                          width: 54,
                          padding: '4px 6px',
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          textAlign: 'center',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {['00', '07', '10', '23', '35', '69', '99'].map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setAvatarNumber(num)}
                            style={{
                              padding: '2px 7px',
                              fontSize: 10.5,
                              fontWeight: avatarNumber === num ? 650 : 500,
                              borderRadius: 6,
                              border: avatarNumber === num ? '1px solid var(--border2)' : '1px solid var(--border)',
                              background: avatarNumber === num ? 'var(--surface)' : 'var(--surface2)',
                              color: avatarNumber === num ? 'var(--text)' : 'var(--text-2)',
                              boxShadow: avatarNumber === num ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                              cursor: 'pointer',
                              transition: 'all 0.12s ease',
                            }}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="form-error" style={{ margin: '2px 0 0' }}>{error}</p>}

              {/* Action Buttons: Clear & Submit (Matching Transfer & Add Wallet Drawers) */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleClear}
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
                  <RotateCcw size={14} style={{ color: 'var(--text)' }} />
                  <span>Clear</span>
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
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
                  {friend ? <Check size={15} style={{ color: 'inherit' }} /> : <Plus size={15} style={{ color: 'inherit' }} />}
                  <span>{friend ? 'Save' : type === 'vendor' ? 'Add Vendor' : type === 'subscription' ? 'Add Subscription' : 'Add Contact'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Separate Dedicated Note Drawer Modal */}
        <NoteEditorModal
          isOpen={isNoteModalOpen}
          onClose={() => setIsNoteModalOpen(false)}
          title={type === 'subscription' ? 'Subscription Note' : type === 'vendor' ? 'Vendor Note' : 'Contact Note'}
          initialNote={notes}
          onSave={(newNote) => {
            setNotes(newNote);
          }}
          quickTags={
            type === 'subscription'
              ? ['Family plan share', 'Annual renewal', 'Card auto-debit', 'Shared with roomies', 'Free trial active']
              : type === 'vendor'
              ? ['Monthly supply', 'UPI payment preferred', 'Monthly billing', 'Shop contact', 'Frequent vendor']
              : ['Roommate', 'Family', 'Office colleague', 'Splitwise friend', 'UPI ID']
          }
        />

        {/* Dedicated Billing Cycle Drawer Modal */}
        {isCycleModalOpen && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 100085, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) setIsCycleModalOpen(false); }}
          >
            <div className="modal friend-drawer-modal" style={{ maxWidth: 420, maxHeight: '88vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 20, background: 'var(--surface)', animation: 'slidein 0.15s ease' }}>
              <div className="modal-handle-bar">
                <div className="modal-handle" />
              </div>
              <div className="modal-header" style={{ padding: '14px 18px', borderBottom: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                    <Repeat size={15} />
                  </div>
                  <div>
                    <div className="modal-title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                      Select Billing Cycle
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      Choose how frequently this subscription recurs
                    </div>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setIsCycleModalOpen(false)} style={{ borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}><X size={16} /></button>
              </div>

              <div className="modal-body" style={{ padding: '12px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {BILLING_CYCLE_CHOICES.map(choice => {
                  const isSelected = tempCycle === choice.id;
                  const ChoiceIcon = choice.icon;
                  return (
                    <div
                      key={choice.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setTempCycle(choice.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '11px 13px',
                        borderRadius: 10,
                        border: isSelected ? '1px solid var(--border2)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--surface)' : 'var(--surface2)',
                        boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            background: isSelected ? 'var(--accent-gradient, var(--accent))' : 'var(--surface)',
                            color: isSelected ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <ChoiceIcon size={15} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--accent)' : 'var(--text-1)' }}>
                              {choice.title}
                            </span>
                            {choice.badge && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 99,
                                  background: choice.badgeType === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent-soft)',
                                  color: choice.badgeType === 'success' ? 'var(--credit)' : 'var(--accent)',
                                  border: choice.badgeType === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--accent-border-soft)',
                                }}
                              >
                                {choice.badge}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                            {choice.subtitle}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: isSelected ? 'none' : '1.5px solid var(--border2)',
                          background: isSelected ? 'var(--accent)' : 'transparent',
                          color: 'var(--accent-contrast, #ffffff)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          marginLeft: 8,
                        }}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}

                {/* If Custom Months is selected, show streamlined month presets & input */}
                {tempCycle === 'custom' && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'var(--surface3, var(--surface))',
                      border: '1px solid var(--accent-border-soft, var(--border))',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>
                        Select number of months:
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                        Every {customMonths} Month{customMonths > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Quick Month Chips */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                      {[2, 3, 6, 9].map(m => {
                        const isChipSelected = customMonths === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setCustomMonths(m)}
                            style={{
                              padding: '5px 0',
                              fontSize: 11.5,
                              fontWeight: isChipSelected ? 650 : 500,
                              borderRadius: 8,
                              border: isChipSelected ? '1px solid var(--border2)' : '1px solid var(--border)',
                              background: isChipSelected ? 'var(--surface)' : 'var(--surface2)',
                              color: isChipSelected ? 'var(--text)' : 'var(--text-2)',
                              boxShadow: isChipSelected ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
                              cursor: 'pointer',
                            }}
                          >
                            {m} Mo
                          </button>
                        );
                      })}
                    </div>

                    {/* Stepper / Direct Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Or custom value:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)' }}
                          onClick={() => setCustomMonths(prev => Math.max(1, prev - 1))}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          className="form-input"
                          style={{ height: 28, textAlign: 'center', fontSize: 12.5, fontWeight: 700, padding: '2px 6px', width: 60, borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                          value={customMonths}
                          onChange={e => setCustomMonths(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)' }}
                          onClick={() => setCustomMonths(prev => Math.min(60, prev + 1))}
                        >
                          +
                        </button>
                        <span style={{ fontSize: 11.5, color: 'var(--text-2)', marginLeft: 4 }}>months</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Live calculated equivalent preview if amount is entered */}
                {defaultAmount && parseFloat(defaultAmount) > 0 && (
                  <div
                    style={{
                      marginTop: 2,
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: 'var(--surface3, var(--surface))',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-around',
                      alignItems: 'center',
                      fontSize: 11,
                      color: 'var(--text-2)',
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-3)', fontSize: 10 }}>Monthly Equivalent</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-1)', marginTop: 1 }}>
                        {db.settings.currency} {tempCycle === 'yearly'
                          ? (parseFloat(defaultAmount) / 12).toFixed(1)
                          : tempCycle === 'custom'
                          ? (parseFloat(defaultAmount) / customMonths).toFixed(1)
                          : parseFloat(defaultAmount).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-3)', fontSize: 10 }}>Annualized Cost</div>
                      <div style={{ fontWeight: 700, color: 'var(--accent)', marginTop: 1 }}>
                        {db.settings.currency} {tempCycle === 'yearly'
                          ? parseFloat(defaultAmount).toLocaleString()
                          : tempCycle === 'monthly'
                          ? (parseFloat(defaultAmount) * 12).toLocaleString()
                          : ((parseFloat(defaultAmount) / customMonths) * 12).toFixed(0)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: 'none', background: 'var(--surface)' }}>
                <button type="button" className="btn btn-secondary btn-sm" style={{ borderRadius: 8, fontSize: 12, height: 34, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} onClick={() => setIsCycleModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ borderRadius: 8, fontSize: 12, padding: '0 16px', height: 34, background: 'var(--accent-gradient, var(--accent))', color: 'var(--accent-contrast, #ffffff)', border: '1px solid var(--accent-dark, var(--accent))' }}
                  onClick={saveCycleFromModal}
                >
                  ✓ Apply Cycle
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
