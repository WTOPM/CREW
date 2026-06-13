const VISIBLE_CLASS = 'dg-hint-tooltip--visible';

export function showHintTooltip(
  host: HTMLElement,
  code: string,
  summary: string,
): { hide: () => void } {
  const tip = document.createElement('div');
  tip.className = 'dg-hint-tooltip';
  tip.setAttribute('role', 'tooltip');

  const codeEl = document.createElement('span');
  codeEl.className = 'dg-hint-tooltip__code';
  codeEl.textContent = code;

  const textEl = document.createElement('span');
  textEl.className = 'dg-hint-tooltip__text';
  textEl.textContent = summary;

  tip.append(codeEl, textEl);
  document.body.appendChild(tip);

  const rect = host.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  let top = rect.top - tipRect.height - 8;
  if (top < 8) top = rect.bottom + 8;

  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));

  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;

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
