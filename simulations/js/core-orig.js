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
     new Sim.Plot(canvas, opções)          gráfico de séries temporais

   Convenção de unidades: SI (m, s, kg), ângulos em graus só na interface.
   ===================================================================== */
(function(g){
const Sim=g.Sim={};
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
// Sim.fit=(cv,ar,mn,mx)=>{
//  const o={w:300,h:200},p=cv.parentElement;
//  const r=()=>{const d=devicePixelRatio||1;o.w=p.clientWidth;o.h=Math.round(Math.max(mn,Math.min(o.w*ar,mx)));
//   cv.style.height=o.h+'px';cv.width=o.w*d;cv.height=o.h*d;cv.getContext('2d').setTransform(d,0,0,d,0,0)};
//  new ResizeObserver(r).observe(p);r();return o;
// };

Sim.fit = (cv, ar, mn, mx) => {
    const o = {w:300, h:200}, p = cv.parentElement;

    const r = () => {
        const d = devicePixelRatio || 1;
        o.w = p.clientWidth;

        const ratio = typeof ar === 'function' ? ar() : ar;
        o.h = Math.round(Math.max(mn, Math.min(o.w * ratio, mx)));

        cv.style.height = o.h + 'px';
        cv.width = o.w * d;
        cv.height = o.h * d;
        cv.getContext('2d').setTransform(d,0,0,d,0,0);
    };

    new ResizeObserver(r).observe(p);
    r();
    return o;
};

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
    plot.draw(rows, ideal, tf)
      rows    dados simulados: array de linhas [t, v1, v2, ...] em ordem crescente de t
      ideal   (opcional) função t => linha no mesmo formato de rows; desenhada tracejada.
              Passe null se não houver solução de referência.
      tf      duração prevista (s): define o fim do eixo x enquanto a simulação ainda não terminou
    Os eixos se ajustam sozinhos aos dados e à curva ideal. */
Sim.Plot=function(cv,o){
 // proporção altura/largura 0,72; altura limitada entre 150 e 260 px
 const fit=Sim.fit(cv,.72,150,260),ctx=cv.getContext('2d');
 this.draw=(rows,ideal,tf)=>{
  // ml/mr/mt/mb = margens esquerda/direita/topo/base (px); aumente mt se a legenda ficar apertada
  const W=fit.w,H=fit.h,ml=42,mr=8,mt=o.mt==null?24:o.mt,mb=22,C=Sim.css;
  ctx.clearRect(0,0,W,H);
  tf=tf>1e-3?tf:1;
  const ip=[];if(ideal)for(let j=0;j<=60;j++)ip.push(ideal(tf*j/60));
  let tmax=Math.max(tf,rows.length?rows[rows.length-1][0]:0),lo=0,hi=0;
  o.series.forEach(se=>ip.concat(rows).forEach(r=>{lo=Math.min(lo,r[se.col]);hi=Math.max(hi,r[se.col])}));
  if(hi-lo<1e-9)hi=lo+1;const pd=(hi-lo)*.06;hi+=pd;if(lo<0)lo-=pd;
  const X=t=>ml+t/tmax*(W-ml-mr),Y=v=>H-mb-(v-lo)/(hi-lo)*(H-mt-mb);
  ctx.font='11px';ctx.lineWidth=1;
  const sx=Sim.nice(tmax/4),sy=Sim.nice((hi-lo)/4);
  for(let t=0;t<=tmax+1e-9;t+=sx){ctx.strokeStyle=C('--grid');ctx.beginPath();ctx.moveTo(X(t),mt);ctx.lineTo(X(t),H-mb);ctx.stroke();ctx.fillStyle=C('--mut');ctx.textAlign='center';ctx.fillText(+t.toFixed(4),X(t),H-mb+14)}
  for(let v=Math.ceil(lo/sy)*sy;v<=hi;v+=sy){ctx.strokeStyle=Math.abs(v)<1e-9?C('--ghost'):C('--grid');ctx.beginPath();ctx.moveTo(ml,Y(v));ctx.lineTo(W-mr,Y(v));ctx.stroke();ctx.fillStyle=C('--mut');ctx.textAlign='right';ctx.fillText(+v.toFixed(4),ml-5,Y(v)+4)}
  ctx.fillStyle=C('--ink');ctx.textAlign='left';ctx.font='600 12px';ctx.fillText(o.title,ml,14);
  let lx=W-mr;ctx.font='11px';ctx.textAlign='right';
  o.series.slice().reverse().forEach(se=>{ctx.fillStyle=C(se.color);ctx.fillText(se.name,lx,14);lx-=ctx.measureText(se.name).width+10});
  o.series.forEach(se=>{
   if(ideal){ctx.setLineDash([5,4]);ctx.strokeStyle=C('--ghost');ctx.lineWidth=1.3;ctx.beginPath();ip.forEach((r,j)=>j?ctx.lineTo(X(r[0]),Y(r[se.col])):ctx.moveTo(X(r[0]),Y(r[se.col])));ctx.stroke();ctx.setLineDash([])}
   ctx.strokeStyle=C(se.color);ctx.lineWidth=2.2;ctx.beginPath();
   rows.forEach((r,j)=>j?ctx.lineTo(X(r[0]),Y(r[se.col])):ctx.moveTo(X(r[0]),Y(r[se.col])));ctx.stroke();
  });
 };
};
})(window);
