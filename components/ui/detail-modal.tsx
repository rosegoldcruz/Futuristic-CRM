"use client";

import { ReactNode, useEffect, useRef } from "react";

type DetailModalProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export function DetailModal({ title, subtitle, onClose, children }: DetailModalProps) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bgDarkest/80 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-modal-title"
        className="cyber-card-tw border-cyber-cyan/30 shadow-cyberMd max-h-[90vh] w-full max-w-3xl overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-borderSubtle pb-3">
          <div>
            <h2 id="detail-modal-title" className="font-display text-xl font-bold uppercase tracking-wider text-cyber-cyan">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs font-mono text-textMuted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="border border-borderSubtle px-2 py-1 text-[10px] font-display font-bold uppercase tracking-wider text-textSecondary hover:border-cyber-cyan hover:text-cyber-cyan"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DetailField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-borderSubtle/80 bg-surface/40 px-3 py-2">
      <p className="text-[10px] font-display font-bold uppercase tracking-[0.15em] text-cyber-cyan/70">{label}</p>
      <p className="mt-1 text-sm text-textPrimary">{value}</p>
    </div>
  );
}
