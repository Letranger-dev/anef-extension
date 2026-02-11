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

  /** Create prefecture dropdown */
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
      prefecture: params.get('prefecture') || 'all',
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
        params.set(k, v);
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
    createOutcomeFilter: createOutcomeFilter,
    createComplementFilter: createComplementFilter,
    createGranularityToggle: createGranularityToggle,
    createMinSampleSlider: createMinSampleSlider,
    readFiltersFromURL: readFiltersFromURL,
    writeFiltersToURL: writeFiltersToURL
  };
})();
