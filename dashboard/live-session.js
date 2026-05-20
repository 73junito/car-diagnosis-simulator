(function(){
  function qs(sel){ return document.querySelector(sel) }
  const status = qs('#conn-status');
  const reconnectBtn = qs('#reconnect');
  const clearBtn = qs('#clear-feed');
  const list = qs('#event-list');
  const active = qs('#active-sessions');
  const lastEvent = qs('#last-event');

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
        }catch(er){}
      };
      es.onerror = function(){ setStatus({ text: 'Disconnected', cls: 'badge-danger' }); };
    }catch(e){ setStatus({ text: 'Error', cls: 'badge-danger' }); }
  }

  reconnectBtn.addEventListener('click', ()=> connect());
  clearBtn.addEventListener('click', ()=> { list.innerHTML=''; lastEvent.textContent='—'; });

  // auto-connect
  connect();
})();
