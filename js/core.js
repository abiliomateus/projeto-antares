/* =====================================================================
   core.js: núcleo compartilhado do pacote de simulações de física.

   Tudo fica no objeto global `Sim` (sem módulos ES, para funcionar ao
   abrir o HTML direto do disco). Carregue ANTES do script da simulação.

   Conteúdo:
     Sim.$ / Sim.css / Sim.f2 / Sim.nice   utilitários pequenos
     Sim.rk4(f, q, h)                      integrador numérico
     Sim.fit(canvas, prop, hMin, hMax)     canvas responsivo e nítido
     Sim.loop(fn)                          loop de animação
     Sim.controls(box, defs, P, onChange)  sliders
     Sim.readouts(box, itens)              painel de valores numéricos
     Sim.arrow(ctx, ...)                   seta (vetores)
     Sim.fm(v) / Sim.math(elemento)        números e fórmulas LaTeX (MathJax) em textos HTML
     Sim.setRange / Sim.setLabel           ajustam limites e rótulo de um slider já criado
     Sim.interactive(cv, fit) / Sim.hud    zoom e deslocamento do canvas principal; hud = desenho fixo na tela
     Sim.playbar(cv, getState, getPaused)  botões ▶/⏸ e reiniciar sobre o canvas (na barra do zoom)
     new Sim.Plot(canvas, opções)          gráfico de séries temporais

   Convenção de unidades: SI (m, s, kg), ângulos em graus só na interface.
   ===================================================================== */
