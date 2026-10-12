(function(){
  const status = document.getElementById('activityStatus')
  const timeline = document.getElementById('activityTimeline')
  const refresh = document.getElementById('activityRefresh')
  const previous = document.getElementById('activityPrevious')
  const next = document.getElementById('activityNext')
  const pageLabel = document.getElementById('activityPage')
  let page = 1
  const limit = 20

  function token(){
    return typeof window.getAccessToken === 'function' ? window.getAccessToken() : null
  }
  function clear(node){
    while (node.firstChild) node.removeChild(node.firstChild)
  }
  function formatScenario(value){
    if (value == null || value === '') return 'Scenario'
    return String(value).replace(/[-_]+/g,' ').replace(/\b\w/g,(x)=>x.toUpperCase())
  }
  function render(events){
    clear(timeline)
    if (!events.length) {
      const li=document.createElement('li')
      li.className='tm-timeline__item'
      li.textContent='No server-recorded activity is available for this page.'
      timeline.appendChild(li)
      return
    }
    events.forEach((event)=>{
      const li=document.createElement('li')
      li.className='tm-timeline__item'
      const strong=document.createElement('strong')
      strong.textContent=event.message || 'Learning activity'
      const detail=document.createElement('span')
      const parts=[formatScenario(event.scenarioKey || event.scenarioId)]
      if (event.recordType) parts.push(String(event.recordType))
      if (event.status) parts.push(String(event.status).replaceAll('_',' '))
      detail.textContent=parts.join(' · ')
      const time=document.createElement('small')
      time.textContent=event.occurredAt ? new Date(event.occurredAt).toLocaleString() : 'Time unavailable'
      li.append(strong,detail,time)
      timeline.appendChild(li)
    })
  }

  async function load(targetPage=page){
    if (typeof window.waitForAuth === 'function') await window.waitForAuth().catch(()=>null)
    const accessToken=token()
    if (!accessToken) {
      status.textContent='Sign in to view your recent activity.'
      render([])
      return
    }
    page=targetPage
    status.textContent='Loading recent activity…'
    previous.disabled=true
    next.disabled=true
    try{
      const response=await fetch('/api/student/activity?page='+page+'&limit='+limit,{
        headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'}
      })
      const payload=await response.json().catch(()=>({}))
      if(!response.ok) throw new Error(payload.error || 'Unable to load recent activity.')
      const events=Array.isArray(payload.events)?payload.events:[]
      render(events)
      pageLabel.textContent='Page '+payload.page
      previous.disabled=payload.page<=1
      next.disabled=!payload.hasMore
      status.textContent=events.length ? 'Recent activity loaded.' : 'No server-recorded activity is available.'
    }catch(error){
      status.textContent=error.message || 'Unable to load recent activity.'
      render([])
    }
  }

  refresh.addEventListener('click',()=>load(page))
  previous.addEventListener('click',()=>{ if(page>1) load(page-1) })
  next.addEventListener('click',()=>load(page+1))
  load(1)
})()
