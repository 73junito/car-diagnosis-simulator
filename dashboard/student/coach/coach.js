(function(){
  const status=document.getElementById('coachStatus')
  const root=document.getElementById('coachRecommendations')
  const context=document.getElementById('coachContext')
  const refresh=document.getElementById('coachRefresh')

  function token(){
    return typeof window.getAccessToken==='function' ? window.getAccessToken() : null
  }
  function clear(){
    while(root.firstChild) root.removeChild(root.firstChild)
  }
  function title(value){
    return String(value || 'Scenario').replace(/[-_]+/g,' ').replace(/\b\w/g,(x)=>x.toUpperCase())
  }
  function empty(message){
    clear()
    const p=document.createElement('p')
    p.className='empty-state'
    p.textContent=message
    root.appendChild(p)
  }
  function render(rows){
    clear()
    rows.forEach((row)=>{
      const card=document.createElement('article')
      card.className='tm-card'
      const h=document.createElement('h3')
      h.textContent=title(row.scenario_id)
      const reason=document.createElement('p')
      reason.textContent=row.reason || 'Practice recommendation available.'
      const provenance=document.createElement('p')
      const source=row.provenance?.source || 'training_progress'
      const basis=row.provenance?.basis || 'aggregate_practice_performance'
      provenance.textContent='Source: '+source.replaceAll('_',' ')+' · Basis: '+basis.replaceAll('_',' ')
      const link=document.createElement('a')
      link.className='tm-btn tm-btn-primary'
      link.href='/dashboard/student/?scenario='+encodeURIComponent(row.scenario_id)
      link.textContent='Open Practice Scenario'
      card.append(h,reason,provenance,link)
      root.appendChild(card)
    })
  }

  async function load(){
    if(typeof window.waitForAuth==='function') await window.waitForAuth().catch(()=>null)
    const accessToken=token()
    if(!accessToken){
      status.textContent='Sign in to view Coach recommendations.'
      empty('Recommendations are unavailable while signed out.')
      return
    }
    status.textContent='Loading recommendations…'
    try{
      const response=await fetch('/api/student/recommendations',{
        headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'}
      })
      const payload=await response.json().catch(()=>({}))
      if(!response.ok) throw new Error(payload.error || 'Unable to load recommendations.')
      const rows=Array.isArray(payload.recommendations)?payload.recommendations:[]
      if(payload.coachSummary?.summary){
        context.textContent=payload.coachSummary.summary+' Recommendations remain practice-only and are not grades or assessment decisions.'
      }else if(payload.context?.statement){
        context.textContent=payload.context.statement
      }
      if(!rows.length){
        status.textContent='No recommendation is available yet.'
        empty('Complete training activity to give the Coach enough history for a recommendation.')
        return
      }
      render(rows)
      status.textContent=rows.length+' practice recommendation'+(rows.length===1?'':'s')+' available.'
    }catch(error){
      status.textContent=error.message || 'Unable to load recommendations.'
      empty('Coach recommendations are currently unavailable.')
    }
  }

  refresh.addEventListener('click',load)
  load()
})()
