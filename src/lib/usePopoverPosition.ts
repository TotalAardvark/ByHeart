import React, { useState, useLayoutEffect, useEffect, useCallback } from 'react';

export interface PopoverPositionOptions {
  popoverWidth?: number;
  viewportPadding?: number;
  offsetY?: number;
  viewportWidth?: number;
  align?: 'edge-bias' | 'center';
}

/**
 * Computes a viewport-safe fixed position for a dropdown/popover:
 * - Anchored below the trigger button.
 * - When align is 'center', centers below the button when horizontal room exists,
 *   otherwise left/right justifies to the viewport edge based on which screen half the button is on.
 * - When align is 'edge-bias' (default), aligns with the button's outer edge biased to its screen half.
 * - Ensures the popup NEVER overflows off-screen in portrait mode or narrow viewports.
 */
export function computeViewportBiasedPosition(
  buttonEl: HTMLElement | null,
  options: PopoverPositionOptions = {}
): React.CSSProperties {
  const {
    popoverWidth = 320,
    viewportPadding = 12,
    offsetY = 8,
    align = 'edge-bias',
  } = options;

  if (!buttonEl) {
    return {
      top: 60,
      right: viewportPadding,
      maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
    };
  }

  const rect = buttonEl.getBoundingClientRect();
  const screenWidth =
    options.viewportWidth ??
    (typeof window !== 'undefined' ? window.innerWidth : 1024);
  const buttonCenter = rect.left + rect.width / 2;
  const isLeftBiased = buttonCenter < screenWidth / 2;
  const top = rect.bottom + offsetY;

  // Space is scarce if the screen cannot comfortably fit the popup without touching margins
  const maxAvailableWidth = screenWidth - viewportPadding * 2;
  const effectiveWidth = Math.min(popoverWidth, maxAvailableWidth);

  if (align === 'center') {
    const idealLeft = buttonCenter - effectiveWidth / 2;
    const canCenterWithoutClipping =
      idealLeft >= viewportPadding &&
      idealLeft + effectiveWidth <= screenWidth - viewportPadding;

    if (canCenterWithoutClipping) {
      return {
        top,
        left: idealLeft,
        right: 'auto',
        maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
      };
    }

    // Not enough horizontal room to center: left-justify or right-justify based on button side
    if (isLeftBiased) {
      return {
        top,
        left: viewportPadding,
        right: 'auto',
        maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
      };
    } else {
      return {
        top,
        right: viewportPadding,
        left: 'auto',
        maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
      };
    }
  }

  if (isLeftBiased) {
    // Biased to the left side of the screen:
    // Align with the button's left edge, but clamp between viewportPadding and screenWidth - effectiveWidth - viewportPadding
    const maxLeft = screenWidth - effectiveWidth - viewportPadding;
    const clampedLeft = Math.max(viewportPadding, Math.min(rect.left, maxLeft));

    return {
      top,
      left: clampedLeft,
      right: 'auto',
      maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
    };
  } else {
    // Biased to the right side of the screen:
    // Align with the button's right edge, but clamp between viewportPadding and screenWidth - effectiveWidth - viewportPadding
    const maxRight = screenWidth - effectiveWidth - viewportPadding;
    const buttonRightOffset = screenWidth - rect.right;
    const clampedRight = Math.max(viewportPadding, Math.min(buttonRightOffset, maxRight));

    return {
      top,
      right: clampedRight,
      left: 'auto',
      maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
    };
  }
}

/**
 * Hook that dynamically tracks button coordinates and positions a fixed popup
 * with automatic viewport clamping and edge biasing.
 */
export function usePopoverPosition(
  isOpen: boolean,
  buttonRef: React.RefObject<HTMLElement | null>,
  options: PopoverPositionOptions = {}
): React.CSSProperties {
  const [style, setStyle] = useState<React.CSSProperties>({});

  const update = useCallback(() => {
    if (buttonRef.current) {
      setStyle(computeViewportBiasedPosition(buttonRef.current, options));
    }
  }, [buttonRef, options.popoverWidth, options.viewportPadding, options.offsetY, options.align]);

  useLayoutEffect(() => {
    if (isOpen) {
      update();
    }
  }, [isOpen, update]);

  useEffect(() => {
    if (!isOpen) return;
    const handleReposition = () => update();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, update]);

  return style;
}
