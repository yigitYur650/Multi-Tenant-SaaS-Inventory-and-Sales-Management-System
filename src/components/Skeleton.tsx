import React from 'react';
import { motion } from 'framer-motion';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-slate-200 animate-pulse rounded ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-6 w-12" />
      </div>
      <div className="pt-4 border-t border-slate-50 mt-auto flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-10" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-4" />
    </div>
  );
}
