import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number;
  disabled?: boolean;
}

export function useLongPress({
  onLongPress,
  onClick,
  delay = 450,
  disabled = false,
}: UseLongPressOptions) {
  const timerRef = useRef<any>(null);
  const isLongPressTriggered = useRef(false);
  const isMovedRef = useRef(false);
  const startCoords = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled) return;
      isLongPressTriggered.current = false;
      isMovedRef.current = false;
      startCoords.current = { x: clientX, y: clientY };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        isLongPressTriggered.current = true;
        if (navigator.vibrate) {
          try {
            navigator.vibrate(40);
          } catch {}
        }
        onLongPress();
      }, delay);
    },
    [onLongPress, delay, disabled]
  );

  const move = useCallback((clientX: number, clientY: number) => {
    if (!startCoords.current) return;
    const dx = Math.abs(clientX - startCoords.current.x);
    const dy = Math.abs(clientY - startCoords.current.y);
    if (dx > 8 || dy > 8) {
      isMovedRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  const end = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(
    (e?: React.MouseEvent) => {
      if (isLongPressTriggered.current) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        isLongPressTriggered.current = false;
        return;
      }
      if (isMovedRef.current) {
        isMovedRef.current = false;
        return;
      }
      onClick?.();
    },
    [onClick]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isLongPressTriggered.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return {
    handlers: {
      onTouchStart: (e: React.TouchEvent) => {
        const t = e.touches[0];
        start(t.clientX, t.clientY);
      },
      onTouchMove: (e: React.TouchEvent) => {
        const t = e.touches[0];
        move(t.clientX, t.clientY);
      },
      onTouchEnd: end,
      onTouchCancel: end,
      onMouseDown: (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        start(e.clientX, e.clientY);
      },
      onMouseMove: (e: React.MouseEvent) => {
        move(e.clientX, e.clientY);
      },
      onMouseUp: end,
      onMouseLeave: end,
      onContextMenu: handleContextMenu,
    },
    handleClick,
    isLongPressTriggered,
  };
}
