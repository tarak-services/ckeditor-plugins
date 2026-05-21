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
  const margins = {
    marginTop: viewElement.getAttribute('data-margin-top') || '',
    marginBottom: viewElement.getAttribute('data-margin-bottom') || ''
  };

  const latexView = findMathLatexViewElement(viewElement);
  if (!margins.marginTop) {
    margins.marginTop = latexView?.getStyle('margin-top') || '';
  }
  if (!margins.marginBottom) {
    margins.marginBottom = latexView?.getStyle('margin-bottom') || '';
  }

  // Legacy content may have margins on the outer math wrapper.
  if (!margins.marginTop) {
    margins.marginTop = viewElement.getStyle('margin-top') || '';
  }
  if (!margins.marginBottom) {
    margins.marginBottom = viewElement.getStyle('margin-bottom') || '';
  }

  return margins;
}

export function extractMathMarginsFromElement(element) {
  if (!element) {
    return { marginTop: '', marginBottom: '' };
  }

  const margins = {
    marginTop: element.getAttribute('data-margin-top') || '',
    marginBottom: element.getAttribute('data-margin-bottom') || ''
  };

  const latexEl = findMathLatexElement(element);
  if (!margins.marginTop) {
    margins.marginTop = latexEl?.style.marginTop || element.style.marginTop || '';
  }
  if (!margins.marginBottom) {
    margins.marginBottom = latexEl?.style.marginBottom || element.style.marginBottom || '';
  }

  return margins;
}

export function syncMathMarginDataAttributes(element, { marginTop = '', marginBottom = '' } = {}) {
  if (!element) {
    return;
  }

  if (marginTop) {
    element.setAttribute('data-margin-top', marginTop);
  } else {
    element.removeAttribute('data-margin-top');
  }

  if (marginBottom) {
    element.setAttribute('data-margin-bottom', marginBottom);
  } else {
    element.removeAttribute('data-margin-bottom');
  }
}