(function(g){
const Sim=g.Sim={};
// Tema escolhido no menu (index.html) vale em todas as páginas: 'light' ou 'dark' (ausente = automático).
try{const th=localStorage.getItem('tema');if(th==='light'||th==='dark')document.documentElement.setAttribute('data-theme',th)}catch(e){}
/** Atalho para document.getElementById. */
Sim.$=id=>document.getElementById(id);
/** Lê uma variável CSS já resolvida para o tema atual (claro/escuro), ex.: Sim.css('--acc').
    Use sempre isto no canvas em vez de cores fixas, para o tema funcionar. */
Sim.css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
/** Número com 2 casas e vírgula decimal. Para mudar casas ou idioma, edite só aqui. */
Sim.f2=v=>v.toFixed(2).replace('.',',');
/** Como f2, mas para uso DENTRO de fórmulas LaTeX: a vírgula vai entre chaves, para não ganhar espaço. */
Sim.fm=v=>Sim.f2(v).replace(',','{,}');
/** Re-renderiza as fórmulas \( ... \) de um elemento HTML cujo conteúdo mudou (MathJax).
    Se o MathJax não estiver carregado (ex.: sem internet), não faz nada e o texto fica como está.
    Textos presentes na página ao carregar são renderizados sozinhos; só chame isto após alterar o conteúdo. */
Sim.math=el=>{
 const M=window.MathJax;if(!M||!M.startup||!M.startup.promise||!M.typesetPromise)return;
 M.startup.promise=M.startup.promise.then(()=>{if(M.typesetClear)M.typesetClear([el]);return M.typesetPromise([el])}).catch(()=>{});
};
/** Arredonda x para 1, 2, 5 ou 10 vezes uma potência de 10.
    Serve para escolher o espaçamento de grades e marcas de eixos. */
Sim.nice=x=>{const p=Math.pow(10,Math.floor(Math.log10(x))),m=x/p;return(m<1.5?1:m<3.5?2:m<7.5?5:10)*p};

/** Um passo de Runge-Kutta de 4ª ordem.
    @param f  função de derivadas: recebe o estado q (array) e devolve dq/dt (array de mesmo tamanho)
    @param q  estado atual, ex.: [x, y, vx, vy]
    @param h  passo de tempo em segundos
    @returns  novo estado após h segundos
    Para outra física, só troque `f`. Ex. oscilador: q=[x,v], f=q=>[q[1], -(k/m)*q[0]]. */
Sim.rk4=(f,q,h)=>{
 const k1=f(q),k2=f(q.map((v,i)=>v+h/2*k1[i])),k3=f(q.map((v,i)=>v+h/2*k2[i])),k4=f(q.map((v,i)=>v+h*k3[i]));
 return q.map((v,i)=>v+h/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
};

/** Faz o canvas ocupar a largura do elemento pai (que NÃO deve ter padding) e ficar nítido em telas retina.
    @param prop  proporção altura/largura desejada (ex.: 0.58)
    @param hMin, hMax  limites da altura em px
    @returns objeto {w, h} em px CSS, atualizado automaticamente ao redimensionar.
    Desenhe sempre usando o.w e o.h (não canvas.width, que inclui o fator retina). */
Sim.fit=(cv,ar,mn,mx)=>{
 const o={w:300,h:200},p=cv.parentElement;
//  const r=()=>{const d=devicePixelRatio||1;o.w=p.clientWidth;o.h=Math.round(Math.max(mn,Math.min(o.w*ar,mx)));
const r=()=>{
  const d=devicePixelRatio||1;
  o.w=p.clientWidth;
  o.h=p.matches(':fullscreen')
    ? p.clientHeight
    : Math.round(Math.max(mn,Math.min(o.w*ar,mx)));

  cv.style.width='100%';
  cv.style.height=o.h+'px';
  cv.width=o.w*d;
  cv.height=o.h*d;
  cv.getContext('2d').setTransform(d,0,0,d,0,0);
};
//   cv.style.height=o.h+'px';cv.width=o.w*d;cv.height=o.h*d;cv.getContext('2d').setTransform(d,0,0,d,0,0)};
 new ResizeObserver(r).observe(p);r();return o;
};


Sim.icons = {
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',

  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',

  zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M10.5 7.5v6M7.5 10.5h6"/>',

  zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M7.5 10.5h6"/>',

  resetZoom: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 4.5 4.5"/><path d="M9 8.5l2-1.5v7"/><path d="M9 14h4"/>',

  maximize: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',

  fullscreen: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',

  play: '<path d="m7 4 13 8-13 8z"/>',

  pause: '<path d="M8 5v14M16 5v14"/>',

  restart: '<path d="M3 11a9 9 0 1 1 2.6 6.4"/><path d="M1 3v7h7"/>',

  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/>',

  settings: '<path d="M12 6.9a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.3a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9h-.3a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2v-.3a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.3a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"/>',

  close: '<path d="M18 6 6 18M6 6l12 12"/>',

  copyCheck: '<path d="m9 12 4 4 12-12"/>',
};

Sim.icon = (name, size = 18) => {
  const paths = Sim.icons[name];
  if (!paths) return '';

  return `<svg xmlns="http://www.w3.org/2000/svg"
    width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">${paths}</svg>`;
};

Sim.iconButton = (name, title, onClick, size = 18) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = Sim.icon(name, size);
  b.title = title;
  b.setAttribute('aria-label', title);
  b.onclick = onClick;
  return b;
};


/** Barra de botões sobre o canvas (lateral direita, centralizada na vertical), compartilhada pelo zoom e pelo play/pause.
    Devolve o elemento .zbar do pai do canvas, criando-o se ainda não existir. */
Sim.bar=wrap=>{let b=wrap.querySelector('.zbar');if(!b){b=document.createElement('div');b.className='zbar';wrap.style.position='relative';wrap.appendChild(b)}return b};

/**
 * Painel flutuante de configurações sobre o canvas.
 * Move o container existente para o painel, sem duplicar os controles.
 */
Sim.settings = (cv, box) => {
  if (typeof box === 'string') box = document.querySelector(box);

  const wrap = cv?.parentElement;
  if (!wrap || !box) return;

  const bar = Sim.bar(wrap);

  // Botão de configurações
  const btn = Sim.iconButton(
    'settings',
    'Configurações da simulação',
    () => toggle()
  );

  bar.appendChild(btn);

  // Painel flutuante
  const panel = document.createElement('section');
  panel.className = 'sim-settings';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Configurações da simulação');

  Object.assign(panel.style, {
    position: 'absolute',
    zIndex: '20',
    top: '12px',
    right: '48px',
    width: 'min(340px, calc(100% - 60px))',
    maxHeight: '80%',
    overflowY: 'auto',
    padding: '14px',
    border: '1px solid var(--line, #ccc)',
    borderRadius: '10px',
    background: 'var(--card, #fff)',
    color: 'var(--ink, #222)',
    boxShadow: '0 4px 18px #0003',
    boxSizing: 'border-box'
  });

  
  // Cabeçalho e botão de fechar
  const head = document.createElement('div');

  Object.assign(head.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '12px'
  });

  const title = document.createElement('strong');
  title.textContent = 'Configurações';

  const close = Sim.iconButton(
  'close',
  'Fechar configurações',
  () => toggle(false)
  );

Object.assign(close.style, {
  width: '32px',
  height: '32px',
  minWidth: '32px',
  padding: '6px',
  flex: '0 0 32px',
  display: 'grid',
  placeItems: 'center'
});

  head.append(title, close);

  // Reserva a posição original de #ctl para não alterar o fluxo da página.
  const placeholder = document.createComment('posição original dos controles');
  box.parentNode.insertBefore(placeholder, box);

  panel.appendChild(head);
  panel.appendChild(box);
  wrap.appendChild(panel);

  function toggle(force) {
    const open = force ?? panel.hidden;

    panel.hidden = !open;
    btn.setAttribute(
      'aria-expanded',
      String(open)
    );

    if (open) {
      close.focus();
    } else {
      btn.focus();
    }
  }

  // Fecha ao clicar fora do painel ou pressionar Esc.
  document.addEventListener('pointerdown', e => {
    if (
      !panel.hidden &&
      !panel.contains(e.target) &&
      !btn.contains(e.target)
    ) {
      toggle(false);
    }
  });

  panel.addEventListener('pointerdown', e => e.stopPropagation());

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) toggle(false);
  });

  // Permite restaurar #ctl à posição original, se necessário.
  panel.restore = () => {
    placeholder.parentNode?.insertBefore(box, placeholder);
    placeholder.remove();
    panel.remove();
    btn.remove();
  };

  return panel;
};

