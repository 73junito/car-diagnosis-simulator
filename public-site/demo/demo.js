(function(){
  const steps=Array.from(document.querySelectorAll('.demo-step'))
  const status=document.getElementById('demoStatus')
  const restart=document.getElementById('restartDemo')

  function setActive(index){
    steps.forEach((step,i)=>{
      const button=step.querySelector('.demo-step__button')
      const panel=step.querySelector('.demo-step__panel')
      const active=i===index
      step.classList.toggle('is-active',active)
      button.setAttribute('aria-expanded',String(active))
      panel.hidden=!active
    })
    const labels=['Concern','Evidence','Evaluate','Test','Verify']
    status.textContent='Current step: '+labels[index]+'. This public demo is non-graded and does not submit or save your work.'
    steps[index]?.querySelector('.demo-step__button')?.focus()
  }

  steps.forEach((step,index)=>{
    const button=step.querySelector('.demo-step__button')
    button.addEventListener('click',()=>setActive(index))

    const next=step.querySelector('.demo-next')
    if(next){
      next.addEventListener('click',()=>setActive(Math.min(index+1,steps.length-1)))
    }
  })

  restart.addEventListener('click',()=>{
    document.querySelectorAll('input[type="radio"]').forEach((input)=>{input.checked=false})
    document.querySelectorAll('textarea').forEach((input)=>{input.value=''})
    document.querySelectorAll('select').forEach((input)=>{input.selectedIndex=0})
    setActive(0)
  })

  setActive(0)
})()
