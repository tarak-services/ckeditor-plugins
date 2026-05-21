/**
 * Helpers for applying vertical margins to rendered MathLive output.
 * Margins must live on `.ML__latex` (or `<math>`), not the outer widget span.
 */

export function findMathLatexElement(container) {
  if (!container) {
    return null;
  }

  return container.querySelector('.ML__latex, math');
}

export function applyMathLatexMarginStyles(container, { marginTop = '', marginBottom = '' } = {}) {
  const latexEl = findMathLatexElement(container);
  if (!latexEl) {
    return false;
  }

  if (marginTop) {
    latexEl.style.marginTop = marginTop;
  } else {
    latexEl.style.removeProperty('margin-top');
  }

  if (marginBottom) {
    latexEl.style.marginBottom = marginBottom;
  } else {
    latexEl.style.removeProperty('margin-bottom');
  }

  return true;
}

export function findMathLatexViewElement(viewElement) {
  if (!viewElement.is || !viewElement.is('element')) {
    return null;
  }

  if (viewElement.name === 'math') {
    return viewElement;
  }

  const className = viewElement.getAttribute('class') || '';
  if (className.split(/\s+/).includes('ML__latex')) {
    return viewElement;
  }

  for (const child of viewElement.getChildren()) {
    const found = findMathLatexViewElement(child);
    if (found) {
      return found;
    }
  }

  return null;
}

export function extractMathMarginsFromView(viewElement) {
  const latexView = findMathLatexViewElement(viewElement);
  const margins = {
    marginTop: latexView?.getStyle('margin-top') || '',
    marginBottom: latexView?.getStyle('margin-bottom') || ''
  };

  // Legacy content may have margins on the outer math wrapper.
  if (!margins.marginTop) {
    margins.marginTop = viewElement.getStyle('margin-top') || '';
  }
  if (!margins.marginBottom) {
    margins.marginBottom = viewElement.getStyle('margin-bottom') || '';
  }

  return margins;
}
