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
  const myInvitationList = document.getElementById('myInvitationList')
  const adminPanel = document.getElementById('institutionAdminPanel')
  const inviteForm = document.getElementById('institutionInviteForm')
  const inviteEmail = document.getElementById('institutionInviteEmail')
  const inviteRole = document.getElementById('institutionInviteRole')
  const inviteNote = document.getElementById('institutionInviteNote')
  const memberList = document.getElementById('institutionMemberList')
  const studentClaimList = document.getElementById('institutionStudentClaimList')
  const pendingInvitationList = document.getElementById('institutionPendingInvitationList')
  const settingsForm = document.getElementById('institutionSettingsForm')
  const displayNameInput = document.getElementById('institutionDisplayName')
  const websiteUrlInput = document.getElementById('institutionWebsiteUrl')
  const supportEmailInput = document.getElementById('institutionSupportEmail')
  const timezoneInput = document.getElementById('institutionTimezone')
  const localeInput = document.getElementById('institutionLocale')
  const domainForm = document.getElementById('institutionDomainForm')
  const domainNameInput = document.getElementById('institutionDomainName')
  const domainSourceInput = document.getElementById('institutionDomainSource')
  const domainAddButton = document.getElementById('institutionDomainAddButton')
  const domainList = document.getElementById('institutionDomainList')
  const reportRefresh = document.getElementById('institutionReportRefresh')
  const reportSummary = document.getElementById('institutionReportSummary')
  const classReportList = document.getElementById('institutionClassReportList')
  let activeSchoolCode = null
  let activeActorRole = null

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

  function button(label, onClick, className){
    const element = document.createElement('button')
    element.type = 'button'
    element.className = className || 'tm-btn tm-btn-secondary'
    element.textContent = label
    element.addEventListener('click', onClick)
    return element
  }

  async function loadMyInvitations(){
    clear(myInvitationList)
    try {
      const payload = await window.apiGet('/api/institution/invitations')
      const invitations = Array.isArray(payload.invitations) ? payload.invitations : []
      if (!invitations.length) {
        myInvitationList.appendChild(item('No pending invitations for this account.'))
        return
      }

      invitations.forEach((invitation) => {
        const row = document.createElement('div')
        row.className = 'tm-card'
        const institutionName = invitation.institution?.school_name || invitation.schoolCode
        const summary = document.createElement('p')
        summary.textContent = institutionName + ' · ' + String(invitation.role || 'member').replaceAll('_', ' ')
        row.appendChild(summary)
        row.appendChild(button('Accept Invitation', async () => {
          try {
            await window.apiPost('/api/institution/invitations/' + encodeURIComponent(invitation.id) + '/accept', {})
            status.textContent = 'Institution invitation accepted.'
            await init()
          } catch (error) {
            status.textContent = error?.message || 'Unable to accept institution invitation.'
          }
        }, 'tm-btn tm-btn-primary'))
        myInvitationList.appendChild(row)
      })
    } catch (error) {
      myInvitationList.appendChild(item(error?.message || 'Unable to load invitations.'))
    }
  }

  function roleCanManage(actorRole, targetRole){
    if (actorRole === 'institution_owner') return true
    return targetRole === 'member' || targetRole === 'instructor'
  }

  function metric(label, value){
    const row = document.createElement('p')
    row.textContent = label + ': ' + value
    return row
  }

  async function loadInstitutionReport(schoolCode){
    clear(reportSummary)
    clear(classReportList)
    try {
      const report = await window.apiGet('/api/institution/admin/report?schoolCode=' + encodeURIComponent(schoolCode))
      // Attempt-derived activity is withheld by the API until attempts carry trusted
      // class attribution, so render it unavailable rather than as an implied zero.
      const activity = report.activity || null
      const roles = report.membershipCounts || {}

      reportSummary.appendChild(metric('Active memberships', report.activeMemberships ?? 0))
      reportSummary.appendChild(metric('Members', roles.member ?? 0))
      reportSummary.appendChild(metric('Instructors', roles.instructor ?? 0))
      reportSummary.appendChild(metric('Institution admins', roles.institution_admin ?? 0))
      reportSummary.appendChild(metric('Institution owners', roles.institution_owner ?? 0))
      reportSummary.appendChild(metric('Programs', (report.programs?.active ?? 0) + ' active / ' + (report.programs?.total ?? 0) + ' total'))
      reportSummary.appendChild(metric('Cohorts', (report.cohorts?.active ?? 0) + ' active / ' + (report.cohorts?.total ?? 0) + ' total'))
      reportSummary.appendChild(metric('Classes', report.classes ?? 0))
      reportSummary.appendChild(metric('Enrollments', report.enrollments ?? 0))
      reportSummary.appendChild(metric('Unique enrolled students', report.uniqueStudents ?? 0))
      reportSummary.appendChild(metric('Attempt records', activity && activity.attempts != null ? activity.attempts : 'Unavailable'))
      reportSummary.appendChild(metric('Completed attempts', activity && activity.completedAttempts != null ? activity.completedAttempts : 'Unavailable'))
      reportSummary.appendChild(metric('Completion rate', activity && activity.completionRate != null ? activity.completionRate + '%' : 'Unavailable'))
      reportSummary.appendChild(metric('Average score', activity && activity.averageScore != null ? activity.averageScore : 'Unavailable'))

      const interpretation = document.createElement('p')
      interpretation.textContent = report.interpretation || 'Operational learning activity only.'
      reportSummary.appendChild(interpretation)

      const summaries = Array.isArray(report.classSummaries) ? report.classSummaries : []
      if (!summaries.length) {
        classReportList.appendChild(item('No tenant-scoped class activity is available.'))
      } else {
        summaries.forEach((summary) => {
          const card = document.createElement('div')
          card.className = 'tm-card'
          const title = document.createElement('h4')
          title.textContent = summary.name || 'Class'
          card.appendChild(title)
          const classActivity = summary.activity || null
          card.appendChild(metric('Students', summary.studentCount ?? 0))
          card.appendChild(metric('Attempts', classActivity && classActivity.attempts != null ? classActivity.attempts : 'Unavailable'))
          card.appendChild(metric('Completed', classActivity && classActivity.completedAttempts != null ? classActivity.completedAttempts : 'Unavailable'))
          card.appendChild(metric('Completion rate', classActivity && classActivity.completionRate != null ? classActivity.completionRate + '%' : 'Unavailable'))
          card.appendChild(metric('Average score', classActivity && classActivity.averageScore != null ? classActivity.averageScore : 'Unavailable'))
          classReportList.appendChild(card)
        })
      }
    } catch (error) {
      reportSummary.appendChild(metric('Report status', error?.message || 'Institution report unavailable.'))
    }
  }

  async function decideStudentClaim(claim, decision, note, schoolCode){
    const confirmed = window.confirm(decision === 'verified'
      ? 'Verify this student institution claim? This creates only a basic institution member relationship.'
      : 'Reject this student institution claim?')
    if (!confirmed) return

    try {
      await window.apiPatch(
        '/api/institution/admin/student-claims/' + encodeURIComponent(claim.userId),
        { decision, reviewNote: note }
      )
      status.textContent = 'Student institution claim decision saved.'
      await loadAdministration(schoolCode)
    } catch (error) {
      status.textContent = error?.message || 'Unable to save student institution claim decision.'
    }
  }

  async function loadStudentClaims(schoolCode){
    clear(studentClaimList)
    const payload = await window.apiGet('/api/institution/admin/student-claims?status=claimed')
    const claims = (Array.isArray(payload.claims) ? payload.claims : [])
      .filter((claim) => claim.schoolCode === schoolCode)

    if (!claims.length) {
      studentClaimList.appendChild(item('No pending student institution claims.'))
      return
    }

    claims.forEach((claim) => {
      const row = document.createElement('div')
      row.className = 'tm-card'
      const label = document.createElement('p')
      label.textContent = 'Student ' + claim.userId + ' · ' + (claim.institution?.schoolName || claim.schoolCode)
      row.appendChild(label)

      const note = document.createElement('textarea')
      note.maxLength = 1000
      note.placeholder = 'Required for rejection; optional for verification.'
      row.appendChild(note)

      row.appendChild(button('Verify Claim', () =>
        decideStudentClaim(claim, 'verified', note.value.trim(), schoolCode),
      'tm-btn tm-btn-primary'))

      row.appendChild(button('Reject Claim', () => {
        const value = note.value.trim()
        if (!value) {
          status.textContent = 'A review note is required for rejection.'
          note.focus()
          return
        }
        decideStudentClaim(claim, 'rejected', value, schoolCode)
      }))

      studentClaimList.appendChild(row)
    })
  }

  async function loadAdministration(schoolCode){
    clear(memberList)
    clear(studentClaimList)
    clear(pendingInvitationList)
    try {
      const [memberPayload, invitationPayload, settingsPayload, domainPayload] = await Promise.all([
        window.apiGet('/api/institution/admin/members?schoolCode=' + encodeURIComponent(schoolCode)),
        window.apiGet('/api/institution/admin/invitations?schoolCode=' + encodeURIComponent(schoolCode) + '&status=pending'),
        window.apiGet('/api/institution/admin/settings?schoolCode=' + encodeURIComponent(schoolCode)),
        window.apiGet('/api/institution/admin/domains?schoolCode=' + encodeURIComponent(schoolCode))
      ])

      activeActorRole = memberPayload.actorRole
      await loadStudentClaims(schoolCode)
      const settings = settingsPayload.settings || {}
      displayNameInput.value = settings.displayName || ''
      websiteUrlInput.value = settings.websiteUrl || ''
      supportEmailInput.value = settings.supportEmail || ''
      timezoneInput.value = settings.timezone || ''
      localeInput.value = settings.locale || 'en-US'
      const members = Array.isArray(memberPayload.members) ? memberPayload.members : []
      if (!members.length) {
        memberList.appendChild(item('No institution memberships.'))
      } else {
        members.forEach((member) => {
          const row = document.createElement('div')
          row.className = 'tm-card'
          const label = document.createElement('p')
          label.textContent = (member.email || member.userId) + ' · ' +
            String(member.role || 'member').replaceAll('_', ' ') + ' · ' + member.status
          row.appendChild(label)
          if (member.status === 'active' && roleCanManage(activeActorRole, member.role)) {
            row.appendChild(button('Remove Membership', async () => {
              if (!window.confirm('Remove this institution membership by suspending access?')) return
              try {
                await window.apiPatch('/api/institution/admin/members/' + encodeURIComponent(member.id), { action: 'suspend' })
                status.textContent = 'Institution membership removed.'
                await loadAdministration(schoolCode)
              } catch (error) {
                status.textContent = error?.message || 'Unable to remove institution membership.'
              }
            }))
          }
          memberList.appendChild(row)
        })
      }

      const invitations = Array.isArray(invitationPayload.invitations) ? invitationPayload.invitations : []
      if (!invitations.length) {
        pendingInvitationList.appendChild(item('No pending institution invitations.'))
      } else {
        invitations.forEach((invitation) => {
          const row = document.createElement('div')
          row.className = 'tm-card'
          const label = document.createElement('p')
          label.textContent = invitation.email + ' · ' + String(invitation.role || 'member').replaceAll('_', ' ')
          row.appendChild(label)
          if (roleCanManage(activeActorRole, invitation.role)) {
            row.appendChild(button('Revoke Invitation', async () => {
              if (!window.confirm('Revoke this pending invitation?')) return
              try {
                await window.apiPatch('/api/institution/admin/invitations/' + encodeURIComponent(invitation.id), {})
                status.textContent = 'Institution invitation revoked.'
                await loadAdministration(schoolCode)
              } catch (error) {
                status.textContent = error?.message || 'Unable to revoke institution invitation.'
              }
            }))
          }
          pendingInvitationList.appendChild(row)
        })
      }

      clear(domainList)
      const domains = Array.isArray(domainPayload.domains) ? domainPayload.domains : []
      if (!domains.length) {
        domainList.appendChild(item('No verified institutional domains configured.'))
      } else {
        domains.forEach((domain) => {
          const row = document.createElement('div')
          row.className = 'tm-card'
          const summary = document.createElement('p')
          summary.textContent = domain.domain + ' · ' + (domain.active ? 'active' : 'inactive') +
            ' · source: ' + domain.sourceReference
          row.appendChild(summary)

          if (activeActorRole === 'institution_owner') {
            const sourceLabel = document.createElement('label')
            sourceLabel.textContent = 'Verification source'
            const source = document.createElement('textarea')
            source.maxLength = 1000
            source.value = domain.sourceReference || ''
            sourceLabel.appendChild(source)
            row.appendChild(sourceLabel)

            row.appendChild(button('Save Verification Source', async () => {
              try {
                await window.apiPatch(
                  '/api/institution/admin/domains/' + encodeURIComponent(domain.domain) +
                    '?schoolCode=' + encodeURIComponent(schoolCode),
                  { sourceReference: source.value }
                )
                status.textContent = 'Verified-domain source updated.'
                await loadAdministration(schoolCode)
              } catch (error) {
                status.textContent = error?.message || 'Unable to update verified domain.'
              }
            }))

            row.appendChild(button(domain.active ? 'Deactivate Domain' : 'Reactivate Domain', async () => {
              const action = domain.active ? 'deactivate' : 'reactivate'
              if (!window.confirm('Confirm ' + action + ' for ' + domain.domain + '?')) return
              try {
                await window.apiPatch(
                  '/api/institution/admin/domains/' + encodeURIComponent(domain.domain) +
                    '?schoolCode=' + encodeURIComponent(schoolCode),
                  { active: !domain.active }
                )
                status.textContent = 'Verified-domain state updated.'
                await loadAdministration(schoolCode)
              } catch (error) {
                status.textContent = error?.message || 'Unable to update verified domain.'
              }
            }))
          }
          domainList.appendChild(row)
        })
      }

      domainNameInput.disabled = activeActorRole !== 'institution_owner'
      domainSourceInput.disabled = activeActorRole !== 'institution_owner'
      domainAddButton.disabled = activeActorRole !== 'institution_owner'

      inviteRole.querySelector('option[value="institution_admin"]').disabled = activeActorRole !== 'institution_owner'
      inviteRole.querySelector('option[value="institution_owner"]').disabled = activeActorRole !== 'institution_owner'
    } catch (error) {
      status.textContent = error?.message || 'Institution administration unavailable.'
    }
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

      activeSchoolCode = schoolCode
      adminNotice.textContent = payload.administrationGranted
        ? 'Institution administration authorization is active. Institution reporting and the broader tenant-isolation suite remain later G8 slices.'
        : 'Institution administration requires an institution admin or owner membership.'
      adminPanel.hidden = !payload.administrationGranted
      if (payload.administrationGranted) {
        await loadAdministration(schoolCode)
        await loadInstitutionReport(schoolCode)
      }
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
      await loadMyInvitations()
      const payload = await window.apiGet('/api/institution/memberships')
      const memberships = Array.isArray(payload.memberships) ? payload.memberships : []
      if (!memberships.length) {
        status.textContent = 'No active institution membership is available for this account.'
        overview.hidden = true
        adminPanel.hidden = true
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

  inviteForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!activeSchoolCode) return
    try {
      await window.apiPost('/api/institution/admin/invitations', {
        schoolCode: activeSchoolCode,
        email: inviteEmail.value,
        role: inviteRole.value,
        note: inviteNote.value
      })
      inviteForm.reset()
      status.textContent = 'Institution invitation created.'
      await loadAdministration(activeSchoolCode)
    } catch (error) {
      status.textContent = error?.message || 'Unable to create institution invitation.'
    }
  })

  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!activeSchoolCode) return
    try {
      await window.apiPatch('/api/institution/admin/settings', {
        schoolCode: activeSchoolCode,
        displayName: displayNameInput.value,
        websiteUrl: websiteUrlInput.value,
        supportEmail: supportEmailInput.value,
        timezone: timezoneInput.value,
        locale: localeInput.value
      })
      status.textContent = 'Institution settings saved.'
      await loadAdministration(activeSchoolCode)
    } catch (error) {
      status.textContent = error?.message || 'Unable to save institution settings.'
    }
  })

  domainForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!activeSchoolCode || activeActorRole !== 'institution_owner') return
    try {
      await window.apiPost('/api/institution/admin/domains', {
        schoolCode: activeSchoolCode,
        domain: domainNameInput.value,
        sourceReference: domainSourceInput.value
      })
      domainForm.reset()
      status.textContent = 'Verified domain added as affiliation evidence.'
      await loadAdministration(activeSchoolCode)
    } catch (error) {
      status.textContent = error?.message || 'Unable to add verified domain.'
    }
  })

  reportRefresh.addEventListener('click', async () => {
    if (!activeSchoolCode) return
    status.textContent = 'Refreshing institution report…'
    await loadInstitutionReport(activeSchoolCode)
    status.textContent = 'Institution report refreshed.'
  })

  init()
})()
