"use client";

/**
 * AnimatedBackground
 * Renders an animated living grid background for any module
 * Features:
 * - Flowing horizontal and vertical light sweeps
 * - Pulsing center glow
 * - Corner accent glows
 * - Base grid pattern with pulse effect
 * 
 * Import the matching CSS: '../animated-background.css'
 */
export function AnimatedBackground() {
  return (
    <div className="animated-bg" aria-hidden="true">
      {/* Base grid pattern */}
      <span className="animated-grid-overlay" />

      {/* Flowing light effects */}
      <span className="animated-grid-line-h" />
      <span className="animated-grid-line-v" />

      {/* Center glow pulse */}
      <span className="animated-grid-glow" />

      {/* Corner accent glows */}
      <span className="animated-grid-corner animated-grid-corner--tl" />
      <span className="animated-grid-corner animated-grid-corner--tr" />
      <span className="animated-grid-corner animated-grid-corner--bl" />
      <span className="animated-grid-corner animated-grid-corner--br" />
    </div>
  );
}
