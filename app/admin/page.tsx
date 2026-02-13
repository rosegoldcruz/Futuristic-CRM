
export default function Page() {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <h1 className="text-xl md:text-2xl font-semibold text-textPrimary">Admin</h1>
      <p className="text-sm text-textSecondary max-w-2xl">
        Control regions, roles, pricing tiers, and global settings for the Vulpine OS.
      </p>
      <div className="glass-panel border-dashed border-2 border-borderSubtle/80 py-10 flex items-center justify-center text-textSecondary text-sm">
        <span>Module shell ready. Wire real data, tables, and flows into this view.</span>
      </div>
    </div>
  );
}
