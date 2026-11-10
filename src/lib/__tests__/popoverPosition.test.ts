import { describe, it, expect } from 'vitest';
import { computeViewportBiasedPosition } from '../usePopoverPosition';

describe('computeViewportBiasedPosition', () => {
  const mockButton = (rect: { left: number; right: number; top: number; bottom: number; width: number; height: number }) => {
    return {
      getBoundingClientRect: () => rect,
    } as unknown as HTMLElement;
  };

  it('biases to the left when button is in left half of viewport', () => {
    // Button center at 100 + 40/2 = 120 (< 500, left half)
    const btn = mockButton({
      left: 100,
      right: 140,
      top: 50,
      bottom: 80,
      width: 40,
      height: 30,
    });

    const style = computeViewportBiasedPosition(btn, {
      popoverWidth: 320,
      viewportPadding: 12,
      offsetY: 8,
      viewportWidth: 1000,
    });

    expect(style.top).toBe(88); // 80 + 8
    expect(style.left).toBe(100);
    expect(style.right).toBe('auto');
    expect(style.maxWidth).toBe('calc(100vw - 24px)');
  });

  it('biases to the right when button is in right half of viewport', () => {
    // Button center at 800 + 40/2 = 820 (> 500, right half)
    const btn = mockButton({
      left: 800,
      right: 840,
      top: 50,
      bottom: 80,
      width: 40,
      height: 30,
    });

    const style = computeViewportBiasedPosition(btn, {
      popoverWidth: 320,
      viewportPadding: 12,
      offsetY: 8,
      viewportWidth: 1000,
    });

    expect(style.top).toBe(88);
    // buttonRightOffset = 1000 - 840 = 160
    expect(style.right).toBe(160);
    expect(style.left).toBe('auto');
  });

  it('clamps left-biased popover to right margin if button would push it off-screen in portrait', () => {
    // Button at left 180 (center 195 < 200, so left-biased)
    // But popover width is 320. In 400px screen with 12px padding, max left = 400 - 320 - 12 = 68px.
    const btn = mockButton({
      left: 180,
      right: 210,
      top: 50,
      bottom: 80,
      width: 30,
      height: 30,
    });

    const style = computeViewportBiasedPosition(btn, {
      popoverWidth: 320,
      viewportPadding: 12,
      viewportWidth: 400,
    });

    expect(style.left).toBe(68);
    expect(style.maxWidth).toBe('calc(100vw - 24px)');
  });

  it('clamps right-biased popover to left margin if button would push it off-screen in portrait', () => {
    // Button at right 220 (center 205 > 200, so right-biased)
    // buttonRightOffset = 400 - 220 = 180px.
    // Max right allowed for 320px popover in 400px screen = 400 - 320 - 12 = 68px.
    const btn = mockButton({
      left: 190,
      right: 220,
      top: 50,
      bottom: 80,
      width: 30,
      height: 30,
    });

    const style = computeViewportBiasedPosition(btn, {
      popoverWidth: 320,
      viewportPadding: 12,
      viewportWidth: 400,
    });

    expect(style.right).toBe(68);
    expect(style.maxWidth).toBe('calc(100vw - 24px)');
  });

  it('centers below button when align is center and sufficient room exists', () => {
    // Button center at 500 in 1000px screen. Popover width 200.
    // Centered: left = 500 - 100 = 400.
    const btn = mockButton({
      left: 480,
      right: 520,
      top: 50,
      bottom: 80,
      width: 40,
      height: 30,
    });

    const style = computeViewportBiasedPosition(btn, {
      popoverWidth: 200,
      viewportPadding: 12,
      viewportWidth: 1000,
      align: 'center',
    });

    expect(style.left).toBe(400);
    expect(style.right).toBe('auto');
  });

  it('left-justifies when align is center but not enough room and button in left half', () => {
    // Button near left margin in small screen
    const btn = mockButton({
      left: 20,
      right: 60,
      top: 50,
      bottom: 80,
      width: 40,
      height: 30,
    });

    const style = computeViewportBiasedPosition(btn, {
      popoverWidth: 200,
      viewportPadding: 12,
      viewportWidth: 300,
      align: 'center',
    });

    expect(style.left).toBe(12);
    expect(style.right).toBe('auto');
  });

  it('right-justifies when align is center but not enough room and button in right half', () => {
    // Button near right margin in small screen
    const btn = mockButton({
      left: 250,
      right: 290,
      top: 50,
      bottom: 80,
      width: 40,
      height: 30,
    });

    const style = computeViewportBiasedPosition(btn, {
      popoverWidth: 200,
      viewportPadding: 12,
      viewportWidth: 300,
      align: 'center',
    });

    expect(style.right).toBe(12);
    expect(style.left).toBe('auto');
  });

  it('falls back safely if buttonEl is null', () => {
    const style = computeViewportBiasedPosition(null, { viewportPadding: 12 });
    expect(style.top).toBe(60);
    expect(style.right).toBe(12);
  });
});