Sim.speedbar = (cv, id, speeds = [0.25, 0.5, 1, 2]) => {
  const wrap = cv.parentElement;
  const ctl = Sim.ctl[id];
  if (!wrap || !ctl) return;

  const inp = ctl.inp;
  const min = inp.min === '' ? -Infinity : Number(inp.min);
  const max = inp.max === '' ? Infinity : Number(inp.max);
  const valid = speeds.filter(v => v >= min && v <= max);

  if (!valid.length) return;

  const bar = Sim.bar(wrap);
  const b = document.createElement('button');
  b.type = 'button';

  const update = () => {
    const v = Number(inp.value);
    const label = `Velocidade: ${v.toLocaleString('pt-BR')}×`;
    b.textContent = `${v.toLocaleString('pt-BR')}×`;
    b.title = `${label} — clique para alterar`;
    b.setAttribute('aria-label', b.title);
  };

  b.onclick = () => {
    const current = Number(inp.value);
    const next = valid.find(v => v > current + 1e-9) ?? valid[0];

    inp.value = String(next);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    update();
  };

  inp.addEventListener('input', update);
  bar.appendChild(b);
  update();
};

Sim.fullscreen = el => {
  if (typeof el === 'string') el = document.querySelector(el);
  if (!el) return;

  const cls = 'sim-fullscreen';
  const active = document.fullscreenElement ||
                 document.webkitFullscreenElement;

  // Se estiver em tela cheia nativa, sair.
  if (active) {
    return (document.exitFullscreen ||
            document.webkitExitFullscreen)?.call(document);
  }

  // Se o modo CSS estiver ativo, sair.
  if (el.classList.contains(cls)) {
    el.classList.remove(cls);
    document.body.classList.remove('sim-fullscreen-active');
    return;
  }

  // Tentar tela cheia nativa.
  const enter = el.requestFullscreen ||
                el.webkitRequestFullscreen;

  if (enter) {
    try {
      const result = enter.call(el);
      if (result && typeof result.catch === 'function') {
        return result.catch(() => {
          el.classList.add(cls);
          document.body.classList.add('sim-fullscreen-active');
        });
      }
      return result;
    } catch (_) {}
  }

  // Alternativa para iOS.
  el.classList.add(cls);
  document.body.classList.add('sim-fullscreen-active');
};

Sim._keys = {
  active: null,
  installed: false
};

