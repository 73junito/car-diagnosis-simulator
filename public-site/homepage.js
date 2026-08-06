document.getElementById('navToggle')?.addEventListener('click', ()=>{
  const nav = document.getElementById('mainNav');
  if(!nav) return;
  nav.classList.toggle('open');
});

// Progressive enhancement: ensure links to app open in new tab for clarity
document.querySelectorAll('a[href="https://app.autolearnpro.com/"]').forEach(a=>{
  a.setAttribute('target','_blank');
  a.setAttribute('rel','noopener noreferrer');
});
