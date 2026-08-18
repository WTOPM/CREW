const VISIBLE_CLASS = 'dg-hint-tooltip--visible';
const VIEWPORT_PAD = 10;

function positionFixedTooltip(tip: HTMLElement, host: HTMLElement): void {
  const rect = host.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  const gap = 10;

  let top = rect.top - tipRect.height - gap;
  if (top < VIEWPORT_PAD) {
    top = rect.bottom + gap;
  }

  if (top + tipRect.height > window.innerHeight - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, window.innerHeight - tipRect.height - VIEWPORT_PAD);
  }

  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - tipRect.width - VIEWPORT_PAD));

  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
}

export function showPlainTooltip(host: HTMLElement, text: string): { hide: () => void } {
  const tip = document.createElement('div');
  tip.className = 'dg-hint-tooltip dg-hint-tooltip--plain';
  tip.setAttribute('role', 'tooltip');

  const textEl = document.createElement('span');
  textEl.className = 'dg-hint-tooltip__text';
  textEl.textContent = text;
  tip.append(textEl);
  document.body.appendChild(tip);

  positionFixedTooltip(tip, host);
  requestAnimationFrame(() => tip.classList.add(VISIBLE_CLASS));

  const onScroll = (): void => {
    hide();
  };
  window.addEventListener('scroll', onScroll, true);

  function hide(): void {
    window.removeEventListener('scroll', onScroll, true);
    tip.remove();
  }

  return { hide };
}

export function showHintTooltip(
  host: HTMLElement,
  code: string,
  summary: string,
  sizeLead?: string,
  options?: { wide?: boolean },
): { hide: () => void } {
  const tip = document.createElement('div');
  tip.className = options?.wide ? 'dg-hint-tooltip dg-hint-tooltip--wide' : 'dg-hint-tooltip';
  tip.setAttribute('role', 'tooltip');

  const codeEl = document.createElement('span');
  codeEl.className = 'dg-hint-tooltip__code';
  codeEl.textContent = code;

  tip.append(codeEl);

  const lead = sizeLead?.trim();
  if (lead) {
    const leadEl = document.createElement('span');
    leadEl.className = 'dg-hint-tooltip__lead';
    leadEl.textContent = lead;
    tip.append(leadEl);
  }

  const textEl = document.createElement('span');
  textEl.className = 'dg-hint-tooltip__text';
  textEl.textContent = summary;

  tip.append(textEl);
  document.body.appendChild(tip);

  positionFixedTooltip(tip, host);

  requestAnimationFrame(() => tip.classList.add(VISIBLE_CLASS));

  const onScroll = (): void => {
    hide();
  };
  window.addEventListener('scroll', onScroll, true);

  function hide(): void {
    window.removeEventListener('scroll', onScroll, true);
    tip.remove();
  }

  return { hide };
}
