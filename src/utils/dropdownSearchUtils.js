/**
 * Shared utilities for adding search functionality to CKEditor dropdowns
 */

/**
 * Add search input to a dropdown panel
 * @param {HTMLElement} panelElement - The dropdown panel element
 * @param {Object} config - Configuration object
 * @param {string} config.inputClass - CSS class for the search input
 * @param {string} config.wrapperClass - CSS class for the wrapper div
 * @param {string} config.panelClass - CSS class to add to the panel
 * @param {string} config.placeholder - Placeholder text for the input
 * @param {string} config.maxHeight - Max height of the panel
 * @param {string} config.searchBarHeight - Height of the search bar
 * @param {boolean} [config.autoFocus=true] - Whether to auto-focus the search input
 * @param {Function} onInput - Callback function when input changes
 */
export function addSearchToPanel(panelElement, config, onInput) {
  if (!panelElement || panelElement.querySelector(`.${config.inputClass}`)) {
    return;
  }

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = config.inputClass;
  searchInput.placeholder = config.placeholder;
  searchInput.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    margin: 0;
    border: none;
    border-bottom: 1px solid #e0e0e0;
    border-radius: 0;
    font-size: 14px;
    box-sizing: border-box;
    position: relative;
    z-index: 1000;
    background: white !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    outline: none;
  `;

  searchInput.addEventListener('input', (e) => {
    onInput(e.target.value);
  });

  searchInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
    }
  });

  const searchWrapper = document.createElement('div');
  searchWrapper.className = config.wrapperClass;
  searchWrapper.style.cssText = `
    padding: 0;
    margin: 0;
    border: none;
    background: white !important;
    flex-shrink: 0;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    position: relative;
    z-index: 1000;
  `;

  searchWrapper.appendChild(searchInput);

  const listView = panelElement.querySelector('.ck-list');
  if (listView && listView.parentNode === panelElement) {
    // listView is a direct child of panelElement, safe to use insertBefore
    panelElement.insertBefore(searchWrapper, listView);
    panelElement.classList.add(config.panelClass);
    listView.style.maxHeight = `calc(${config.maxHeight} - ${config.searchBarHeight})`;
    listView.style.overflowY = 'auto';
    listView.style.overflowX = 'hidden';
    listView.style.flex = '1';
  } else if (listView) {
    // listView exists but is nested - insert at beginning and style the list
    panelElement.insertBefore(searchWrapper, panelElement.firstChild);
    panelElement.classList.add(config.panelClass);
    listView.style.maxHeight = `calc(${config.maxHeight} - ${config.searchBarHeight})`;
    listView.style.overflowY = 'auto';
    listView.style.overflowX = 'hidden';
    listView.style.flex = '1';
  } else {
    panelElement.insertBefore(searchWrapper, panelElement.firstChild);
  }

  // Auto-focus if enabled (default true)
  if (config.autoFocus !== false) {
    setTimeout(() => {
      try {
        searchInput.focus();
      } catch (e) {
        // Silently fail
      }
    }, 100);
  }
}

/**
 * Filter list items based on search term
 * @param {HTMLElement} panelElement - The dropdown panel element
 * @param {string} searchTerm - The search term to filter by
 * @param {Function} [customFilter] - Optional custom filter function (item, text, term) => boolean
 */
export function filterListItems(panelElement, searchTerm, customFilter = null) {
  if (!panelElement) return;

  const listView = panelElement.querySelector('.ck-list');
  if (!listView) return;

  const items = listView.querySelectorAll('.ck-list__item');
  const term = searchTerm.toLowerCase().trim();

  items.forEach((item) => {
    const text = item.textContent?.toLowerCase() || '';
    const shouldShow = customFilter
      ? customFilter(item, text, term)
      : (!term || text.includes(term));
    item.style.display = shouldShow ? '' : 'none';
  });
}

/**
 * Clear search input and reset filter
 * @param {HTMLElement} panelElement - The dropdown panel element
 * @param {string} inputClass - CSS class of the search input
 */
export function clearSearch(panelElement, inputClass) {
  if (!panelElement) return;
  const searchInput = panelElement.querySelector(`.${inputClass}`);
  if (searchInput) {
    searchInput.value = '';
    filterListItems(panelElement, '');
  }
}

/**
 * Mark a panel with identifiers to prevent duplicate search additions
 * @param {HTMLElement} panelElement - The dropdown panel element
 * @param {string} attribute - Data attribute name
 * @param {string} className - CSS class name
 */
export function markPanel(panelElement, attribute, className) {
  if (!panelElement) return;
  panelElement.setAttribute(attribute, 'true');
  panelElement.classList.add(className);
}
