import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Tag,
  X,
} from 'lucide-react';
import { useFinanceStore } from '../store';
import { GlassCard } from '../components/ui/GlassCard';
import { formatCurrency } from '../utils/compoundEngine';
import { Transaction } from '../types';

export default function Transactions() {
  const { transactions, categories, addTransaction, deleteTransaction } = useFinanceStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const [newTransaction, setNewTransaction] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    categoryId: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === newTransaction.type);
  }, [categories, newTransaction.type]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (filterType !== 'all' && tx.type !== filterType) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            tx.description.toLowerCase().includes(query) ||
            tx.tags.some((t) => t.toLowerCase().includes(query))
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterType, searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTransaction.amount || !newTransaction.categoryId) return;

    addTransaction({
      type: newTransaction.type,
      amount: parseFloat(newTransaction.amount),
      categoryId: newTransaction.categoryId,
      date: newTransaction.date,
      description: newTransaction.description,
      tags: newTransaction.tags,
    });

    setNewTransaction({
      type: 'expense',
      amount: '',
      categoryId: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      tags: [],
    });
    setShowAddForm(false);
  };

  const addTag = () => {
    if (tagInput && !newTransaction.tags.includes(tagInput)) {
      setNewTransaction({
        ...newTransaction,
        tags: [...newTransaction.tags, tagInput],
      });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setNewTransaction({
      ...newTransaction,
      tags: newTransaction.tags.filter((t) => t !== tag),
    });
  };

  const getCategory = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId);
  };

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach((tx) => {
      const date = tx.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(tx);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [filteredTransactions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white mb-1">记账管理</h1>
          <p className="text-primary-400 text-sm">记录和管理您的收支明细</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-sky-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          快速记账
        </button>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-lg relative">
            <button
              onClick={() => setShowAddForm(false)}
              className="absolute top-4 right-4 p-2 hover:bg-primary-100/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-display font-bold text-white mb-6">添加交易</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2 mb-6">
                <button
                  type="button"
                  onClick={() =>
                    setNewTransaction({ ...newTransaction, type: 'expense', categoryId: '' })
                  }
                  className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                    newTransaction.type === 'expense'
                      ? 'bg-rose-500 text-white'
                      : 'bg-primary-100/50 text-primary-400 hover:bg-primary-100/70'
                  }`}
                >
                  支出
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNewTransaction({ ...newTransaction, type: 'income', categoryId: '' })
                  }
                  className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                    newTransaction.type === 'income'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-primary-100/50 text-primary-400 hover:bg-primary-100/70'
                  }`}
                >
                  收入
                </button>
              </div>

              <div>
                <label className="block text-sm text-primary-400 mb-2">金额</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400">¥</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newTransaction.amount}
                    onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                    className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 pl-10 pr-4 text-white placeholder-primary-400 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-primary-400 mb-2">分类</label>
                <div className="grid grid-cols-3 gap-2">
                  {filteredCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNewTransaction({ ...newTransaction, categoryId: cat.id })}
                      className={`p-3 rounded-xl text-center transition-all ${
                        newTransaction.categoryId === cat.id
                          ? 'bg-emerald-500/20 border border-emerald-500/50 text-white'
                          : 'bg-primary-100/50 text-primary-400 hover:bg-primary-100/70'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg mx-auto mb-1 flex items-center justify-center" style={{ backgroundColor: cat.color + '30' }}>
                        <span style={{ color: cat.color }}>{cat.name.charAt(0)}</span>
                      </div>
                      <span className="text-xs">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-primary-400 mb-2">日期</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
                  <input
                    type="date"
                    value={newTransaction.date}
                    onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                    className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-primary-400 mb-2">备注</label>
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 px-4 text-white placeholder-primary-400 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="添加备注说明..."
                />
              </div>

              <div>
                <label className="block text-sm text-primary-400 mb-2">标签</label>
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 pl-12 pr-4 text-white placeholder-primary-400 focus:outline-none focus:border-emerald-500/50 transition-colors"
                      placeholder="输入标签后按回车添加"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-3 bg-primary-100/50 rounded-xl text-primary-400 hover:bg-primary-100/70 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {newTransaction.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {newTransaction.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-white transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-3 bg-primary-100/50 text-primary-400 rounded-xl font-medium hover:bg-primary-100/70 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!newTransaction.amount || !newTransaction.categoryId}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-sky-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  保存
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      <GlassCard>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索交易..."
              className="w-full bg-primary-100/50 border border-primary-200/30 rounded-xl py-3 pl-12 pr-4 text-white placeholder-primary-400 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'income', 'expense'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  filterType === type
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-primary-100/50 text-primary-400 hover:bg-primary-100/70'
                }`}
              >
                {type === 'all' ? '全部' : type === 'income' ? '收入' : '支出'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6 max-h-[600px] overflow-y-auto scrollbar-thin">
          {groupedTransactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-100/50 flex items-center justify-center">
                <Filter className="w-8 h-8 text-primary-400" />
              </div>
              <p className="text-primary-400">暂无交易记录</p>
              <p className="text-sm text-primary-500 mt-1">点击"快速记账"开始记录</p>
            </div>
          ) : (
            groupedTransactions.map(([date, txs]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-primary-400" />
                  <span className="text-sm font-medium text-primary-400">
                    {new Date(date).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long',
                    })}
                  </span>
                </div>
                <div className="space-y-2">
                  {txs.map((tx) => {
                    const category = getCategory(tx.categoryId);
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-primary-100/30 hover:bg-primary-100/50 transition-colors group"
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: (category?.color || '#64748B') + '30' }}
                        >
                          {tx.type === 'income' ? (
                            <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <ArrowDownRight className="w-5 h-5 text-rose-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white truncate">
                              {category?.name || '未分类'}
                            </span>
                            {tx.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-primary-100/50 rounded text-xs text-primary-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          {tx.description && (
                            <p className="text-sm text-primary-400 truncate">{tx.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-mono font-bold ${
                              tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            {formatCurrency(tx.amount)}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteTransaction(tx.id)}
                          className="p-2 opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 rounded-lg transition-all text-rose-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}
