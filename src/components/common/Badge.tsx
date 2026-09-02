import React from 'react';

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'md' }) => {
  const s = status.toUpperCase();
  let color = 'bg-slate-100 text-slate-700 border-slate-200';

  if (s === 'PAID') {
    color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (s === 'UNPAID') {
    color = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (s === 'PARTIAL') {
    color = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (s === 'OVERDUE') {
    color = 'bg-red-50 text-red-700 border-red-200';
  } else if (s === 'PREMIUM') {
    color = 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-xs';
  } else if (s === 'FREE') {
    color = 'bg-slate-100 text-slate-600 border-slate-300';
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span className={`inline-flex items-center rounded-full border ${padding} ${color}`}>
      {status}
    </span>
  );
};
