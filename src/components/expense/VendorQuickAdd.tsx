import { useState } from 'react';
import { Store, Plus } from 'lucide-react';
import type { Friend } from '../../types';
import FriendModal from '../FriendModal';

interface VendorQuickAddProps {
  vendorId: string;
  setVendorId: (id: string) => void;
  vendorsList: Friend[];
  addFriend?: (friend: Partial<Friend>) => Friend;
  showToast?: (msg: string) => void;
}

export function VendorQuickAdd({
  vendorId,
  setVendorId,
  vendorsList,
}: VendorQuickAddProps) {
  const [showVendorModal, setShowVendorModal] = useState(false);

  return (
    <div className="form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 18, height: 18, marginBottom: 4 }}>
        <label className="form-label" style={{ margin: 0, fontSize: 10.5, fontWeight: 750, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Store size={12} style={{ color: 'var(--text-3)' }} /> Vendor (Optional)
        </label>
        <button
          type="button"
          className="btn-micro-pill"
          onClick={() => setShowVendorModal(true)}
          title="Add new vendor"
        >
          <Plus size={11} /> Add
        </button>
      </div>

      <select
        className="form-select"
        value={vendorId}
        onChange={e => {
          if (e.target.value === '__add_new__') {
            setShowVendorModal(true);
          } else {
            setVendorId(e.target.value);
          }
        }}
      >
        <option value="">None</option>
        {vendorsList.map(v => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
        <option value="__add_new__">+ Add Store...</option>
      </select>

      {showVendorModal && (
        <FriendModal
          defaultType="vendor"
          onClose={() => setShowVendorModal(false)}
          onSuccess={(created) => {
            if (created?.id) {
              setVendorId(created.id);
            }
          }}
        />
      )}
    </div>
  );
}
