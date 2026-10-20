import { useEffect } from 'react';
import { desktopBridge, forwardTitleBarColors, rgbToHex } from '@/lib/desktopBridge';

// I token sono in oklch; setTitleBarOverlay accetta solo hex. Il canvas fa la conversione in sRGB.
function tokenToHex(name: string, context: CanvasRenderingContext2D): string | null {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value) return null;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return rgbToHex(r, g, b);
}

/** Title bar dell'app desktop: sostituisce quella nativa (nascosta dal main process) con la superficie canvas del tema. */
export default function DesktopTitleBar() {
  const bridge = desktopBridge();

  useEffect(() => {
    if (!bridge) return;
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!context) return;
    const syncColors = () => {
      const color = tokenToHex('--canvas', context);
      const symbolColor = tokenToHex('--foreground', context);
      if (color && symbolColor) forwardTitleBarColors({ color, symbolColor }, bridge);
    };
    syncColors();
    // next-themes cambia la classe su <html>: si osserva quella, non lo stato React, per leggere i token già applicati.
    const observer = new MutationObserver(syncColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [bridge]);

  if (!bridge) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex h-(--titlebar-height) select-none items-center justify-center bg-canvas [app-region:drag]">
      <span className="font-display text-xs font-semibold text-muted-foreground">Project Tracker</span>
    </div>
  );
}
