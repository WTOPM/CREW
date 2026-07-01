import { AfterViewInit, Directive, ElementRef, OnDestroy, Renderer2, inject } from '@angular/core';
import {
  sanitizeSpeedKnotsInput,
  speedKnotsToTenths,
  stepSpeedKnots,
  tenthsToSpeedKnots,
} from '../utils/eta-speed-input.util';

/** ETA leg speed (kn): select-all on focus, Enter to blur, ±0.1 via spin buttons or ↑↓ keys. */
@Directive({
  selector: 'input.eta-input--speed-kn',
})
export class EtaSpeedKnInputDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLInputElement>);
  private readonly renderer = inject(Renderer2);

  private readonly teardown: (() => void)[] = [];
  private repeatDelayTimer: ReturnType<typeof setTimeout> | null = null;
  private repeatInterval: ReturnType<typeof setInterval> | null = null;

  private static readonly REPEAT_DELAY_MS = 700;
  private static readonly REPEAT_INTERVAL_MS = 150;

  ngAfterViewInit(): void {
    const input = this.el.nativeElement;
    if (input.dataset['etaSpeedKnEnhanced'] === '1') return;
    input.dataset['etaSpeedKnEnhanced'] = '1';

    const parent = input.parentNode;
    if (!parent) return;

    const wrapper = this.renderer.createElement('div');
    this.renderer.addClass(wrapper, 'num-input');

    this.renderer.insertBefore(parent, wrapper, input);
    this.renderer.removeChild(parent, input);
    this.renderer.appendChild(wrapper, input);
    this.renderer.addClass(input, 'num-input__field');

    const spin = this.renderer.createElement('div');
    this.renderer.addClass(spin, 'num-input__spin');

    const upBtn = this.renderer.createElement('button');
    this.renderer.setAttribute(upBtn, 'type', 'button');
    this.renderer.setAttribute(upBtn, 'tabindex', '-1');
    this.renderer.setAttribute(upBtn, 'title', 'Increase by 0.1 kn');
    this.renderer.addClass(upBtn, 'num-input__spin-btn');
    this.renderer.addClass(upBtn, 'num-input__spin-btn--up');
    this.renderer.setProperty(upBtn, 'textContent', '▲');

    const downBtn = this.renderer.createElement('button');
    this.renderer.setAttribute(downBtn, 'type', 'button');
    this.renderer.setAttribute(downBtn, 'tabindex', '-1');
    this.renderer.setAttribute(downBtn, 'title', 'Decrease by 0.1 kn');
    this.renderer.addClass(downBtn, 'num-input__spin-btn');
    this.renderer.addClass(downBtn, 'num-input__spin-btn--down');
    this.renderer.setProperty(downBtn, 'textContent', '▼');

    this.renderer.appendChild(spin, upBtn);
    this.renderer.appendChild(spin, downBtn);
    this.renderer.appendChild(wrapper, spin);

    this.teardown.push(
      this.renderer.listen(input, 'focus', () => this.selectAll(input)),
      this.renderer.listen(input, 'click', () => this.selectAll(input)),
      this.renderer.listen(input, 'mouseup', (e: Event) => {
        if (document.activeElement === input) e.preventDefault();
      }),
      this.renderer.listen(input, 'keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.step(input, 1);
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.step(input, -1);
        }
      }),
    );

    this.bindSpinButton(upBtn, input, 1);
    this.bindSpinButton(downBtn, input, -1);
  }

  ngOnDestroy(): void {
    this.stopRepeat();
    this.teardown.forEach((off) => off());
  }

  private bindSpinButton(
    btn: HTMLButtonElement,
    input: HTMLInputElement,
    direction: 1 | -1,
  ): void {
    this.teardown.push(
      this.renderer.listen(btn, 'pointerdown', (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        try {
          btn.setPointerCapture(e.pointerId);
        } catch {
          /* ignore — repeat still works for this click */
        }
        this.startRepeat(input, direction);
      }),
      this.renderer.listen(btn, 'pointerup', (e: PointerEvent) => {
        this.stopRepeat();
        try {
          if (btn.hasPointerCapture(e.pointerId)) {
            btn.releasePointerCapture(e.pointerId);
          }
        } catch {
          /* ignore */
        }
      }),
      this.renderer.listen(btn, 'pointercancel', () => this.stopRepeat()),
    );
  }

  private startRepeat(input: HTMLInputElement, direction: 1 | -1): void {
    this.stopRepeat();
    this.step(input, direction, false);
    this.repeatDelayTimer = setTimeout(() => {
      this.repeatInterval = setInterval(
        () => this.step(input, direction, false),
        EtaSpeedKnInputDirective.REPEAT_INTERVAL_MS,
      );
    }, EtaSpeedKnInputDirective.REPEAT_DELAY_MS);
  }

  private stopRepeat(): void {
    if (this.repeatDelayTimer !== null) {
      clearTimeout(this.repeatDelayTimer);
      this.repeatDelayTimer = null;
    }
    if (this.repeatInterval !== null) {
      clearInterval(this.repeatInterval);
      this.repeatInterval = null;
    }
  }

  private selectAll(input: HTMLInputElement): void {
    requestAnimationFrame(() => input.select());
  }

  private step(input: HTMLInputElement, direction: 1 | -1, refocus = true): void {
    const { value } = sanitizeSpeedKnotsInput(input.value);
    const current = value != null ? tenthsToSpeedKnots(speedKnotsToTenths(value)) : 0;
    const stepped = stepSpeedKnots(current, direction);
    input.value = stepped.text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (refocus) {
      input.focus();
      this.selectAll(input);
    }
  }
}
