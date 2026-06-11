import {
  AfterViewInit,
  Directive,
  ElementRef,
  OnDestroy,
  Renderer2,
  inject,
} from '@angular/core';

/** Wraps native number inputs with custom stepper buttons (hover-highlighted up/down). */
@Directive({
  selector: 'input[type=number]:not(.num-input__field)',
})
export class NumberSpinDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLInputElement>);
  private readonly renderer = inject(Renderer2);

  private readonly teardown: (() => void)[] = [];

  ngAfterViewInit(): void {
    const input = this.el.nativeElement;
    if (input.dataset['numSpinEnhanced'] === '1') return;
    input.dataset['numSpinEnhanced'] = '1';

    const parent = input.parentNode;
    if (!parent) return;

    const wrapper = this.renderer.createElement('div');
    this.renderer.addClass(wrapper, 'num-input');
    if (input.classList.contains('pkg-copies') || input.classList.contains('doc-count-input')) {
      this.renderer.addClass(wrapper, 'num-input--sm');
    }

    this.renderer.insertBefore(parent, wrapper, input);
    this.renderer.removeChild(parent, input);
    this.renderer.appendChild(wrapper, input);
    this.renderer.addClass(input, 'num-input__field');

    const spin = this.renderer.createElement('div');
    this.renderer.addClass(spin, 'num-input__spin');

    const upBtn = this.renderer.createElement('button');
    this.renderer.setAttribute(upBtn, 'type', 'button');
    this.renderer.setAttribute(upBtn, 'tabindex', '-1');
    this.renderer.setAttribute(upBtn, 'title', 'Increase');
    this.renderer.addClass(upBtn, 'num-input__spin-btn');
    this.renderer.addClass(upBtn, 'num-input__spin-btn--up');
    this.renderer.setProperty(upBtn, 'textContent', '▲');

    const downBtn = this.renderer.createElement('button');
    this.renderer.setAttribute(downBtn, 'type', 'button');
    this.renderer.setAttribute(downBtn, 'tabindex', '-1');
    this.renderer.setAttribute(downBtn, 'title', 'Decrease');
    this.renderer.addClass(downBtn, 'num-input__spin-btn');
    this.renderer.addClass(downBtn, 'num-input__spin-btn--down');
    this.renderer.setProperty(downBtn, 'textContent', '▼');

    this.renderer.appendChild(spin, upBtn);
    this.renderer.appendChild(spin, downBtn);
    this.renderer.appendChild(wrapper, spin);

    this.teardown.push(
      this.renderer.listen(upBtn, 'click', (e: Event) => {
        e.preventDefault();
        this.step(input, 1);
      }),
      this.renderer.listen(downBtn, 'click', (e: Event) => {
        e.preventDefault();
        this.step(input, -1);
      }),
      this.renderer.listen(upBtn, 'mousedown', (e: Event) => e.preventDefault()),
      this.renderer.listen(downBtn, 'mousedown', (e: Event) => e.preventDefault()),
    );
  }

  ngOnDestroy(): void {
    this.teardown.forEach((off) => off());
  }

  private step(input: HTMLInputElement, direction: 1 | -1): void {
    const step = input.step !== '' ? parseFloat(input.step) : 1;
    const min = input.min !== '' ? parseFloat(input.min) : Number.NEGATIVE_INFINITY;
    const max = input.max !== '' ? parseFloat(input.max) : Number.POSITIVE_INFINITY;
    const current = input.value === '' ? 0 : parseFloat(input.value);
    if (Number.isNaN(current)) return;

    let next = current + direction * step;
    if (step >= 1) next = Math.round(next);
    next = Math.min(max, Math.max(min, next));

    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
