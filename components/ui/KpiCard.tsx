import { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  icon?: ReactNode;
  variant?: "cyan" | "magenta" | "yellow" | "green";
}

export function KpiCard({ label, value, delta, icon, variant = "cyan" }: KpiCardProps) {
  const variantStyles = {
    cyan: {
      gradient: "from-cyber-cyan/10 via-transparent to-cyber-cyan/5",
      border: "border-cyber-cyan/30",
      glow: "shadow-[inset_0_0_20px_rgba(0,240,255,0.05)]",
      iconBg: "border-cyber-cyan/40 text-cyber-cyan",
      accent: "text-cyber-cyan",
    },
    magenta: {
      gradient: "from-cyber-magenta/10 via-transparent to-cyber-magenta/5",
      border: "border-cyber-magenta/30",
      glow: "shadow-[inset_0_0_20px_rgba(255,0,255,0.05)]",
      iconBg: "border-cyber-magenta/40 text-cyber-magenta",
      accent: "text-cyber-magenta",
    },
    yellow: {
      gradient: "from-cyber-yellow/10 via-transparent to-cyber-yellow/5",
      border: "border-cyber-yellow/30",
      glow: "shadow-[inset_0_0_20px_rgba(255,230,0,0.05)]",
      iconBg: "border-cyber-yellow/40 text-cyber-yellow",
      accent: "text-cyber-yellow",
    },
    green: {
      gradient: "from-cyber-green/10 via-transparent to-cyber-green/5",
      border: "border-cyber-green/30",
      glow: "shadow-[inset_0_0_20px_rgba(0,255,102,0.05)]",
      iconBg: "border-cyber-green/40 text-cyber-green",
      accent: "text-cyber-green",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={`cyber-card-tw relative overflow-hidden ${styles.border} ${styles.glow} hover:shadow-cyberSm transition-all duration-300`}>
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${styles.gradient} pointer-events-none`} />
      
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${styles.accent.replace('text-', 'via-')} to-transparent opacity-60`} />
      
      <div className="relative flex items-center justify-between gap-4 px-4 py-3 md:px-5 md:py-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-textMuted">
            // {label}
          </span>
          <span className={`text-2xl md:text-3xl font-bold font-display ${styles.accent}`} style={{ textShadow: '0 0 10px currentColor' }}>
            {value}
          </span>
          {delta && (
            <span className="flex items-center gap-1 text-[11px] text-cyber-green">
              <span className="h-1.5 w-1.5 rounded-full bg-cyber-green shadow-[0_0_4px_rgba(0,255,102,0.8)]" />
              {delta}
            </span>
          )}
        </div>
        {icon && (
          <div className={`h-11 w-11 md:h-12 md:w-12 bg-bgMedium border ${styles.iconBg} grid place-items-center`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
