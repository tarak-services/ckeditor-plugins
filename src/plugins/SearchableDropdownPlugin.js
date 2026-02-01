import { addSearchToPanel, filterListItems, clearSearch as clearSearchUtil } from '../utils/dropdownSearchUtils.js';

/**
 * Factory function to create SearchableDropdownPlugin with CKEditor from CDN
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} SearchableDropdownPlugin class
 */
export default function createSearchableDropdownPlugin(CKEditor) {
  const { Plugin } = CKEditor;

  /**
   * Base class for plugins that add search functionality to dropdowns
   * Handles all common search/filter logic
   */
  class SearchableDropdownPlugin extends Plugin {
  constructor(editor, config = {}) {
    super(editor);

    // Configuration with defaults
    this.config = {
      // Unique identifier for this dropdown type
      dropdownType: config.dropdownType || 'searchable',

      // CSS class names
      searchInputClass: config.searchInputClass || 'ck-searchable-input',
      searchWrapperClass: config.searchWrapperClass || 'ck-searchable-wrapper',
      panelClass: config.panelClass || 'ck-searchable-panel',
      panelAttribute: config.panelAttribute || 'data-ck-searchable',

      // UI text
      placeholder: config.placeholder || 'Search...',

      // Behavior
      maxHeight: config.maxHeight || '250px',
      searchBarHeight: config.searchBarHeight || '42px',
      autoFocus: config.autoFocus !== false,

      // Detection functions
      isPanelOfType: config.isPanelOfType || (() => false),

      // Optional: function to find the dropdown view
      findDropdownView: config.findDropdownView || null,

      ...config
    };

    this._observer = null;
    this._dropdownView = null;
  }

  /**
   * Find panel that needs search input
   */
  _findPanel() {
    const panels = document.querySelectorAll('.ck-dropdown__panel');
    for (const panel of panels) {
      // Skip if already has search input or is wrong type
      if (panel.querySelector(`.${this.config.searchInputClass}`) ||
          panel.hasAttribute('data-ck-line-height-dropdown') ||
          panel.classList.contains('ck-line-height-dropdown')) {
        continue;
      }
      if (this.config.isPanelOfType(panel)) {
        return panel;
      }
    }
    return null;
  }

  /**
   * Try to add search input to dropdown
   */
  _tryAddSearch() {
    const panel = this._findPanel();
    if (panel) {
      this._addSearchInput({ element: panel });
      return true;
    }
    return false;
  }

  /**
   * Setup search functionality for dropdown
   */
  _setupSearch(editor) {
    if (this._dropdownView && this.config.findDropdownView) return; // Already set up

    let dropdownView = null;

    // Use custom finder if provided
    if (this.config.findDropdownView) {
      dropdownView = this.config.findDropdownView(editor);
    }

    if (!dropdownView) {
      setTimeout(() => this._setupSearch(editor), 100);
      return;
    }

    // Store the dropdown view reference
    this._dropdownView = dropdownView;

    // Handle dropdown open/close
    dropdownView.on('change:isOpen', (evt, data, isOpen) => {
      if (isOpen) {
        // Try to add search immediately and with delays
        const delays = [0, 50, 100, 200];
        delays.forEach(delay => {
          setTimeout(() => this._tryAddSearch(), delay);
        });

        // Use observer as fallback
        if (this._observer) {
          this._observer.disconnect();
        }

        this._observer = new MutationObserver(() => {
          if (this._tryAddSearch()) {
            this._observer.disconnect();
          }
        });

        this._observer.observe(document.body, {
          childList: true,
          subtree: true
        });

        setTimeout(() => {
          if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
          }
        }, 2000);
      } else {
        // Clear search when dropdown closes
        this._clearSearch();
      }
    });

    // Also try on button click
    if (dropdownView.buttonView?.element) {
      dropdownView.buttonView.element.addEventListener('click', () => {
        setTimeout(() => this._tryAddSearch(), 100);
      });
    }

    // Global observer for any panels
    if (this.config.useGlobalObserver !== false) {
      const globalObserver = new MutationObserver(() => {
        this._tryAddSearch();
      });

      globalObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  /**
   * Clear search input and reset filter
   */
  _clearSearch() {
    const searchInput = document.querySelector(`.${this.config.searchInputClass}`);
    if (searchInput) {
      const panelElement = searchInput.closest('.ck-dropdown__panel');
      clearSearchUtil(panelElement, this.config.searchInputClass);
    }
  }

  /**
   * Add search input to the dropdown panel
   */
  _addSearchInput(panelView) {
    const panelElement = panelView?.element || panelView;

    addSearchToPanel(
      panelElement,
      {
        inputClass: this.config.searchInputClass,
        wrapperClass: this.config.searchWrapperClass,
        panelClass: this.config.panelClass,
        placeholder: this.config.placeholder,
        maxHeight: this.config.maxHeight,
        searchBarHeight: this.config.searchBarHeight,
        autoFocus: this.config.autoFocus
      },
      (term) => {
        this._filterItems(panelElement, term);
      }
    );
  }

  /**
   * Filter list items based on search term
   */
  _filterItems(panelElement, searchTerm) {
    const element = panelElement?.element || panelElement;
    filterListItems(element, searchTerm, this.config.filterItem);
  }
  }

  return SearchableDropdownPlugin;
}
