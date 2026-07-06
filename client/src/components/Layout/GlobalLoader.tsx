import './GlobalLoader.css';

interface GlobalLoaderProps {
  subtitle?: string;
}

export default function GlobalLoader({ subtitle = 'Loading Application...' }: GlobalLoaderProps) {
  return (
    <div className="global-loader-overlay">
      <div className="global-loader-content">
        {/* Logo Container */}
        <div className="global-loader-logo-container">
          <div className="global-loader-logo-glow" />
          <div className="global-loader-logo">
            S
          </div>
        </div>
        
        {/* Text */}
        <div className="global-loader-text-container">
          <h1 className="global-loader-title">StreamSync</h1>
          <p className="global-loader-subtitle">{subtitle}</p>
        </div>
        
        {/* Progress Bar (Indeterminate) */}
        <div className="global-loader-progress-track">
          <div className="global-loader-progress-bar" />
        </div>
      </div>
    </div>
  );
}