Sim.registerKeys = (wrap, actions) => {
  const K = Sim._keys;

  wrap._simKeys = { ...wrap._simKeys, ...actions };

  const activate = () => { K.active = wrap; };
  wrap.addEventListener('pointerdown', activate);
  wrap.addEventListener('focusin', activate);

  if (K.installed) return;
  K.installed = true;

  document.addEventListener('keydown', e => {
    const el = e.target;
    if (el.matches('input, textarea, select') ||
        el.isContentEditable) return;

    const w = K.active;
    if (!w || !w._simKeys) return;

    const a = w._simKeys;
    let fn = null;

    if (e.code === 'Space') fn = a.play;
    else if (e.key === '+' || e.key === '=' ||
             e.code === 'NumpadAdd') fn = a.zoomIn;
    else if (e.key === '-' || e.code === 'NumpadSubtract')
      fn = a.zoomOut;
    else if (e.key === '0' || e.code === 'Numpad0')
      fn = a.reset;
    else if (e.code === 'KeyF' && !e.ctrlKey &&
             !e.altKey && !e.metaKey)
      fn = a.fullscreen;

    if (fn) {
      e.preventDefault();
      fn();
    }
  });
};
/** Zoom e deslocamento (pan) do canvas principal de uma simulação, sem mudar o código de desenho.
    Chame uma vez, logo depois de Sim.fit: Sim.interactive(cv, fit).
    Como funciona: o desenho continua usando as coordenadas de sempre; a cada quadro, o ctx.clearRect do canvas (chamado no
    início do desenho) também aplica a transformação de zoom/pan com ctx.setTransform. O desenho é refeito em vetor a cada
    quadro, então fica nítido em qualquer ampliação, e a simulação continua rodando normalmente.
    Controles: botões + / − / ⟲ (na lateral direita do canvas); Ctrl + roda do mouse (ou pinça no touchpad), em torno do
    cursor; pinça no celular; arrastar para mover (com zoom > 1); duplo clique para restaurar. O zoom vai de 1× a `max`
    (opção, padrão 8×) e nunca mostra além da área original. Textos e traços ampliam junto; o que deve ficar fixo na tela
    (barras de energia) é desenhado depois de Sim.hud(ctx). Devolve {z, x, y, reset()}. */
