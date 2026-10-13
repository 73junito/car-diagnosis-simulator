(function(){
  const form=document.getElementById('referenceFilters')
  const audience=document.getElementById('referenceAudience')
  const query=document.getElementById('referenceQuery')
  const subject=document.getElementById('referenceSubject')
  const kind=document.getElementById('referenceKind')
  const rights=document.getElementById('referenceRights')
  const clearButton=document.getElementById('referenceClear')
  const status=document.getElementById('referenceStatus')
  const requestedAudience=new URLSearchParams(window.location.search).get('audience')
  if(requestedAudience==='instructor') audience.value='instructor'
  const results=document.getElementById('referenceResults')

  function token(){
    return typeof window.getAccessToken==='function' ? window.getAccessToken() : null
  }
  function clear(node){
    while(node.firstChild) node.removeChild(node.firstChild)
  }
  function el(tag,text,className){
    const node=document.createElement(tag)
    if(className) node.className=className
    if(text!=null) node.textContent=String(text)
    return node
  }
  function humanize(value){
    return String(value || '').replaceAll('_',' ').replaceAll('-',' ')
  }
  function yesNo(value){
    return value === true ? 'Allowed' : 'Not allowed'
  }
  function rightsSummary(source){
    const r=source.rights || {}
    return [
      ['Citation/link', r.citationLinkAllowed],
      ['Paraphrase/summary', r.paraphraseSummaryAllowed],
      ['Direct reproduction', r.directReproductionAllowed],
      ['Database storage', r.databaseStorageAllowed],
      ['AI/RAG ingestion', r.aiRagIngestionAllowed],
      ['Commercial use', r.commercialUseAllowed]
    ]
  }
  function isLinkOnly(source){
    const r=source.rights || {}
    return r.citationLinkAllowed===true &&
      r.directReproductionAllowed!==true &&
      r.databaseStorageAllowed!==true &&
      r.aiRagIngestionAllowed!==true
  }
  function renderSource(source){
    const card=el('article','', 'tm-card')
    card.appendChild(el('h3',source.title || source.id))

    const meta=[source.publisher,source.publicationYear,source.subjectArea,source.sourceKind]
      .filter(Boolean).join(' · ')
    if(meta) card.appendChild(el('p',meta,'fine-print'))

    const license=el('p','License / rights class: '+(source.licenseClassification || 'Not recorded'),'fine-print')
    card.appendChild(license)

    const audienceLabel=source.audience==='internal' ? 'Instructor/internal guidance' : 'Learner reference'
    card.appendChild(el('p','Audience: '+audienceLabel,'fine-print'))

    const badge=el('p',
      isLinkOnly(source)
        ? 'Link-only: do not store or ingest into AI/RAG.'
        : 'Reuse only according to the rights listed below.',
      'fine-print'
    )
    card.appendChild(badge)

    const list=document.createElement('ul')
    rightsSummary(source).forEach(([label,value])=>{
      list.appendChild(el('li',label+': '+yesNo(value)))
    })
    card.appendChild(list)

    if(source.rights?.attributionRequired===true){
      card.appendChild(el('p','Attribution required.','fine-print'))
    }
    if(source.rights?.shareAlikeRequired===true){
      card.appendChild(el('p','Share-alike requirement recorded.','fine-print'))
    }

    if(source.canonicalUrl && source.rights?.citationLinkAllowed===true){
      const link=document.createElement('a')
      link.href=source.canonicalUrl
      link.target='_blank'
      link.rel='noopener noreferrer'
      link.textContent='Open source'
      card.appendChild(link)
    } else {
      card.appendChild(el('p','Direct source link is not available under the recorded rights.','fine-print'))
    }
    return card
  }
  function setSelectOptions(select,values,firstLabel){
    const current=select.value
    clear(select)
    const first=document.createElement('option')
    first.value=''
    first.textContent=firstLabel
    select.appendChild(first)
    values.forEach((value)=>{
      const option=document.createElement('option')
      option.value=value
      option.textContent=humanize(value)
      select.appendChild(option)
    })
    if(values.includes(current)) select.value=current
  }
  async function load(){
    status.textContent='Loading governed references…'
    clear(results)

    const params=new URLSearchParams({view:'library',audience:audience.value})
    if(query.value.trim()) params.set('q',query.value.trim())
    if(subject.value) params.set('subjectArea',subject.value)
    if(kind.value) params.set('sourceKind',kind.value)
    if(rights.value) params.set('rights',rights.value)

    const headers={Accept:'application/json'}
    if(audience.value==='instructor'){
      const accessToken=token()
      if(!accessToken){
        status.textContent='Sign in with instructor access to view instructor/internal references.'
        results.appendChild(el('p','Learner references remain available from the Learner audience filter.','empty-state'))
        return
      }
      headers.Authorization='Bearer '+accessToken
    }

    try{
      const response=await fetch('/api/curriculum/references?'+params.toString(),{headers})
      const payload=await response.json().catch(()=>({}))
      if(!response.ok) throw new Error(payload.error || 'Reference library unavailable.')

      const rows=Array.isArray(payload.data)?payload.data:[]
      setSelectOptions(subject,Array.isArray(payload.filterOptions?.subjectAreas)?payload.filterOptions.subjectAreas:[],'All subjects')
      setSelectOptions(kind,Array.isArray(payload.filterOptions?.sourceKinds)?payload.filterOptions.sourceKinds:[],'All source types')

      if(!rows.length){
        results.appendChild(el('p','No governed references match the current filters.','empty-state'))
        status.textContent='No governed references match the current filters.'
        return
      }

      rows.forEach((source)=>results.appendChild(renderSource(source)))
      status.textContent='Showing '+rows.length+' governed reference'+(rows.length===1?'.':'s.')
    }catch(error){
      results.appendChild(el('p','Reference results are currently unavailable.','empty-state'))
      status.textContent=error.message || 'Reference library unavailable.'
    }
  }

  form.addEventListener('submit',(event)=>{event.preventDefault();load()})
  audience.addEventListener('change',()=>{
    subject.value=''
    kind.value=''
    load()
  })
  clearButton.addEventListener('click',()=>{
    query.value=''
    subject.value=''
    kind.value=''
    rights.value=''
    load()
  })
  load()
})()
