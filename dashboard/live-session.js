(function(){
  function qs(sel){ return document.querySelector(sel) }
  const status = qs('#conn-status');
  const reconnectBtn = qs('#reconnect');
  const clearBtn = qs('#clear-feed');
  const list = qs('#event-list');
  const active = qs('#active-sessions');
  const lastEvent = qs('#last-event');

  // Access placeholder: show unauthorized state if role not instructor
  function showUnauthorizedState(){
    const main = document.querySelector('main');
    if (!main) return;
    // build DOM nodes safely rather than injecting HTML
    while (main.firstChild) main.removeChild(main.firstChild);
    const card = document.createElement('div');
    card.className = 'tm-card';
    const h2 = document.createElement('h2');
    h2.textContent = 'Unauthorized';
    const p = document.createElement('p');
    p.textContent = 'Instructor access required to view live sessions.';
    card.appendChild(h2);
    card.appendChild(p);
    main.appendChild(card);
  }

  try{
    const role = localStorage.getItem('torquemindRole');
    if (role !== 'instructor') { showUnauthorizedState(); return; }
  }catch(e){ void e; }

  let es = null;
  function setStatus(s){
    status.textContent = s.text;
    status.className = 'badge ' + (s.cls||'badge-warn');
  }

  function addEventToList(evt){
    const li = document.createElement('li');
    const ts = evt.timestamp || new Date().toISOString();
    li.textContent = `[${ts}] ${evt.type} ${evt.id||''} ${evt.payload? JSON.stringify(evt.payload): ''}`;
    list.insertBefore(li, list.firstChild);
    while(list.children.length > 500) list.removeChild(list.lastChild);
    lastEvent.textContent = ts;
  }

  function connect(){
    if (es) es.close();
    try{
      es = new EventSource('/api/telemetry/stream');
      setStatus({ text: 'Connecting...', cls: 'badge-warn' });

      es.onopen = function(){ setStatus({ text: 'Connected', cls: 'badge-success' }); };
      es.onmessage = function(e){
        try{
          const data = JSON.parse(e.data);
          addEventToList(data);
          // rough active sessions count from payload
          if (data.activeSessions != null) active.textContent = data.activeSessions;
        }catch(er){ void er; }
      };
      es.onerror = function(){ setStatus({ text: 'Disconnected', cls: 'badge-danger' }); };
    }catch(e){ setStatus({ text: 'Error', cls: 'badge-danger' }); }
  }

  reconnectBtn.addEventListener('click', ()=> connect());
  clearBtn.addEventListener('click', ()=> {
    // clear list without using innerHTML
    while (list.firstChild) list.removeChild(list.firstChild);
    lastEvent.textContent = '—';
  });

  // auto-connect
  connect();
})();