Sim.interactive=(cv,fit,o)=>{
 const ctx=cv.getContext('2d'),S={z:1,x:0,y:0,reset(){S.z=1;S.x=0;S.y=0;cursor()}},zmin = 0.25,zmax=(o&&o.max)||8,wrap=cv.parentElement,ptr=new Map(),orig=ctx.clearRect.bind(ctx);
 let dist0=0;
//  const clamp=()=>{S.x=Math.min(0,Math.max(fit.w*(1-S.z),S.x));S.y=Math.min(0,Math.max(fit.h*(1-S.z),S.y))};
 const clamp = () => {
    if (S.z < 1) {
        // Centraliza o desenho quando o zoom é reduzido.
        S.x = fit.w * (1 - S.z) / 2;
        S.y = fit.h * (1 - S.z) / 2;
    } else {
        // Restringe o deslocamento quando há ampliação.
        S.x = Math.min(0, Math.max(fit.w * (1 - S.z), S.x));
        S.y = Math.min(0, Math.max(fit.h * (1 - S.z), S.y));
    }
};
 const cursor=()=>{cv.style.cursor=S.z>1?'grab':'';cv.style.touchAction=S.z>1?'none':'pan-y'};   // com zoom, o dedo move o desenho em vez de rolar a página
 const zoomAt=(f,px,py)=>{const z=Math.min(zmax,Math.max(zmin,S.z*f)),k=z/S.z;S.x=px-(px-S.x)*k;S.y=py-(py-S.y)*k;S.z=z;clamp();cursor()};
 const pos=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*(fit.w/(r.width||fit.w)),(e.clientY-r.top)*(fit.h/(r.height||fit.h))]};
 ctx.clearRect=()=>{const d=devicePixelRatio||1;clamp();ctx.setTransform(1,0,0,1,0,0);orig(0,0,cv.width,cv.height);ctx.setTransform(d*S.z,0,0,d*S.z,d*S.x,d*S.y)};
 cv.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();const p=pos(e);zoomAt(Math.exp(-e.deltaY*.0025),p[0],p[1])},{passive:false});
 cv.addEventListener('dblclick',()=>S.reset());
 cv.addEventListener('pointerdown',e=>{ptr.set(e.pointerId,[e.clientX,e.clientY]);try{cv.setPointerCapture(e.pointerId)}catch(_){}if(S.z>1)cv.style.cursor='grabbing';dist0=0});
 cv.addEventListener('pointermove',e=>{
  if(!ptr.has(e.pointerId))return;
  const old=ptr.get(e.pointerId);ptr.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptr.size===2){                                                  // pinça: zoom em torno do ponto médio
   const v=[...ptr.values()],dist=Math.hypot(v[0][0]-v[1][0],v[0][1]-v[1][1]);
   if(dist0>0){const m=pos({clientX:(v[0][0]+v[1][0])/2,clientY:(v[0][1]+v[1][1])/2});zoomAt(dist/dist0,m[0],m[1])}
   dist0=dist;
  }else if(ptr.size===1&&S.z>1){S.x+=e.clientX-old[0];S.y+=e.clientY-old[1];clamp()}
 });
 const up=e=>{ptr.delete(e.pointerId);dist0=0;cursor()};
 cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
 if(wrap&&wrap.style&&wrap.querySelector){
  const bar=Sim.bar(wrap);

  const fs=document.createElement('button');
fs.type='button';
fs.innerHTML=Sim.icon('fullscreen');
fs.title='Tela cheia (Atalho: f)';
fs.setAttribute('aria-label','Tela cheia');
fs.dataset.fullscreen='';

fs.onclick=()=>Sim.fullscreen(wrap);

document.addEventListener('fullscreenchange',()=>{
  const ativo=document.fullscreenElement===wrap;
  fs.textContent=ativo?'⛶':'⛶';
  fs.title=ativo?'Sair da tela cheia (Atalho: f)':'Tela cheia (Atalho: f)';
  fs.setAttribute('aria-label',fs.title);
});

bar.appendChild(fs);

const zoomIn = () => zoomAt(1.1, fit.w/2, fit.h/2);
const zoomOut = () => zoomAt(1/1.1, fit.w/2, fit.h/2);
const reset = () => S.reset();

[
  ['zoomIn', 'Ampliar (Atalho: +)', zoomIn],
  ['zoomOut', 'Reduzir (Atalho: -)', zoomOut],
  ['resetZoom', 'Restaurar o zoom (Atalho: 0)', reset]
].forEach(([t, tt, f]) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML =  Sim.icon(t);
  b.title = tt;
  b.setAttribute('aria-label', tt);
  b.onclick = f;
  bar.appendChild(b);
});

Sim.registerKeys(wrap, {
  zoomIn,
  zoomOut,
  reset,
  fullscreen: () => Sim.fullscreen(wrap)
});

//   [['+','Ampliar (Ctrl + roda do mouse)',()=>zoomAt(1.1,fit.w/2,fit.h/2)],['-','Reduzir',()=>zoomAt(1/1.1,fit.w/2,fit.h/2)],['=','Restaurar o zoom (duplo clique)',()=>S.reset()]].forEach(([t,tt,f])=>{
//    const b=document.createElement('button');b.type='button';b.textContent=t;if(t.length>2)b.className='txt';b.title=tt;b.setAttribute('aria-label',tt);b.onclick=f;bar.appendChild(b)});
 }
 cursor();return S;
};
/** Botões de play/pause (um só botão que alterna) e de reiniciar sobre o canvas, no topo da barra do zoom. Úteis no celular,
    onde o painel de controles fica abaixo da animação. Eles apenas acionam os botões do painel (#bl, #bp e #bc), então a
    lógica de cada simulação não muda, e os dois conjuntos de botões ficam sempre de acordo.
    getState() devolve 'idle' (antes de soltar), 'run' (em andamento, pausada ou não) ou 'end'; getPaused() devolve se está pausada.
    Ícone e dica do botão: ▶ "Soltar" (idle), ⏸ "Pausar" (run), ▶ "Continuar" (pausada), ▶ "Reiniciar e soltar de novo" (end).
    Chame uma vez por simulação: Sim.playbar(cv, () => mode, () => paused). */
