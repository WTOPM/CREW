import { Injectable, inject, DestroyRef, DOCUMENT } from '@angular/core';
import {
  TEXT_CASE_HOTKEY_HINT,
  nextTextCase,
} from '../utils/text-case.util';

const SKIP_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'date',
  'datetime-local',
  'file',
  'hidden',
  'image',
  'month',
  'number',
  'password',
  'radio',
  'range',
  'reset',
  'submit',
  'time',
  'week',
]);

/**
 * App-wide Shift+F3 case cycle for focused text fields + hover hint on those fields.
 */
@Injectable({ providedIn: 'root' })
export class TextCaseHotkeyService {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private installed = false;

  install(): void {
    if (this.installed || typeof this.doc === 'undefined') return;
    this.installed = true;

    const onKey = (e: KeyboardEvent) => this.onKeyDown(e);
    const onFocus = (e: FocusEvent) => this.onFocusIn(e);
    this.doc.addEventListener('keydown', onKey, true);
    this.doc.addEventListener('focusin', onFocus, true);
    this.destroyRef.onDestroy(() => {
      this.doc.removeEventListener('keydown', onKey, true);
      this.doc.removeEventListener('focusin', onFocus, true);
    });
  }

  private onFocusIn(event: FocusEvent): void {
    const el = this.asTextField(event.target);
    if (!el || el.dataset['caseHint'] === '1') return;
    el.dataset['caseHint'] = '1';
    const prev = (el.getAttribute('title') || el.dataset['appTip'] || '').trim();
    const next = prev
      ? prev.includes('Shift+F3')
        ? prev
        : `${prev} · ${TEXT_CASE_HOTKEY_HINT}`
      : TEXT_CASE_HOTKEY_HINT;
    el.setAttribute('title', next);
    if (el.dataset['appTip'] != null) {
      el.dataset['appTip'] = next;
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key !== 'F3' && event.code !== 'F3') return;

    const el = this.asTextField(event.target) ?? this.asTextField(this.doc.activeElement);
    if (!el || el.readOnly || el.disabled) return;

    event.preventDefault();
    event.stopPropagation();
    this.applyCaseCycle(el);
  }

  private applyCaseCycle(el: HTMLInputElement | HTMLTextAreaElement): void {
    const value = el.value;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const hasSelection = start !== end;

    let nextValue: string;
    let selStart: number;
    let selEnd: number;

    if (hasSelection) {
      const selected = value.slice(start, end);
      const transformed = nextTextCase(selected);
      nextValue = value.slice(0, start) + transformed + value.slice(end);
      selStart = start;
      selEnd = start + transformed.length;
    } else {
      nextValue = nextTextCase(value);
      selStart = 0;
      selEnd = nextValue.length;
    }

    if (nextValue === value) return;

    const proto = Object.getPrototypeOf(el) as { value?: PropertyDescriptor };
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc?.set) desc.set.call(el, nextValue);
    else el.value = nextValue;

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    try {
      el.setSelectionRange(selStart, selEnd);
    } catch {
      /* some input types reject selection */
    }
  }

  private asTextField(target: EventTarget | null): HTMLInputElement | HTMLTextAreaElement | null {
    if (!target || !(target instanceof HTMLElement)) return null;
    if (target instanceof HTMLTextAreaElement) return target;
    if (target instanceof HTMLInputElement) {
      const type = (target.type || 'text').toLowerCase();
      if (SKIP_INPUT_TYPES.has(type)) return null;
      return target;
    }
    return null;
  }
}
