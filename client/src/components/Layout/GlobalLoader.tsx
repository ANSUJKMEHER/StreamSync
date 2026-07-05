export default function GlobalLoader() {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[9999]">
      <div className="flex flex-col items-center gap-6 animate-pulse">
        {/* Logo Container */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150 animate-pulse" />
          <div className="relative h-16 w-16 rounded-xl bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-4xl shadow-[0_4px_16px_rgba(208,188,255,0.4)]">
            S
          </div>
        </div>
        
        {/* Text */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-headline-md text-headline-md font-bold text-primary tracking-tight">StreamSync</h1>
          <p className="text-on-surface-variant font-label-md tracking-widest uppercase">Loading Application...</p>
        </div>
        
        {/* Progress Bar (Indeterminate) */}
        <div className="w-48 h-1 bg-surface-container-high rounded-full overflow-hidden mt-4 relative">
          <div className="absolute top-0 left-0 h-full bg-primary rounded-full w-1/3 animate-[slide_1.5s_ease-in-out_infinite]" />
        </div>
      </div>

      <style>{`
        @keyframes slide {
          0% { left: -33%; }
          50% { left: 100%; }
          100% { left: -33%; }
        }
      `}</style>
    </div>
  );
}