Sim.playbar=(cv,getState,getPaused)=>{
 const wrap=cv.parentElement;
 if(!wrap||!wrap.style||!wrap.querySelector)return;

 const L={
  idle:['play','Soltar (Espaço)'],
  run:['pause','Pausar (Espaço)'],
  paused:['play','Continuar (Espaço)'],
  end:['play','Reiniciar e soltar de novo (Espaço)']
 };

 const mk=(name,tt,f)=>{
  const b=document.createElement('button');
  b.type='button';
  b.innerHTML=Sim.icon(name,16);
  b.title=tt;
  b.setAttribute('aria-label',tt);
  b.onclick=f;
  return b;
 };

 const play=mk('play',L.idle[1],
  ()=>Sim.$(getState()==='run'?'bp':'bl').click()
 );

 const rst=mk('restart','Reiniciar a simulação',
  ()=>Sim.$('bc').click()
 );

 const sep=document.createElement('span');
 sep.className='zsep';

 const f=document.createDocumentFragment();
 f.appendChild(play);
 f.appendChild(rst);
 f.appendChild(sep);

 const bar=Sim.bar(wrap);
 bar.insertBefore(f,bar.firstChild);

 let cur='';

 const tick=()=>{
  const s=getState();
  const k=s==='run'&&getPaused()?'paused':s;

  if(k!==cur){
   cur=k;
   const l=L[k]||L.idle;
   play.innerHTML=Sim.icon(l[0],16);
   play.title=l[1];
   play.setAttribute('aria-label',l[1]);
  }

  Sim.registerKeys(wrap,{
   play:()=>play.click()
  });

  requestAnimationFrame(tick);
 };

 requestAnimationFrame(tick);
};

/** Desenho fixo na tela (sem zoom/pan): chame logo depois de ctx.save() e restaure com ctx.restore(). */
Sim.hud=ctx=>{const d=devicePixelRatio||1;ctx.setTransform(d,0,0,d,0,0)};

/** Loop de animação. Chama fn(dt) a cada quadro, com dt em segundos (limitado a 50 ms para
    evitar saltos quando a aba fica em segundo plano). A física deve ser avançada em passos
    fixos dentro de fn (ver step() em projeteis.js), nunca com dt direto. */
Sim.loop=fn=>{let l=performance.now();const f=n=>{fn(Math.min((n-l)/1000,.05));l=n;requestAnimationFrame(f)};requestAnimationFrame(f)};

/** Cria sliders a partir de definições.
    @param box       elemento onde os sliders são inseridos
    @param defs      lista de {id, label, unit, min, max, step, val}; o `id` vira o id do <input>
                     e a chave em P. As casas decimais mostradas vêm do número de casas de `step`.
    @param P         objeto que recebe os valores atuais (P.v0, P.ang, ...), sempre em número
    @param onChange  chamada com o id do slider alterado (use para reiniciar a simulação) */
Sim.ctl={};   // registro dos sliders criados, por id
Sim.controls=(box,defs,P,onChange)=>{
 defs.forEach(d=>{
  P[d.id]=d.val;
  const r=document.createElement('label');r.className='row';
  r.innerHTML='<span>'+d.label+'</span><output></output><input type="range" id="'+d.id+'" min="'+d.min+'" max="'+d.max+'" step="'+d.step+'" value="'+d.val+'">';
  box.appendChild(r);
  const inp=r.querySelector('input'),out=r.querySelector('output'),dec=(String(d.step).split('.')[1]||'').length;
  const upd=()=>{P[d.id]=+inp.value;out.textContent=(+inp.value).toFixed(dec).replace('.',',')+' '+d.unit};
  inp.addEventListener('input',()=>{upd();onChange(d.id)});upd();
  Sim.ctl[d.id]={inp,upd,span:r.querySelector('span'),lab:null};
 });
};

