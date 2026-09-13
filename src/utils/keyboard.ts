import { Capacitor } from '@capacitor/core';
import { Keyboard as CapKeyboard } from '@capacitor/keyboard';

/**
 * Returns whether the user has enabled auto-opening the soft keyboard on mobile.
 * Defaults to false (off by default).
 */
export function isAutoOpenKeyboardEnabled(): boolean {
  try {
    const pref = localStorage.getItem('auto_open_keyboard');
    return pref === 'true';
  } catch {
    return false;
  }
}

/**
 * Programmatically focuses an element and prompts the soft keyboard on mobile devices.
 * Implements gesture simulation, selection management, and animation-aware retries
 * so Android and mobile webviews reliably summon the virtual keyboard.
 */
export function showSoftKeyboard(
  target?: HTMLElement | null,
  options?: { placeCursorAtEnd?: boolean; scroll?: boolean; force?: boolean }
) {
  const isEnabled = isAutoOpenKeyboardEnabled();
  if (!isEnabled && !options?.force) {
    return;
  }

  if (!target) return;

  const focusAndPrompt = () => {
    if (!target || !document.body.contains(target)) return;

    try {
      target.focus({ preventScroll: !options?.scroll });
    } catch {
      try {
        target.focus();
      } catch {
        // ignore
      }
    }

    // Simulate input click for Chromium/Android WebView user gesture recognition
    try {
      target.click();
    } catch {
      // ignore
    }

    if (
      options?.placeCursorAtEnd !== false &&
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    ) {
      const nonSelectableTypes = [
        'number',
        'date',
        'time',
        'datetime-local',
        'month',
        'week',
        'file',
        'color',
        'range',
        'checkbox',
        'radio',
        'button',
        'submit',
      ];
      const inputType = (target as HTMLInputElement).type?.toLowerCase();
      if (!nonSelectableTypes.includes(inputType)) {
        try {
          const len = (target.value || '').length;
          target.setSelectionRange(len, len);
        } catch {
          // ignore
        }
      }
    }

    if (options?.scroll !== false) {
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      } catch {
        // ignore
      }
    }

    // If on native platform or plugin available, summon soft keyboard
    if (Capacitor.isNativePlatform() || Capacitor.isPluginAvailable('Keyboard')) {
      try {
        CapKeyboard.show().catch(() => {});
      } catch {
        // ignore
      }
    }
  };

  // Immediate attempt
  focusAndPrompt();

  // Retry after modal enter transitions (Android WebView requires target to be fully positioned in window)
  const t1 = setTimeout(focusAndPrompt, 120);
  const t2 = setTimeout(focusAndPrompt, 280);

  return () => {
    clearTimeout(t1);
    clearTimeout(t2);
  };
}

/**
 * Dismisses the soft keyboard on mobile devices.
 */
export function hideSoftKeyboard() {
  if (Capacitor.isNativePlatform() || Capacitor.isPluginAvailable('Keyboard')) {
    try {
      CapKeyboard.hide().catch(() => {});
    } catch {
      // ignore
    }
  }
}
