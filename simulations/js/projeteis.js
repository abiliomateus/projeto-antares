/* =====================================================================
   projeteis.js: simulação de lançamento oblíquo. Depende de core.js.

   Organização do arquivo (de cima para baixo):
     1. Configuração   canvas, margens, variáveis de estado
     2. Interface      sliders (parâmetros), leituras, gráficos
     3. Física         ideal() = solução analítica; deriv() = equações com arrasto
     4. Controle       reset(), launch(), botões
     5. step(dt)       avança a simulação em passos fixos
     6. draw()         desenha tudo, a cada quadro
     7. Loop           liga step e draw ao relógio

   Fluxo: os sliders escrevem em P → reset() volta ao modo 'idle' (pré-visualização)
   → 'Lançar' chama launch() → modo 'fly' → ao tocar o chão vira 'land'.

   Estado do projétil: array q = [x, y, vx, vy] (m e m/s), guardado em `s`.
   Linhas de dados dos gráficos: [t, x, y, |v|, vx, vy] (ver row()).
   ===================================================================== */
(function(){
const {$,rk4,f2,arrow,css}=Sim, DT=1/500, P={}, cv=$('cv'), ctx=cv.getContext('2d');
// Tela principal: proporção 0,58, altura entre 260 e 520 px.
// ml/mr/mt/mb = margens (px) reservadas aos números dos eixos.
// const fit=Sim.fit(cv,.58,260,520), ml=46,mr=16,mt=16,mb=32;

let s=null,t=0,mode='idle',paused=false,trail=[],past=[],rows=[],ymax=0,range=null,view={w:10,h:5},acc=0,cnt=0;

const fit = Sim.fit(cv, .35, 220, 420),
      ml = 46, mr = 16, mt = 16, mb = 32;

Sim.interactive(cv,fit);
Sim.playbar(cv,()=>mode==='fly'?'run':mode==='land'?'end':mode,()=>paused);   // ▶/⏸ e reiniciar sobre o canvas (ver core.js)

// ---- Estado da simulação ----
// s: [x,y,vx,vy] atual | t: tempo simulado (s) | mode: 'idle' | 'fly' | 'land'
// trail: pontos [x,y] do lançamento atual | past: lançamentos anteriores (máx. 5)
// rows: dados dos gráficos | ymax: altura máxima atingida | range: alcance (null até pousar)
// view: tamanho do mundo visível em metros {w,h} | acc: acumulador de tempo do passo fixo
// ---- Parâmetros ajustáveis ----
// Para adicionar um parâmetro: inclua uma linha aqui (o valor aparece em P.<id>) e use P.<id> na física.
// Para mudar valor inicial ou limites de um slider: edite val, min, max e step.
Sim.controls($('ctl'),[
 {id:'m',label:'Massa do projétil',unit:'kg',min:0.1,max:5,step:.01,val:0.450},
 {id:'v0',label:'Velocidade inicial',unit:'m/s',min:1,max:60,step:.5,val:25},
 {id:'ang',label:'Ângulo de lançamento',unit:'°',min:0,max:90,step:1,val:30},
 {id:'h0',label:'Altura inicial',unit:'m',min:0,max:50,step:.5,val:0},
 {id:'g',label:'Gravidade',unit:'m/s²',min:1,max:25,step:.1,val:9.8},
 {id:'k',label:'Coeficiente de arrasto (quadrático) b',unit:'kg/m',min:0,max:.1,step:.0001,val:0.01164156},
 {id:'spd',label:'Velocidade da animação',unit:'×',min:.1,max:2,step:.1,val:1}
],P,id=>{if(id!=='spd')reset()});
$('pl').addEventListener('change',e=>{const i=$('g');i.value=e.target.value;i.dispatchEvent(new Event('input'))});
const out=Sim.readouts($('ro'),[['t','Tempo (s)'],['x','x (m)'],['y','y (m)'],['sp','|v| (m/s)'],['vx','vₓ (m/s)'],['vy','v_y (m/s)'],['ym','Altura máx. (m)'],['R','Alcance (m)']]);

// ---- Gráficos ----
// Colunas de cada linha de dados: [t, x, y, |v|, vx, vy]  (índices 0 a 5).
// Para um novo gráfico: crie um <canvas id="p4"> no HTML (dentro de .plots) e adicione aqui um
// new Sim.Plot($('p4'), {...}) com a coluna desejada; se a coluna for nova, acrescente-a em row() e em id().
const plots=[
 new Sim.Plot($('p1'),{title:'x(t) em m',series:[{col:1,name:'x',color:'--vx'}]}),
 new Sim.Plot($('p2'),{title:'y(t) em m',series:[{col:2,name:'y',color:'--vy'}]}),
 new Sim.Plot($('p3'),{title:'v(t) em m/s',series:[{col:3,name:'|v|',color:'--acc'},{col:4,name:'vₓ',color:'--vx'},{col:5,name:'v_y',color:'--vy'}]})
];

// Solução analítica SEM arrasto: velocidades iniciais, tempo de voo tf, alcance R e altura máxima ym.
// Serve de referência (tracejada) e para dimensionar a janela de visualização.
function ideal(){const a=P.ang*Math.PI/180,vx=P.v0*Math.cos(a),vy=P.v0*Math.sin(a),tf=(vy+Math.sqrt(vy*vy+2*P.g*P.h0))/P.g;return{vx,vy,tf,R:vx*tf,ym:P.h0+vy*vy/(2*P.g)}}
// Janela de visualização em metros, com folga de 8% (largura) e 25% (altura) sobre a trajetória ideal.
// Com arrasto a trajetória real fica sempre dentro dela.
// const mkView=i=>({w:Math.max(i.R*1.08,5),h:Math.max(i.ym*1.08,3)});

const mkView = i => ({
    w: Math.max(i.R * 1.08, 1),
    h: Math.max(i.ym * 1.08, 1)
});

// EQUAÇÕES DO MOVIMENTO: devolve [dx/dt, dy/dt, dvx/dt, dvy/dt] para o estado q.
// É aqui que se muda a física: vento (some uma velocidade do ar a vx e vy no cálculo do arrasto),
// força de Magnus (bola com efeito), gravidade variável com a altura, etc.
// Arrasto quadrático: a = -k·|v|·v, com k = (coeficiente de arrasto)/(massa), em 1/m.
const deriv=q=>{const sp=Math.hypot(q[2],q[3]);return[q[2],q[3],-(P.k/P.m)*sp*q[2],-P.g-(P.k/P.m)*sp*q[3]]};
// Linha de dados do instante atual, no formato dos gráficos.
const row=()=>[t,s[0],s[1],Math.hypot(s[2],s[3]),s[2],s[3]];
// Volta ao modo de pré-visualização (chamada a cada mudança de slider). Não apaga `past`.
function reset(){mode='idle';s=null;t=0;trail=[];rows=[];ymax=P.h0;range=null;acc=0;paused=false;$('bp').textContent='Pausar';$('cmp').textContent=''}
// Inicia um lançamento: estado inicial a partir de v0, ângulo e h0; fixa a janela de visualização.
function launch(){const i=ideal();s=[0,P.h0,i.vx,i.vy];t=0;trail=[[0,P.h0]];rows=[row()];ymax=P.h0;range=null;mode='fly';paused=false;acc=0;$('bp').textContent='Pausar';$('cmp').textContent='';view=mkView(i)}
$('bl').onclick=launch;
$('bp').onclick=()=>{if(mode!=='fly')return;paused=!paused;$('bp').textContent=paused?'Continuar':'Pausar'};
$('bc').onclick=()=>{past=[];reset()};

// Avança a simulação. O tempo real (dt × velocidade da animação) vai para um acumulador e é
// consumido em passos FIXOS de DT = 1/240 s: o resultado não depende da taxa de quadros.
// Para mais precisão, diminua DT (custa mais processamento).
// Ao cruzar y = 0, interpola linearmente o ponto de pouso para não errar o alcance em até um passo.
// Para outra condição de parada (ex.: bater numa parede), altere o teste `n[1]<0`.
function step(dt){
 if(mode!=='fly'||paused)return;
 acc+=dt*P.spd;
 while(acc>=DT){
  acc-=DT;
  const n=rk4(deriv,s,DT);
  if(n[1]<0){
   const f=s[1]/(s[1]-n[1]);
   s=[s[0]+f*(n[0]-s[0]),0,s[2]+f*(n[2]-s[2]),s[3]+f*(n[3]-s[3])];
   t+=f*DT;trail.push([s[0],0]);rows.push(row());range=s[0];mode='land';
   past.push(trail);if(past.length>5)past.shift();
   const i=ideal(),df=i.R>0?(range-i.R)/i.R*100:0;
   $('cmp').textContent='Alcance simulado: '+f2(range)+' m. Sem arrasto seria '+f2(i.R)+' m ('+(df>=0?'+':'−')+Math.abs(df).toFixed(1).replace('.',',')+'%).';
   return;
  }
  s=n;t+=DT;if(s[1]>ymax)ymax=s[1];
  if(++cnt%2===0){trail.push([s[0],s[1]]);rows.push(row())}
 }
}

// Desenha um quadro. Ordem das camadas (de baixo para cima):
// grade e eixos → chão/plataforma → parábola ideal → rastros → canhão (só em 'idle')
// → vetores → bola → leituras numéricas → gráficos.
// Conversões de unidade: X(x) e Y(y) transformam metros em pixels (y é invertido).
function draw(){
 const C=css,CW=fit.w,CH=fit.h,i=ideal();
 if(mode==='idle')view=mkView(i);
//  const sc=Math.min((CW-ml-mr)/view.w,(CH-mt-mb)/view.h),X=x=>ml+x*sc,Y=y=>CH-mb-y*sc;
 const sc = Math.min(
    (CW - ml - mr) / view.w,
    (CH - mt - mb) / view.h
);
  const X = x => ml + x * sc;
  const Y = y => CH - mb - y * sc;
 ctx.clearRect(0,0,CW,CH);
 const vw=(CW-ml-mr)/sc,vh=(CH-mt-mb)/sc,st=Sim.nice(Math.max(vw,vh)/8);
 ctx.font=C('--normalfont');ctx.lineWidth=1;
 for(let x=0;x<=vw;x+=st){ctx.strokeStyle=C('--grid');ctx.beginPath();ctx.moveTo(X(x),mt);ctx.lineTo(X(x),Y(0));ctx.stroke();ctx.fillStyle=C('--mut');ctx.textAlign='center';ctx.fillText(+x.toFixed(6),X(x),CH-mb+15)}
 for(let y=0;y<=vh;y+=st){ctx.strokeStyle=C('--grid');ctx.beginPath();ctx.moveTo(ml,Y(y));ctx.lineTo(CW-mr,Y(y));ctx.stroke();ctx.fillStyle=C('--mut');ctx.textAlign='right';ctx.fillText(+y.toFixed(6),ml-6,Y(y)+4)}
 ctx.fillStyle=C('--ground');ctx.fillRect(ml,Y(0),CW-ml-mr,4);
 if(P.h0>0)ctx.fillRect(X(0)-9,Y(P.h0)+6,9,Y(0)-Y(P.h0)-6);
 if($('cv_i').checked){
  ctx.setLineDash([6,5]);ctx.strokeStyle=C('--ghost');ctx.lineWidth=1.5;ctx.beginPath();
  for(let j=0;j<=120;j++){const tt=i.tf*j/120,px=X(i.vx*tt),py=Y(P.h0+i.vy*tt-.5*P.g*tt*tt);j?ctx.lineTo(px,py):ctx.moveTo(px,py)}
  ctx.stroke();ctx.setLineDash([]);
 }
 if($('cv_t').checked){
  const old=mode==='land'?past.slice(0,-1):past;
  ctx.lineWidth=1.5;ctx.strokeStyle=C('--acc');ctx.globalAlpha=.25;
  old.forEach(tr=>{ctx.beginPath();tr.forEach((p,j)=>j?ctx.lineTo(X(p[0]),Y(p[1])):ctx.moveTo(X(p[0]),Y(p[1])));ctx.stroke()});
  ctx.globalAlpha=1;ctx.lineWidth=2.5;ctx.beginPath();
  trail.forEach((p,j)=>j?ctx.lineTo(X(p[0]),Y(p[1])):ctx.moveTo(X(p[0]),Y(p[1])));
  if(mode==='fly')ctx.lineTo(X(s[0]),Y(s[1]));
  ctx.stroke();
 }
 const q=s||[0,P.h0,i.vx,i.vy],bx=X(q[0]),by=Y(q[1]);
 if(mode==='idle'){const a=P.ang*Math.PI/180;ctx.strokeStyle=C('--ink');ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+30*Math.cos(a),by-30*Math.sin(a));ctx.stroke();ctx.lineCap='butt'}
 if($('cv_v').checked){const vs=70/Math.max(P.v0,1);arrow(ctx,bx,by,q[2]*vs,0,C('--vx'));arrow(ctx,bx,by,0,-q[3]*vs,C('--vy'));arrow(ctx,bx,by,q[2]*vs,-q[3]*vs,C('--acc'),2.5)}
 if($('cv_a').checked){const d=deriv(q),as=40/P.g;arrow(ctx,bx,by,d[2]*as,-d[3]*as,C('--a'),2.5)}
 ctx.fillStyle=C('--ink');ctx.beginPath();ctx.arc(bx,by,6,0,7);ctx.fill();
 out('t',t);out('x',q[0]);out('y',q[1]);out('sp',Math.hypot(q[2],q[3]));out('vx',q[2]);out('vy',q[3]);out('ym',ymax);
 out('R',range===null?'–':range);
 const id=tt=>{const vy=i.vy-P.g*tt;return[tt,i.vx*tt,P.h0+i.vy*tt-.5*P.g*tt*tt,Math.hypot(i.vx,vy),i.vx,vy]};
 plots.forEach(p=>p.draw(rows,id,i.tf));
}
reset();
// Liga tudo ao relógio: a cada quadro, avança a física e redesenha.
Sim.loop(dt=>{step(dt);draw()});
})();
