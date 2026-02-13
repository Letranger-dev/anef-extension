/**
 * shared/filters.js — Composants filtres reutilisables + sync URL
 */
(function() {
  'use strict';

  window.ANEF = window.ANEF || {};

  var STEP_PILLS = [
    { value: 'all', label: 'Toutes', color: null },
    { value: '1-2', label: '1-2', color: '#6b7280' },
    { value: '3-5', label: '3-5', color: '#3b82f6' },
    { value: '6-8', label: '6-8', color: '#8b5cf6' },
    { value: '9-11', label: '9-11', color: '#f59e0b' },
    { value: '12-12', label: '12', color: '#10b981' }
  ];

  /** Create step pills in a container */
  function createStepPills(containerId, currentValue, onChange) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var html = '';
    for (var i = 0; i < STEP_PILLS.length; i++) {
      var p = STEP_PILLS[i];
      var active = (currentValue || 'all') === p.value ? ' active' : '';
      var style = p.color ? ' style="--pill-color:' + p.color + '"' : '';
      html += '<button class="pill' + active + '" data-value="' + p.value + '"' + style + '>' + p.label + '</button>';
    }
    container.innerHTML = html;

    container.addEventListener('click', function(e) {
      var pill = e.target.closest('.pill');
      if (!pill) return;
      container.querySelectorAll('.pill').forEach(function(p) { p.classList.remove('active'); });
      pill.classList.add('active');
      onChange(pill.dataset.value);
    });
  }

  /** Create prefecture dropdown (single select) */
  function createPrefectureDropdown(containerId, prefectures, currentValue, onChange) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var html = '<select id="filter-prefecture-select">';
    html += '<option value="all"' + (!currentValue || currentValue === 'all' ? ' selected' : '') + '>Toutes</option>';
    for (var i = 0; i < prefectures.length; i++) {
      var sel = currentValue === prefectures[i] ? ' selected' : '';
      html += '<option value="' + ANEF.utils.escapeHtml(prefectures[i]) + '"' + sel + '>' + ANEF.utils.escapeHtml(prefectures[i]) + '</option>';
    }
    html += '</select>';
    container.innerHTML = html;

    container.querySelector('select').addEventListener('change', function(e) {
      onChange(e.target.value);
    });
  }

  /** Create prefecture multi-select dropdown */
  function createPrefectureMultiSelect(containerId, prefectures, currentValues, onChange) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var esc = ANEF.utils.escapeHtml;
    // currentValues: 'all' or array of selected prefectures
    var selected = (!currentValues || currentValues === 'all') ? [] : (Array.isArray(currentValues) ? currentValues : [currentValues]);
    var allSelected = selected.length === 0;

    function triggerText() {
      if (allSelected || selected.length === 0) return 'Toutes';
      if (selected.length === 1) return selected[0];
      return selected.length + ' s\u00e9lectionn\u00e9es';
    }

    var html = '<div class="pref-multiselect">' +
      '<button type="button" class="pref-ms-trigger"><span class="pref-ms-text">' + esc(triggerText()) + '</span><span class="status-select-arrow">&#x25BC;</span></button>' +
      '<div class="pref-ms-dropdown" style="display:none">' +
        '<input type="text" class="pref-ms-search" style="width:100%" placeholder="Rechercher...">' +
        '<div class="pref-ms-options">' +
          '<label class="pref-ms-option pref-ms-all"><input type="checkbox"' + (allSelected ? ' checked' : '') + '> <span>Toutes les pr\u00e9fectures</span></label>';

    for (var i = 0; i < prefectures.length; i++) {
      var checked = !allSelected && selected.indexOf(prefectures[i]) !== -1 ? ' checked' : '';
      html += '<label class="pref-ms-option" data-pref="' + esc(prefectures[i]) + '"><input type="checkbox"' + checked + '> <span>' + esc(prefectures[i]) + '</span></label>';
    }
    html += '</div></div></div>';
    container.innerHTML = html;

    var selectEl = container.querySelector('.pref-multiselect');
    var trigger = container.querySelector('.pref-ms-trigger');
    var dropdown = container.querySelector('.pref-ms-dropdown');
    var searchInput = container.querySelector('.pref-ms-search');
    var optionsDiv = container.querySelector('.pref-ms-options');
    var textSpan = container.querySelector('.pref-ms-text');
    var allCheckbox = container.querySelector('.pref-ms-all input');

    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = dropdown.style.display !== 'none';
      if (isOpen) { dropdown.style.display = 'none'; }
      else { dropdown.style.display = 'flex'; searchInput.value = ''; filterOpts(''); searchInput.focus(); }
    });

    searchInput.addEventListener('click', function(e) { e.stopPropagation(); });
    searchInput.addEventListener('input', function() { filterOpts(searchInput.value); });

    function filterOpts(q) {
      q = q.toLowerCase().trim();
      var labels = optionsDiv.querySelectorAll('.pref-ms-option:not(.pref-ms-all)');
      for (var i = 0; i < labels.length; i++) {
        var text = labels[i].textContent.toLowerCase();
        labels[i].style.display = (!q || text.indexOf(q) !== -1) ? '' : 'none';
      }
    }

    allCheckbox.addEventListener('change', function() {
      if (allCheckbox.checked) {
        selected = [];
        allSelected = true;
        var cbs = optionsDiv.querySelectorAll('.pref-ms-option:not(.pref-ms-all) input');
        for (var i = 0; i < cbs.length; i++) cbs[i].checked = false;
      }
      update();
    });

    optionsDiv.addEventListener('change', function(e) {
      var label = e.target.closest('.pref-ms-option');
      if (!label || label.classList.contains('pref-ms-all')) return;
      var pref = label.dataset.pref;
      if (e.target.checked) {
        allSelected = false;
        allCheckbox.checked = false;
        if (selected.indexOf(pref) === -1) selected.push(pref);
      } else {
        var idx = selected.indexOf(pref);
        if (idx !== -1) selected.splice(idx, 1);
        if (selected.length === 0) { allSelected = true; allCheckbox.checked = true; }
      }
      update();
    });

    document.addEventListener('click', function(e) {
      if (!selectEl.contains(e.target)) dropdown.style.display = 'none';
    });

    function update() {
      textSpan.textContent = triggerText();
      onChange(allSelected ? 'all' : selected.slice());
    }
  }

  /** Create outcome filter (Tous/En cours/Favorable/Defavorable) */
  function createOutcomeFilter(containerId, currentValue, onChange) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var options = [
      { value: 'all', label: 'Tous' },
      { value: 'en_cours', label: 'En cours' },
      { value: 'favorable', label: 'Favorable' },
      { value: 'defavorable', label: 'Defavorable' }
    ];

    var html = '<select>';
    for (var i = 0; i < options.length; i++) {
      var sel = (currentValue || 'all') === options[i].value ? ' selected' : '';
      html += '<option value="' + options[i].value + '"' + sel + '>' + options[i].label + '</option>';
    }
    html += '</select>';
    container.innerHTML = html;

    container.querySelector('select').addEventListener('change', function(e) {
      onChange(e.target.value);
    });
  }

  /** Create complement filter (Tous/Avec/Sans) */
  function createComplementFilter(containerId, currentValue, onChange) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var options = [
      { value: 'all', label: 'Tous' },
      { value: 'with', label: 'Avec complement' },
      { value: 'without', label: 'Sans complement' }
    ];

    var html = '<select>';
    for (var i = 0; i < options.length; i++) {
      var sel = (currentValue || 'all') === options[i].value ? ' selected' : '';
      html += '<option value="' + options[i].value + '"' + sel + '>' + options[i].label + '</option>';
    }
    html += '</select>';
    container.innerHTML = html;

    container.querySelector('select').addEventListener('change', function(e) {
      onChange(e.target.value);
    });
  }

  /** Create granularity toggle (Mois/Trimestre/Semestre) */
  function createGranularityToggle(containerId, currentValue, onChange) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var options = [
      { value: 'month', label: 'Mois' },
      { value: 'quarter', label: 'Trimestre' },
      { value: 'semester', label: 'Semestre' }
    ];

    var html = '';
    for (var i = 0; i < options.length; i++) {
      var active = (currentValue || 'quarter') === options[i].value ? ' active' : '';
      html += '<button class="pill toggle-pill' + active + '" data-value="' + options[i].value + '">' + options[i].label + '</button>';
    }
    container.innerHTML = html;

    container.addEventListener('click', function(e) {
      var pill = e.target.closest('.pill');
      if (!pill) return;
      container.querySelectorAll('.pill').forEach(function(p) { p.classList.remove('active'); });
      pill.classList.add('active');
      onChange(pill.dataset.value);
    });
  }

  /** Create min sample slider */
  function createMinSampleSlider(containerId, currentValue, onChange) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var val = currentValue || 1;
    container.innerHTML =
      '<input type="range" min="1" max="10" value="' + val + '" class="slider" id="min-sample-slider">' +
      '<span class="slider-value" id="min-sample-value">' + val + '</span>';

    var slider = container.querySelector('input');
    var label = container.querySelector('.slider-value');
    slider.addEventListener('input', function() {
      label.textContent = slider.value;
      onChange(parseInt(slider.value));
    });
  }

  /** Read filters from URL params */
  function readFiltersFromURL() {
    var params = new URLSearchParams(window.location.search);
    return {
      step: params.get('step') || 'all',
      statut: params.get('statut') || 'all',
      prefecture: params.get('prefecture') ? (params.get('prefecture').indexOf(',') !== -1 ? params.get('prefecture').split(',') : params.get('prefecture')) : 'all',
      outcome: params.get('outcome') || 'all',
      complement: params.get('complement') || 'all',
      granularity: params.get('granularity') || 'quarter',
      minSample: parseInt(params.get('minSample')) || 1,
      search: params.get('search') || '',
      sort: params.get('sort') || ''
    };
  }

  /** Write filters to URL using history.replaceState */
  function writeFiltersToURL(filters) {
    var params = new URLSearchParams();
    var keys = Object.keys(filters);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = filters[k];
      if (v && v !== 'all' && v !== '' && v !== 'quarter' && v !== 1) {
        params.set(k, Array.isArray(v) ? v.join(',') : v);
      }
    }
    var search = params.toString();
    var url = window.location.pathname + (search ? '?' + search : '');
    history.replaceState(null, '', url);
  }

  /** Create status filter using searchable select (replaces step pills) */
  function createStatusFilter(containerId, currentValue, onChange) {
    if (!ANEF.ui || !ANEF.ui.createStatusSelect) return;
    ANEF.ui.createStatusSelect(containerId, {
      includeAll: true,
      defaultValue: currentValue || 'all',
      onChange: function(statusCode, stepNumber) {
        onChange(statusCode);
      }
    });
  }

  ANEF.filters = {
    createStepPills: createStepPills,
    createStatusFilter: createStatusFilter,
    createPrefectureDropdown: createPrefectureDropdown,
    createPrefectureMultiSelect: createPrefectureMultiSelect,
    createOutcomeFilter: createOutcomeFilter,
    createComplementFilter: createComplementFilter,
    createGranularityToggle: createGranularityToggle,
    createMinSampleSlider: createMinSampleSlider,
    readFiltersFromURL: readFiltersFromURL,
    writeFiltersToURL: writeFiltersToURL
  };
})();