Sim.urlLoad = () => {
  const params = new URLSearchParams(location.search);
  Sim._loadingURL = true;

  try {
    // Restaura os controles
    Object.entries(Sim.ctl || {}).forEach(([id, ctl]) => {
      if (!params.has(id)) return;

      const inp = ctl.inp;
      const value = params.get(id);

      if (inp.type === 'checkbox') {
        inp.checked = value === '1';
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        inp.value = value;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Restaura o preset de gravidade
    const pl = document.getElementById('pl');

    if (pl && params.has('pl')) {
      pl.value = params.get('pl');
      pl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } finally {
    Sim._loadingURL = false;
  }
};

Sim.url = () => {
  const url = new URL(location.href);

  // Serializa os controles registrados
  Object.entries(Sim.ctl || {}).forEach(([id, ctl]) => {
    const inp = ctl.inp;

    url.searchParams.set(
      id,
      inp.type === 'checkbox'
        ? (inp.checked ? '1' : '0')
        : inp.value
    );
  });

  // Inclui o preset de gravidade
  const pl = document.getElementById('pl');

  if (pl) {
    url.searchParams.set('pl', pl.value);
  }

  return url.href;
};

// Adiciona um botão para copiar o link
Sim.urlButton = cv => {
  const b = Sim.iconButton(
    'link',
    'Copiar link da simulação',
    async () => {
      const url = Sim.url();

      try {
        await navigator.clipboard.writeText(url);

        b.innerHTML = Sim.icon('copyCheck');
        b.title = 'Link copiado!';
        b.setAttribute('aria-label', b.title);

        setTimeout(() => {
          b.innerHTML = Sim.icon('link');
          b.title = 'Copiar link da simulação';
          b.setAttribute('aria-label', b.title);
        }, 1500);
      } catch {
        prompt('Copie o link da simulação:', url);
      }
    }
  );

  Sim.bar(cv.parentElement).appendChild(b);
};

/** Muda os limites de um slider já criado (o navegador ajusta o valor se ele ficar fora).
    Devolve true se o valor mudou. Não chama onChange: quem chama deve reavaliar a cena. */
Sim.setRange=(id,min,max)=>{const c=Sim.ctl[id],old=c.inp.value;c.inp.min=min;c.inp.max=max;c.upd();return c.inp.value!==old};
/** Troca o rótulo (HTML ou LaTeX) de um slider, só se o texto mudou. */
Sim.setLabel=(id,html)=>{const c=Sim.ctl[id];if(c.lab===html)return;c.lab=html;c.span.innerHTML=html;Sim.math(c.span)};

/** Cria o painel de valores numéricos.
    @param itens  lista de [chave, rótulo], ex.: [['t','Tempo (s)'], ['x','x (m)']]
    @returns função set(chave, valor): número (formatado com Sim.f2) ou texto. */
Sim.readouts=(box,items)=>{
 items.forEach(([k,l])=>{const d=document.createElement('div');d.innerHTML='<small>'+l+'</small><b id="r_'+k+'">–</b>';box.appendChild(d)});
 return (k,v)=>{Sim.$('r_'+k).textContent=typeof v==='number'?Sim.f2(v):v};
};

/** Seta de (x,y) até (x+dx, y+dy), em px do canvas (y cresce para baixo!).
    col = cor CSS, w = espessura. Setas menores que 3 px não são desenhadas. */
Sim.arrow=(ctx,x,y,dx,dy,col,w)=>{
 const L=Math.hypot(dx,dy);if(L<3)return;
 ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=w||2;
 ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.stroke();
 const a=Math.atan2(dy,dx),h=Math.min(8,L*.4);
 ctx.beginPath();ctx.moveTo(x+dx,y+dy);ctx.lineTo(x+dx-h*Math.cos(a-.4),y+dy-h*Math.sin(a-.4));ctx.lineTo(x+dx-h*Math.cos(a+.4),y+dy-h*Math.sin(a+.4));ctx.closePath();ctx.fill();
};

/** Gráfico de séries temporais, com curva simulada (cheia) e curva de referência opcional (tracejada).
    new Sim.Plot(canvas, {title, series, mt})
      title   texto no topo (em canvas, sem LaTeX; para fórmulas, deixe '' e use um título em HTML)
      mt      (opcional) margem superior em px, padrão 24; use ~8 se título e legenda estiverem em HTML
      series  lista de {col, name, color}: col = índice da coluna em cada linha de dados,
              name = rótulo da legenda, color = NOME de variável CSS (ex.: '--acc')
    plot.draw(rows, ideal, tf, refs)
      rows    dados simulados: array de linhas [t, v1, v2, ...] em ordem crescente de t
      ideal   (opcional) função t => linha no mesmo formato de rows; desenhada tracejada.
              Passe null se não houver solução de referência.
      tf      duração prevista (s): define o fim do eixo x enquanto a simulação ainda não terminou
      refs    (opcional) lista de funções t => valor, desenhadas tracejadas (ex.: envoltórias); entram na escala
    Os eixos se ajustam sozinhos aos dados e à curva ideal. */
Sim.Plot=function(cv,o){
 // proporção altura/largura 0,72; altura limitada entre 150 e 260 px
 const fit=Sim.fit(cv,.72,150,260),ctx=cv.getContext('2d');
 this.draw=(rows,ideal,tf,refs)=>{
  // ml/mr/mt/mb = margens esquerda/direita/topo/base (px); aumente mt se a legenda ficar apertada
  const W=fit.w,H=fit.h,ml=42,mr=8,mt=o.mt==null?24:o.mt,mb=22,C=Sim.css;
  ctx.clearRect(0,0,W,H);
  tf=tf>1e-3?tf:1;
  const ip=[];if(ideal)for(let j=0;j<=60;j++)ip.push(ideal(tf*j/60));
  let tmax=Math.max(tf,rows.length?rows[rows.length-1][0]:0),lo=0,hi=0;
  const rp=(refs||[]).map(f=>{const a=[];for(let j=0;j<=120;j++){const tt=tmax*j/120;a.push([tt,f(tt)])}return a});   // curvas de referência (valor único por t)
  rp.forEach(a=>a.forEach(p=>{lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1])}));
  o.series.forEach(se=>ip.concat(rows).forEach(r=>{lo=Math.min(lo,r[se.col]);hi=Math.max(hi,r[se.col])}));
  if(hi-lo<1e-9)hi=lo+1;const pd=(hi-lo)*.06;hi+=pd;if(lo<0)lo-=pd;
  const X=t=>ml+t/tmax*(W-ml-mr),Y=v=>H-mb-(v-lo)/(hi-lo)*(H-mt-mb);
  ctx.font=C('--smallfont');ctx.lineWidth=1;
  const sx=Sim.nice(tmax/4),sy=Sim.nice((hi-lo)/4);
  for(let t=0;t<=tmax+1e-9;t+=sx){ctx.strokeStyle=C('--grid');ctx.beginPath();ctx.moveTo(X(t),mt);ctx.lineTo(X(t),H-mb);ctx.stroke();ctx.fillStyle=C('--mut');ctx.textAlign='center';ctx.fillText(+t.toFixed(4),X(t),H-mb+14)}
  for(let v=Math.ceil(lo/sy)*sy;v<=hi;v+=sy){ctx.strokeStyle=Math.abs(v)<1e-9?C('--ghost'):C('--grid');ctx.beginPath();ctx.moveTo(ml,Y(v));ctx.lineTo(W-mr,Y(v));ctx.stroke();ctx.fillStyle=C('--mut');ctx.textAlign='right';ctx.fillText(+v.toFixed(4),ml-5,Y(v)+4)}
  ctx.fillStyle=C('--ink');ctx.textAlign='left';ctx.font=C('--normalfont');ctx.fillText(o.title,ml,14);
  let lx=W-mr;ctx.font=C('--normalfont');ctx.textAlign='right';
  o.series.slice().reverse().forEach(se=>{ctx.fillStyle=C(se.color);ctx.fillText(se.name,lx,14);lx-=ctx.measureText(se.name).width+10});
  rp.forEach(a=>{ctx.setLineDash([5,4]);ctx.strokeStyle=C('--ghost');ctx.lineWidth=1.3;ctx.beginPath();a.forEach((p,j)=>j?ctx.lineTo(X(p[0]),Y(p[1])):ctx.moveTo(X(p[0]),Y(p[1])));ctx.stroke();ctx.setLineDash([])});
  o.series.forEach(se=>{
   if(ideal){ctx.setLineDash([5,4]);ctx.strokeStyle=C('--ghost');ctx.lineWidth=1.3;ctx.beginPath();ip.forEach((r,j)=>j?ctx.lineTo(X(r[0]),Y(r[se.col])):ctx.moveTo(X(r[0]),Y(r[se.col])));ctx.stroke();ctx.setLineDash([])}
   ctx.strokeStyle=C(se.color);ctx.lineWidth=2.2;ctx.beginPath();
   rows.forEach((r,j)=>j?ctx.lineTo(X(r[0]),Y(r[se.col])):ctx.moveTo(X(r[0]),Y(r[se.col])));ctx.stroke();
  });
 };
};
})(window);
