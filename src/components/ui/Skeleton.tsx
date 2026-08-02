import React from 'react';

// ─── Base Skeleton Block ───────────────────────────────────────────────────────
interface SkeletonProps {
  className?: string;
  rounded?: string;
}
export function Skeleton({ className = '', rounded = 'rounded-xl' }: SkeletonProps) {
  return <div className={`skeleton-pulse ${rounded} ${className}`} />;
}

// ─── Post / Feed Card Skeleton ─────────────────────────────────────────────────
export function SkeletonPostCard() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 space-y-4 border border-slate-100 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 shrink-0" rounded="rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      {/* Body */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-4/6" />
      </div>
      {/* Image placeholder */}
      <Skeleton className="h-40 w-full" rounded="rounded-2xl" />
      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <Skeleton className="h-8 w-20" rounded="rounded-xl" />
        <Skeleton className="h-8 w-20" rounded="rounded-xl" />
        <Skeleton className="h-8 w-20" rounded="rounded-xl" />
      </div>
    </div>
  );
}

// ─── Job Card Skeleton (Compact) ───────────────────────────────────────────────
export function SkeletonJobCardCompact() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] p-4 border border-slate-100 dark:border-slate-800 flex items-center gap-4">
      <Skeleton className="w-12 h-12 shrink-0" rounded="rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-8 w-20 shrink-0" rounded="rounded-xl" />
    </div>
  );
}

// ─── Job Card Skeleton (Full) ──────────────────────────────────────────────────
export function SkeletonJobCard() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-800 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="w-14 h-14 shrink-0" rounded="rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" rounded="rounded-full" />
        <Skeleton className="h-6 w-20" rounded="rounded-full" />
        <Skeleton className="h-6 w-14" rounded="rounded-full" />
      </div>
      <Skeleton className="h-10 w-full" rounded="rounded-2xl" />
    </div>
  );
}

// ─── Conversation Item Skeleton ────────────────────────────────────────────────
export function SkeletonConversationItem() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="w-11 h-11 shrink-0" rounded="rounded-2xl" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

// ─── User / Network Card Skeleton ──────────────────────────────────────────────
export function SkeletonUserCard() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-800 space-y-4 text-center">
      <Skeleton className="w-16 h-16 mx-auto" rounded="rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-2/3 mx-auto" />
        <Skeleton className="h-3 w-1/2 mx-auto" />
      </div>
      <Skeleton className="h-9 w-full" rounded="rounded-xl" />
    </div>
  );
}

// ─── Profile Header Skeleton ────────────────────────────────────────────────────
export function SkeletonProfileHeader() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-36 w-full" rounded="rounded-[2rem]" />
      <div className="px-4 space-y-3 -mt-10">
        <Skeleton className="w-24 h-24" rounded="rounded-3xl" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-3.5 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-5 w-16" rounded="rounded-full" />
          <Skeleton className="h-5 w-20" rounded="rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ─── Application Card Skeleton ─────────────────────────────────────────────────
export function SkeletonApplicationCard() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.2rem] p-5 border border-slate-100 dark:border-slate-800">
      <div className="flex items-start gap-4">
        <Skeleton className="w-14 h-14 shrink-0" rounded="rounded-2xl" />
        <div className="flex-1 space-y-2.5">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-3 w-1/4" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-9 flex-1" rounded="rounded-xl" />
            <Skeleton className="h-9 w-9 shrink-0" rounded="rounded-xl" />
            <Skeleton className="h-9 w-9 shrink-0" rounded="rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Notification Item Skeleton ─────────────────────────────────────────────────
export function SkeletonNotificationItem() {
  return (
    <div className="flex items-start gap-3 p-4">
      <Skeleton className="w-10 h-10 shrink-0" rounded="rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

// ─── Analytics Stats Skeleton ──────────────────────────────────────────────────
export function SkeletonStatCard() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 space-y-3">
      <Skeleton className="w-10 h-10" rounded="rounded-2xl" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
