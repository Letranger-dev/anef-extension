/**
 * shared/searchable-select.js — Searchable status select component
 */
(function() {
  'use strict';

  window.ANEF = window.ANEF || {};
  window.ANEF.ui = window.ANEF.ui || {};

  /**
   * Create a searchable status select dropdown
   * @param {string} containerId - ID of the container element
   * @param {Object} options
   * @param {string} options.defaultValue - Default status code or 'all'
   * @param {boolean} options.includeAll - Add "Toutes les etapes" option
   * @param {number[]} options.filterSteps - Only include these step numbers
   * @param {function} options.onChange - Callback(statusCode, stepNumber)
   * @param {string} options.placeholder - Search field placeholder
   */
  function createStatusSelect(containerId, options) {
    var container = document.getElementById(containerId);
    if (!container) return;

    options = options || {};
    var defaultValue = options.defaultValue || 'all';
    var includeAll = options.includeAll !== false;
    var filterSteps = options.filterSteps || null;
    var onChange = options.onChange || function() {};
    var placeholder = options.placeholder || 'Rechercher un statut...';

    var STATUTS = ANEF.constants.STATUTS;
    var PHASE_NAMES = ANEF.constants.PHASE_NAMES;

    // Build sorted list of statuts by rang
    var statutList = [];
    var codes = Object.keys(STATUTS);
    for (var i = 0; i < codes.length; i++) {
      var info = STATUTS[codes[i]];
      if (filterSteps && filterSteps.indexOf(info.etape) === -1) continue;
      statutList.push({ code: codes[i], etape: info.etape, rang: info.rang, explication: info.explication });
    }
    statutList.sort(function(a, b) { return a.rang - b.rang; });

    // Find display text for default value
    var defaultText = 'Toutes les etapes';
    if (defaultValue !== 'all') {
      for (var j = 0; j < statutList.length; j++) {
        if (statutList[j].code === defaultValue) {
          defaultText = statutList[j].code + ' \u2014 ' + statutList[j].explication;
          break;
        }
      }
    }

    // Build HTML
    var html = '<div class="status-select">' +
      '<button type="button" class="status-select-trigger">' +
        '<span class="status-select-text">' + escapeHtml(defaultText) + '</span>' +
        '<span class="status-select-arrow">&#x25BC;</span>' +
      '</button>' +
      '<div class="status-select-dropdown" style="display:none">' +
        '<input type="text" class="status-select-search" placeholder="' + escapeHtml(placeholder) + '">' +
        '<div class="status-select-options">';

    if (includeAll) {
      var allSelected = defaultValue === 'all' ? ' selected' : '';
      html += '<div class="status-select-option status-select-all' + allSelected + '" data-value="all" data-step="">Toutes les etapes</div>';
    }

    // Group by etape
    var currentEtape = -1;
    for (var k = 0; k < statutList.length; k++) {
      var s = statutList[k];
      if (s.etape !== currentEtape) {
        currentEtape = s.etape;
        html += '<div class="status-select-group-label">Etape ' + s.etape + ' \u2014 ' + escapeHtml(PHASE_NAMES[s.etape] || 'Inconnu') + '</div>';
      }
      var selected = defaultValue === s.code ? ' selected' : '';
      html += '<div class="status-select-option' + selected + '" data-value="' + escapeHtml(s.code) + '" data-step="' + s.etape + '">' +
        escapeHtml(s.code) + ' \u2014 ' + escapeHtml(s.explication) +
      '</div>';
    }

    html += '</div></div></div>';
    container.innerHTML = html;

    // Refs
    var selectEl = container.querySelector('.status-select');
    var trigger = container.querySelector('.status-select-trigger');
    var dropdown = container.querySelector('.status-select-dropdown');
    var searchInput = container.querySelector('.status-select-search');
    var optionsContainer = container.querySelector('.status-select-options');
    var textSpan = container.querySelector('.status-select-text');

    // Toggle dropdown
    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = dropdown.style.display !== 'none';
      if (isOpen) {
        close();
      } else {
        dropdown.style.display = 'flex';
        searchInput.value = '';
        filterOptions('');
        searchInput.focus();
      }
    });

    // Search filter
    searchInput.addEventListener('input', function() {
      filterOptions(searchInput.value);
    });

    // Prevent dropdown close on search input click
    searchInput.addEventListener('click', function(e) {
      e.stopPropagation();
    });

    // Option click
    optionsContainer.addEventListener('click', function(e) {
      var option = e.target.closest('.status-select-option');
      if (!option) return;

      var value = option.dataset.value;
      var step = option.dataset.step ? parseInt(option.dataset.step) : null;

      // Update selection visual
      var allOptions = optionsContainer.querySelectorAll('.status-select-option');
      for (var i = 0; i < allOptions.length; i++) allOptions[i].classList.remove('selected');
      option.classList.add('selected');

      // Update trigger text
      textSpan.textContent = value === 'all' ? 'Toutes les etapes' : option.textContent;

      close();
      onChange(value, step);
    });

    // Close on outside click
    document.addEventListener('click', function(e) {
      if (!selectEl.contains(e.target)) {
        close();
      }
    });

    function close() {
      dropdown.style.display = 'none';
    }

    function filterOptions(query) {
      var q = query.toLowerCase().trim();
      var options = optionsContainer.querySelectorAll('.status-select-option');
      var groups = optionsContainer.querySelectorAll('.status-select-group-label');
      var visibleSteps = {};
      var anyVisible = false;

      for (var i = 0; i < options.length; i++) {
        var opt = options[i];
        if (opt.dataset.value === 'all') {
          opt.style.display = q ? 'none' : '';
          if (!q) anyVisible = true;
          continue;
        }
        var text = opt.textContent.toLowerCase();
        var matches = !q || text.indexOf(q) !== -1;
        opt.style.display = matches ? '' : 'none';
        if (matches) {
          anyVisible = true;
          visibleSteps[opt.dataset.step] = true;
        }
      }

      // Show/hide group labels based on visible children
      for (var g = 0; g < groups.length; g++) {
        var label = groups[g].textContent;
        var match = label.match(/Etape (\d+)/);
        if (match) {
          groups[g].style.display = visibleSteps[match[1]] ? '' : 'none';
        }
      }

      // No results message
      var noResults = optionsContainer.querySelector('.status-select-no-results');
      if (!anyVisible) {
        if (!noResults) {
          noResults = document.createElement('div');
          noResults.className = 'status-select-no-results';
          noResults.textContent = 'Aucun statut trouve';
          optionsContainer.appendChild(noResults);
        }
        noResults.style.display = '';
      } else if (noResults) {
        noResults.style.display = 'none';
      }
    }

    // Return API for programmatic control
    return {
      getValue: function() {
        var selected = optionsContainer.querySelector('.status-select-option.selected');
        return selected ? selected.dataset.value : defaultValue;
      },
      setValue: function(value) {
        var options = optionsContainer.querySelectorAll('.status-select-option');
        for (var i = 0; i < options.length; i++) {
          options[i].classList.remove('selected');
          if (options[i].dataset.value === value) {
            options[i].classList.add('selected');
            textSpan.textContent = value === 'all' ? 'Toutes les etapes' : options[i].textContent;
          }
        }
      }
    };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  ANEF.ui.createStatusSelect = createStatusSelect;
})();
