/**
 * AUT 250 weekly laboratory — page boot.
 *
 * Loads the co-located lab.json and mounts the shared runtime with the
 * approved reusable assets. Requires an HTTP origin (local development
 * server); opening the file directly will not load lab.json.
 *
 * Developmental local serving only. This page is not registered in the
 * production static allowlist and must not be presented as a deployed route.
 */
(function () {
  'use strict';

  function boot() {
    var mount = document.getElementById('weeklyLab');
    if (!mount) return;
    var labId = document.body.getAttribute('data-lab-id') || '(unknown)';
    var status = document.getElementById('pageStatus');
    function say(message) { if (status) status.textContent = message; }

    if (typeof fetch !== 'function') {
      say('This preview needs an HTTP origin to load the lab package. Open it from a local development server.');
      return;
    }

    fetch('./lab.json', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (lab) {
        if (lab.labId !== labId) {
          throw new Error('Lab package id "' + lab.labId + '" does not match page id "' + labId + '".');
        }
        window.Aut250WeeklyLabRuntime.createWeeklyLab({
          mount: mount,
          lab: lab,
          assets: window.Aut250LabAssets || {}
        });
        say('Lab package loaded: ' + lab.labId + '. Nothing has been stored or submitted.');
      })
      .catch(function (error) {
        say('This lab package could not be loaded: ' + error.message
          + '. Serve the repository over HTTP from its root and reload.');
      });
  }

  window.Aut250WeeklyLabBoot = { boot: boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
