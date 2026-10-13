(function(){
  const health=document.getElementById('copilotHealth')
  const healthRefresh=document.getElementById('copilotHealthRefresh')
  const form=document.getElementById('copilotSessionForm')
  const sessionStatus=document.getElementById('copilotSessionStatus')
  const adviceBtn=document.getElementById('copilotAdviceBtn')
  const advicePanel=document.getElementById('copilotAdvicePanel')
  const summary=document.getElementById('copilotSummary')
  const nextAction=document.getElementById('copilotNextAction')
  const verification=document.getElementById('copilotVerification')
  const modelStatus=document.getElementById('copilotModelStatus')
  let sessionId=null
  let runtimeReady=false

  function token(){
    return typeof window.getAccessToken==='function' ? window.getAccessToken() : null
  }

  async function authToken(){
    if(typeof window.waitForAuth==='function') await window.waitForAuth().catch(()=>null)
    return token()
  }

  async function api(path, options={}){
    const accessToken=await authToken()
    if(!accessToken) throw new Error('Sign in to use the Diagnostic Copilot.')
    const headers={Accept:'application/json',...(options.headers||{}),Authorization:'Bearer '+accessToken}
    if(options.body) headers['Content-Type']='application/json'
    const response=await fetch(path,{...options,headers})
    const payload=await response.json().catch(()=>({}))
    if(!response.ok){
      const error=new Error(payload.error || 'Copilot request failed.')
      error.status=response.status
      error.reason=payload.reason
      throw error
    }
    return payload
  }

  function lines(value){
    return String(value||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean).slice(0,20)
  }

  function renderHealth(payload){
    runtimeReady=payload?.ready===true
    adviceBtn.disabled=!sessionId || !runtimeReady
    if(runtimeReady){
      const provider=payload.activation?.provider
      health.textContent='Available on this environment'+(provider?.model?' · '+provider.model:'')+'.'
    }else{
      const reason=payload?.activation?.reason || 'unavailable'
      health.textContent='Copilot model assistance is unavailable ('+reason+'). Deterministic session tools remain separate.'
    }
  }

  async function loadHealth(){
    health.textContent='Checking Copilot availability…'
    try{
      const accessToken=await authToken()
      if(!accessToken){
        runtimeReady=false
        health.textContent='Sign in to check Copilot availability.'
        adviceBtn.disabled=true
        return
      }
      const response=await fetch('/api/copilot/health',{headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'}})
      const payload=await response.json().catch(()=>({}))
      renderHealth(payload)
    }catch{
      runtimeReady=false
      health.textContent='Unable to verify Copilot availability.'
      adviceBtn.disabled=true
    }
  }

  form.addEventListener('submit',async(event)=>{
    event.preventDefault()
    sessionStatus.textContent='Creating diagnostic session…'
    advicePanel.hidden=true
    const yearText=document.getElementById('copilotYear').value.trim()
    const payload={
      mode:document.getElementById('copilotMode').value,
      vehicle:{
        year:yearText?Number(yearText):null,
        make:document.getElementById('copilotMake').value.trim(),
        model:document.getElementById('copilotModel').value.trim(),
        engine:document.getElementById('copilotEngine').value.trim(),
        match:'partial'
      },
      complaint:document.getElementById('copilotComplaint').value.trim(),
      symptoms:lines(document.getElementById('copilotSymptoms').value)
    }
    try{
      const body=await api('/api/copilot/sessions',{method:'POST',body:JSON.stringify(payload)})
      sessionId=body.session?.id || null
      sessionStatus.textContent=sessionId?'Session ready. You can request advisory guidance.':'Session could not be initialized.'
      adviceBtn.disabled=!sessionId || !runtimeReady
    }catch(error){
      sessionId=null
      adviceBtn.disabled=true
      sessionStatus.textContent=error.message
    }
  })

  adviceBtn.addEventListener('click',async()=>{
    if(!sessionId) return
    adviceBtn.disabled=true
    sessionStatus.textContent='Preparing advisory guidance…'
    try{
      const body=await api('/api/copilot/sessions/'+encodeURIComponent(sessionId)+'/advice',{method:'POST'})
      const advice=body.advice||{}
      summary.textContent=advice.summary||'No summary available.'
      nextAction.textContent=advice.nextAction||'No next action is available yet.'
      verification.textContent=advice.verificationReminder||'Technician verification is required.'
      modelStatus.textContent=body.modelUsed
        ? 'Model assistance was used only to summarize a deterministic, evidence-gated plan.'
        : 'No model call was needed; deterministic safeguards stopped the session before model assistance.'
      advicePanel.hidden=false
      sessionStatus.textContent='Advisory guidance prepared.'
    }catch(error){
      sessionStatus.textContent=error.message
    }finally{
      adviceBtn.disabled=!sessionId || !runtimeReady
    }
  })

  healthRefresh.addEventListener('click',loadHealth)
  loadHealth()
})()
