(function(){
  'use strict'

  const status = document.getElementById('institutionAccessStatus')
  const select = document.getElementById('institutionSelect')
  const overview = document.getElementById('institutionOverview')
  const institutionName = document.getElementById('institutionName')
  const institutionRole = document.getElementById('institutionRole')
  const programs = document.getElementById('institutionPrograms')
  const cohorts = document.getElementById('institutionCohorts')
  const classes = document.getElementById('institutionClasses')
  const adminNotice = document.getElementById('institutionAdminNotice')

  function clear(node){
    while (node.firstChild) node.removeChild(node.firstChild)
  }

  function item(text){
    const li = document.createElement('li')
    li.textContent = text
    return li
  }

  function locationLabel(institution){
    return [institution?.city, institution?.stateCode || institution?.province || institution?.country]
      .filter(Boolean)
      .join(', ')
  }

  function renderList(node, rows, formatter, emptyText){
    clear(node)
    if (!rows.length) {
      node.appendChild(item(emptyText))
      return
    }
    rows.forEach((row) => node.appendChild(item(formatter(row))))
  }

  async function loadPortal(schoolCode){
    overview.hidden = true
    status.textContent = 'Loading authorized institution tenant…'
    try {
      const payload = await window.apiGet('/api/institution/portal?schoolCode=' + encodeURIComponent(schoolCode))
      const institution = payload.institution || {}
      institutionName.textContent = institution.schoolName || institution.schoolCode || 'Institution'
      const place = locationLabel(institution)
      institutionRole.textContent = 'Membership role: ' + String(payload.membership?.role || 'member').replaceAll('_', ' ') +
        (place ? ' · ' + place : '')

      renderList(programs, payload.programs || [], (row) =>
        row.name + (row.code ? ' (' + row.code + ')' : '') + (row.active ? '' : ' — inactive'),
      'No institution programs configured yet.')

      renderList(cohorts, payload.cohorts || [], (row) =>
        row.name + (row.active ? '' : ' — inactive'),
      'No institution cohorts configured yet.')

      renderList(classes, payload.classes || [], (row) =>
        row.name + (row.classCode ? ' · class code ' + row.classCode : ''),
      payload.membership?.role === 'member'
        ? 'Class visibility is not granted for member-only access.'
        : 'No tenant-scoped classes available.')

      adminNotice.textContent = payload.administrationGranted
        ? 'Institution administration authorization is active. Membership invitations, removal, settings, and reporting will be added in later G8 slices.'
        : 'This foundation is read-only. Institution administration requires an institution admin or owner membership.'
      overview.hidden = false
      status.textContent = 'Institution tenant loaded.'
    } catch (error) {
      status.textContent = error?.message || 'Institution tenant unavailable.'
    }
  }

  async function init(){
    if (typeof window.waitForAuth === 'function') {
      await window.waitForAuth().catch(() => null)
    }

    try {
      const payload = await window.apiGet('/api/institution/memberships')
      const memberships = Array.isArray(payload.memberships) ? payload.memberships : []
      if (!memberships.length) {
        status.textContent = 'No active institution membership is available for this account.'
        return
      }

      select.disabled = false
      memberships.forEach((membership) => {
        const option = document.createElement('option')
        option.value = membership.schoolCode
        option.textContent = membership.institution?.schoolName || membership.schoolCode
        select.appendChild(option)
      })

      const first = memberships[0]
      select.value = first.schoolCode
      await loadPortal(first.schoolCode)
    } catch (error) {
      status.textContent = error?.message || 'Unable to verify institution membership.'
    }
  }

  select.addEventListener('change', () => {
    if (select.value) loadPortal(select.value)
  })

  init()
})()
