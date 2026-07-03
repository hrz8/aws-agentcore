import { useEffect } from 'react';

// Up, Up, Down, Down, Left, Right, Left, Right, Q, W
export const KONAMI_QW_SEQUENCE = '38384040373937398187';

export function useKonami(sequence: string, onTrigger: () => void): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let buffer = '';
    function onKey(e: KeyboardEvent) {
      buffer += String(e.keyCode);
      if (buffer.length > sequence.length) {
        buffer = buffer.slice(buffer.length - sequence.length);
      }
      if (buffer === sequence) {
        buffer = '';
        onTrigger();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sequence, onTrigger]);
}
