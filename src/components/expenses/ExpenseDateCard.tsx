import React from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { fmtMoney, fmtDateWithDay, getRelativeDateLabel, type GroupedExpense } from '../../utils';
import type { Expense, Friend, Wallet, Category, Settlement } from '../../types';
import { ExpenseTableRow } from './ExpenseTableRow';
import { ExpenseMobileCard } from './ExpenseMobileCard';

export interface DateGroupItem {
  date: string;
  items: GroupedExpense[];
  totalOut: number;
  totalIn: number;
}

interface ExpenseDateCardProps {
  group: DateGroupItem;
  isCollapsed: boolean;
  onToggleCollapse: (date: string) => void;
  currency: string;
  isMobileScreen: boolean;
  categoriesMap: Map<string, Category>;
  settlementsMap: Map<string, Settlement>;
  walletsMap: Map<string, Wallet>;
  friendsMap: Map<string, Friend>;
  onSelectDetail: (ge: GroupedExpense) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onUndo: (id: string) => void;
  getGroupSettlementStatus: (ge: GroupedExpense) => { statusKey: string; statusLabel: string };
}

export const ExpenseDateCard: React.FC<ExpenseDateCardProps> = React.memo(({
  group,
  isCollapsed,
  onToggleCollapse,
  currency,
  isMobileScreen,
  categoriesMap,
  settlementsMap,
  walletsMap,
  friendsMap,
  onSelectDetail,
  onEdit,
  onDelete,
  onUndo,
  getGroupSettlementStatus,
}) => {
  const relativeLabel = getRelativeDateLabel(group.date);

  return (
    <div className="expense-date-card">
      {/* Collapsible Date Card Header */}
      <div
        className={`expense-date-card-header ${isCollapsed ? 'is-collapsed' : 'is-expanded'}`}
        onClick={() => onToggleCollapse(group.date)}
        role="button"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleCollapse(group.date);
          }
        }}
      >
        <div className="expense-date-header-left">
          <div className="expense-date-chevron">
            <ChevronDown size={15} className={`chevron-icon ${isCollapsed ? 'rotated' : ''}`} />
          </div>
          <div className="expense-date-label-wrap">
            <span className="expense-date-title">{fmtDateWithDay(group.date)}</span>
            {relativeLabel && <span className="badge-relative-date">{relativeLabel}</span>}
          </div>
          <span className="expense-date-count">
            {group.items.length}
          </span>
        </div>

        <div className="expense-date-header-right">
          {group.totalOut > 0 && (
            <span className="expense-date-stat debit">-{fmtMoney(group.totalOut, currency)}</span>
          )}
          {group.totalIn > 0 && (
            <span className="expense-date-stat credit">+{fmtMoney(group.totalIn, currency)}</span>
          )}
        </div>
      </div>

      {/* Card Content when extended */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="expense-date-card-body">
              {isMobileScreen ? (
                /* Mobile Expandable Cards View */
                <div className="mobile-expense-list">
                  {group.items.map((ge, idx) => {
                    const cat = categoriesMap.get(ge.category);
                    const stl = ge.items.reduce<Settlement | null | undefined>((found, item) => {
                      if (found) return found;
                      if (item.settlementId) return settlementsMap.get(item.settlementId);
                      return undefined;
                    }, null) || (ge.settlementId ? settlementsMap.get(ge.settlementId) : null);
                    const stlWallet = stl?.walletId ? walletsMap.get(stl.walletId) : undefined;
                    const wallet = ge.items.reduce<Wallet | null | undefined>((found, item) => {
                      if (found) return found;
                      return item.walletId ? walletsMap.get(item.walletId) : null;
                    }, null) || walletsMap.get(ge.walletId) || stlWallet;

                    const groupStatus = getGroupSettlementStatus(ge);

                    return (
                      <ExpenseMobileCard
                        key={`${ge.id}-${idx}`}
                        ge={ge}
                        currency={currency}
                        onSelectDetail={onSelectDetail}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onUndo={onUndo}
                        groupStatus={groupStatus}
                        categoryObj={cat}
                        walletObj={wallet}
                        friendsMap={friendsMap}
                        walletsMap={walletsMap}
                        settlementObj={stl}
                      />
                    );
                  })}
                </div>
              ) : (
                /* Desktop Table View */
                <div className="table-wrapper">
                  <table className="modern-tx-table">
                    <colgroup>
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '12%', minWidth: '80px' }} />
                    </colgroup>
                    <tbody>
                      {group.items.map((ge, idx) => {
                        const cat = categoriesMap.get(ge.category);
                        const stl = ge.items.reduce<Settlement | null | undefined>((found, item) => {
                          if (found) return found;
                          if (item.settlementId) return settlementsMap.get(item.settlementId);
                          return undefined;
                        }, null) || (ge.settlementId ? settlementsMap.get(ge.settlementId) : null);
                        const stlWallet = stl?.walletId ? walletsMap.get(stl.walletId) : undefined;
                        const wallet = ge.items.reduce<Wallet | null | undefined>((found, item) => {
                          if (found) return found;
                          return item.walletId ? walletsMap.get(item.walletId) : null;
                        }, null) || walletsMap.get(ge.walletId) || stlWallet;

                        const groupStatus = getGroupSettlementStatus(ge);

                        return (
                          <ExpenseTableRow
                            key={`${ge.id}-${idx}`}
                            ge={ge}
                            currency={currency}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onUndo={onUndo}
                            groupStatus={groupStatus}
                            categoryObj={cat}
                            walletObj={wallet}
                            friendsMap={friendsMap}
                            walletsMap={walletsMap}
                            settlementObj={stl}
                            onSelectDetail={onSelectDetail}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ExpenseDateCard.displayName = 'ExpenseDateCard';
