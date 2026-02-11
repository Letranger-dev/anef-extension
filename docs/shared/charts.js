/**
 * shared/charts.js — Chart.js helpers & dark theme
 */
(function() {
  'use strict';

  window.ANEF = window.ANEF || {};

  var instances = {};

  /** Register dark theme defaults for Chart.js */
  function registerDarkTheme() {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#1e293b';
    Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    Chart.defaults.plugins.legend.labels.color = '#e2e8f0';
    Chart.defaults.plugins.legend.labels.padding = 12;
    Chart.defaults.plugins.tooltip.backgroundColor = '#1e293b';
    Chart.defaults.plugins.tooltip.titleColor = '#e2e8f0';
    Chart.defaults.plugins.tooltip.bodyColor = '#94a3b8';
    Chart.defaults.plugins.tooltip.borderColor = '#334155';
    Chart.defaults.plugins.tooltip.borderWidth = 1;

    Chart.defaults.scale.grid.color = '#1e293b';
    Chart.defaults.scale.ticks.color = '#94a3b8';
  }

  /** Create (or replace) a named chart */
  function createChart(name, canvasId, config) {
    destroyChart(name);
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    var chart = new Chart(canvas, config);
    instances[name] = chart;
    return chart;
  }

  /** Destroy a named chart */
  function destroyChart(name) {
    if (instances[name]) {
      instances[name].destroy();
      delete instances[name];
    }
  }

  /** Destroy all charts */
  function destroyAll() {
    var keys = Object.keys(instances);
    for (var i = 0; i < keys.length; i++) {
      instances[keys[i]].destroy();
    }
    instances = {};
  }

  /** Get a chart instance by name */
  function getChart(name) {
    return instances[name] || null;
  }

  /** Doughnut chart config helper */
  function doughnutConfig(labels, values, colors) {
    return {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors.map(function(c) { return c + 'cc'; }),
          borderColor: colors,
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#e2e8f0', font: { size: 11 }, padding: 12 }
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                var total = ctx.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                var pct = ((ctx.parsed / total) * 100).toFixed(0);
                return ' ' + ctx.label + ': ' + ctx.parsed + ' (' + pct + '%)';
              }
            }
          }
        }
      }
    };
  }

  /** Horizontal bar config helper */
  function horizontalBarConfig(labels, values, colors, opts) {
    opts = opts || {};
    return {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: opts.label || '',
          data: values,
          backgroundColor: typeof colors === 'string' ? colors : colors.map(function(c) { return c + '99'; }),
          borderColor: typeof colors === 'string' ? colors : colors,
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: opts.datalabels || false
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', callback: function(v) { return v + (opts.suffix || ''); } },
            grid: { color: '#1e293b' }
          },
          y: {
            ticks: { color: '#94a3b8', font: { size: 11 } },
            grid: { display: false }
          }
        }
      }
    };
  }

  /** Line chart config helper */
  function lineConfig(labels, datasets, opts) {
    opts = opts || {};
    return {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#e2e8f0' } },
          datalabels: false
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 45 },
            grid: { color: '#1e293b' }
          },
          y: {
            ticks: { color: '#94a3b8', callback: function(v) { return v + (opts.ySuffix || ''); } },
            grid: { color: '#1e293b' },
            beginAtZero: opts.beginAtZero !== false
          }
        }
      }
    };
  }

  /** Bar chart config helper */
  function barConfig(labels, datasets, opts) {
    opts = opts || {};
    var plugins = [];
    if (typeof ChartDataLabels !== 'undefined' && opts.datalabels !== false) plugins.push(ChartDataLabels);

    return {
      type: 'bar',
      plugins: plugins,
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e2e8f0' } },
          datalabels: opts.datalabels || {
            color: '#e2e8f0',
            font: { size: 10, weight: 'bold' },
            anchor: 'end',
            align: 'top',
            formatter: function(v) { return v != null ? v + (opts.suffix || '') : ''; }
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ctx.dataset.label + ': ' + ctx.parsed.y + (opts.suffix || '');
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 45 },
            grid: { color: '#1e293b' },
            stacked: opts.stacked || false
          },
          y: {
            ticks: { color: '#94a3b8', callback: function(v) { return v + (opts.ySuffix || ''); } },
            grid: { color: '#1e293b' },
            stacked: opts.stacked || false,
            beginAtZero: true
          }
        }
      }
    };
  }

  ANEF.charts = {
    registerDarkTheme: registerDarkTheme,
    create: createChart,
    destroy: destroyChart,
    destroyAll: destroyAll,
    get: getChart,
    doughnutConfig: doughnutConfig,
    horizontalBarConfig: horizontalBarConfig,
    lineConfig: lineConfig,
    barConfig: barConfig
  };
})();
