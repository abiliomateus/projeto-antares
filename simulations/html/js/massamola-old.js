/* =====================================================================
   massamola.js: bloco preso a uma mola, com e sem atrito. Depende de core.js.

   Organização: 1. Configuração · 2. Interface · 3. Física (setup, fricF, step) · 4. Controle ·
                5. step · 6. status · 7. draw · 8. Loop   (mesma estrutura dos outros arquivos)

   Modelo (1 dimensão): bloco de massa m sobre uma superfície horizontal, preso a uma mola de constante k.
   x = deslocamento em relação à posição de equilíbrio (x > 0 à direita). Estado: q = [x, v].
     Força elástica:  F_el = −k·x        Força gravitacional: F_g = m·g        Normal: N = F_g
     Sem atrito:  m·a = −k·x   →   x(t) = x0·cos(ω·t),  ω = √(k/m),  T = 2π/ω,  E = ½·m·v² + ½·k·x² = ½·k·x0².
     Atrito de Coulomb (opcional): em movimento, f = −sinal(v)·μc·N; em repouso, o bloco só se move se
       |k·x| > μe·N (atrito estático); senão fica parado, com f = −F_el. (μc é limitado a μe.)
       A amplitude diminui 2·μc·N/k a cada meia oscilação (cada meio período dura T/2, igual ao caso sem atrito)
       e o bloco para no primeiro ponto de retorno com |x| ≤ μe·N/k.
     Energia dissipada: Q = ∫ μc·N·|v| dt, e E + Q = E0 = ½·k·x0².
   Integração: RK4 de [x, v, Q] com passo fixo; quando v cruza zero (só com atrito) o bloco é parado ali e o
   atrito estático decide se ele continua parado ou volta a se mover.
   Modos: 'idle' (pré-visualização) | 'run' | 'end'. Motivo do fim (fim): 'parou' | 'tempo'.
   Linhas de dados dos gráficos: [t, x, v, Ec, Ep, E, Q, F_el, f].
   ===================================================================== */
(function(){
const {$,rk4,f2,arrow,css}=Sim, DT=1/1000, P={}, cv=$('cv'), ctx=cv.getContext('2d');
const fit=Sim.fit(cv,.5,340,500);
let q=[0,0],t=0,mode='idle',fim='',paused=false,rows=[],tr=[],acc=0,cnt=0,Q=0,lastSt='',su;

// ---- Parâmetros ajustáveis (valor em P.<id>) ----
// Os rótulos aceitam HTML e LaTeX (MathJax): \( ... \), escrito aqui como '\\( ... \\)'.
Sim.controls($('ctl'),[
 {id:'m',label:'Massa \\(m\\)',unit:'kg',min:.1,max:5,step:.1,val:1},
 {id:'k',label:'Constante elástica \\(k\\)',unit:'N/m',min:1,max:50,step:.5,val:10},
 {id:'x0',label:'Deslocamento inicial \\(x_m\\)',unit:'m',min:.1,max:2,step:.05,val:1},
 {id:'mus',label:'Atrito estático \\(\\mu_e\\) (se ligado)',unit:'',min:0,max:1,step:.01,val:.15},
 {id:'muk',label:'Atrito cinético \\(\\mu_c\\) (se ligado)',unit:'',min:0,max:1,step:.01,val:.1},
 {id:'g',label:'Gravidade \\(g\\)',unit:'m/s²',min:1,max:25,step:.1,val:9.8},
 {id:'spd',label:'Velocidade da animação',unit:'×',min:.1,max:2,step:.1,val:1}
],P,id=>{if(id!=='spd')reset()});
$('c_atr').addEventListener('change',reset);
$('pl').addEventListener('change',e=>{const i=$('g');i.value=e.target.value;i.dispatchEvent(new Event('input'))});
const out=Sim.readouts($('ro'),[['t','\\(t\\) (s)'],['x','\\(x\\) (m)'],['v','\\(v\\) (m/s)'],['Fel','\\(F_{el}\\) (N)'],['f','Atrito \\(f\\) (N)'],['Ec','\\(K\\) (J)'],['Ep','\\(U\\) (J)'],['Q','Dissipada \\(Q\\) (J)']]);

// ---- Gráficos (colunas: 1=x 2=v 3=Ec 4=Ep 5=E 6=Q 7=F_el 8=f) ----
// Título e legenda ficam em HTML (com MathJax) acima de cada canvas; as cores precisam coincidir com as de lá.
const plots=[
 new Sim.Plot($('p1'),{title:'',mt:8,series:[{col:1,name:'',color:'--acc'}]}),
 new Sim.Plot($('p2'),{title:'',mt:8,series:[{col:3,name:'',color:'--vx'},{col:4,name:'',color:'--vy'},{col:5,name:'',color:'--acc'},{col:6,name:'',color:'--a'}]}),
 new Sim.Plot($('p3'),{title:'',mt:8,series:[{col:7,name:'',color:'--acc'},{col:8,name:'',color:'--vx'}]})
];

// ---- Física ----
const useF=()=>$('c_atr').checked;
// Grandezas derivadas: ω, período T, energia E0, e os deslocamentos característicos do atrito de Coulomb:
// xm = μc·N/k (perda de amplitude por meia oscilação = 2·xm) e xs = μe·N/k (zona onde o bloco fica parado).
// L0 = comprimento natural desenhado da mola (só visual). μc é limitado a μe.
function setup(){
 const w=Math.sqrt(P.k/P.m),T=2*Math.PI/w,N=P.m*P.g,mk=Math.min(P.muk,P.mus);
 return{w,T,N,mk,ms:P.mus,E0:.5*P.k*P.x0*P.x0,xm:mk*N/P.k,xs:P.mus*N/P.k,L0:P.x0+.8,tEnd:Math.min(10*T,60)};
}
// Força de atrito ao longo de +x (N). Em movimento: cinética, contra v. Parado: estática (equilibra F_el) se
// |k·x| ≤ μe·N; senão cinética, contra o movimento que vai começar (que é para o equilíbrio).
function fricF(x,v){
 if(!useF())return 0;
 if(v!==0)return -Math.sign(v)*su.mk*su.N;
 return Math.abs(P.k*x)<=su.ms*su.N?P.k*x:Math.sign(x)*su.mk*su.N;
}
const row=()=>{const x=q[0],v=q[1],ec=.5*P.m*v*v,ep=.5*P.k*x*x;return[t,x,v,ec,ep,ec+ep,Q,-P.k*x,fricF(x,v)]};
const record=()=>{rows.push(row());tr.push(q[0])};

// ---- Controle ----
function reset(){su=setup();q=[P.x0,0];t=0;rows=[];tr=[];Q=0;fim='';acc=0;paused=false;mode='idle';$('bp').textContent='Pausar'}
function launch(){reset();mode='run';record()}
function end(){record();mode='end'}
$('bl').onclick=launch;
$('bp').onclick=()=>{if(mode!=='run')return;paused=!paused;$('bp').textContent=paused?'Continuar':'Pausar'};
$('bc').onclick=reset;

// Passos fixos de DT (RK4 de [x, v, Q]). Com atrito: (1) se v = 0 e |k·x| ≤ μe·N, o atrito estático segura o bloco
// e a simulação termina; (2) se v cruza zero no passo, avança só até o ponto de retorno (interpolado), para o bloco
// ali e devolve o resto do passo ao acumulador de tempo.
// EQUAÇÕES DO MOVIMENTO: m·a = −k·x + f, com f = ∓μc·N (em v = 0, ver fricF); para outro tipo de atrito
// ou força externa, altere a função de derivadas abaixo.
function step(dt){
 if(mode!=='run'||paused)return;
 acc+=dt*P.spd;
 while(acc>=DT){
  acc-=DT;
  const f0=useF(),mu=f0?su.mk*su.N:0;
  if(f0&&q[1]===0&&Math.abs(P.k*q[0])<=su.ms*su.N){fim='parou';end();return}
  const F=z=>[z[1],(-P.k*z[0]+(z[1]===0?Math.sign(z[0]):-Math.sign(z[1]))*mu)/P.m,mu*Math.abs(z[1])];
  let n=rk4(F,[q[0],q[1],0],DT),h=DT;
  if(f0&&q[1]!==0&&q[1]*n[1]<0){const h1=q[1]/(q[1]-n[1])*DT;n=rk4(F,[q[0],q[1],0],h1);n[1]=0;h=h1;acc+=DT-h1}   // para no ponto de retorno; o resto do passo é refeito
  Q+=n[2];q=[n[0],n[1]];t+=h;
  if(++cnt%2===0)record();
  if(t>=su.tEnd){fim='tempo';end();return}
 }
}

// Frase de situação mostrada sob o canvas (LaTeX; renderizada por MathJax quando o texto muda).
const M=x=>'\\('+x+'\\)',fm=Sim.fm,J='\\,\\mathrm{J}',MM='\\,\\mathrm{m}',MS='\\,\\mathrm{s}';
function status(){
 const last=rows.length?rows[rows.length-1]:null;
 if(mode==='end'&&last){
  if(fim==='parou'){
   if(last[0]<.01)return'Como '+M('kx_0\\le\\mu_e mg')+' ('+M(fm(P.k*P.x0)+'\\,\\mathrm{N}\\le'+fm(su.ms*su.N)+'\\,\\mathrm{N}')+'), o atrito estático segura o bloco: ele não se move.';
   return'O atrito estático segura o bloco em '+M('x='+fm(last[1])+MM)+' após '+M('t='+fm(last[0])+MS)+' ('+M('|x|\\le\\mu_e mg/k='+fm(su.xs)+MM)+'). Energia: '+M('E_0='+fm(su.E0)+J+'\\to '+fm(last[5])+J)+' (guardada na mola); dissipada: '+M('Q='+fm(last[6])+J)+'.';
  }
  return'Fim da simulação ('+M(fm(su.tEnd)+MS)+'). '+M('E='+fm(last[5])+J)+' e dissipada '+M('Q='+fm(last[6])+J)+(useF()?'.':': sem atrito, a energia mecânica se conserva e o bloco oscila indefinidamente.');
 }
 let s=M('\\omega=\\sqrt{k/m}='+fm(su.w)+'\\,\\mathrm{rad/s}')+', período '+M('T=2\\pi\\sqrt{m/k}='+fm(su.T)+MS)+', energia '+M('E_0=\\tfrac{1}{2}kx_0^2='+fm(su.E0)+J)+'. ';
 if(!useF())return s+'Sem atrito, '+M('E')+' é constante e '+M('x(t)=x_m\\cos\\omega t')+' (curva tracejada).';
 if(Math.abs(P.k*P.x0)<=su.ms*su.N)return s+'Como '+M('kx_m\\le\\mu_e mg')+', o atrito estático segura o bloco desde o início.';
 const nh=Math.max(1,Math.ceil((P.x0-su.xs)/(2*su.xm)));
 return s+'Com atrito de Coulomb, a amplitude diminui '+M('2\\mu_c mg/k='+fm(2*su.xm)+MM)+' a cada meia oscilação ('+M('T/2')+'), e o bloco para quando '+M('|x|\\le\\mu_e mg/k='+fm(su.xs)+MM)+': após cerca de '+nh+' meias oscilações ('+M('t\\approx '+fm(nh*su.T/2)+MS)+').';
}

// ---- Desenho ----
// Mundo em metros na horizontal (x = 0 no equilíbrio); y em pixels. A mola tem comprimento natural desenhado L0 = x0 + 0,8 m,
// e o bloco tem tamanho fixo em pixels. Forças: escala fixa (a maior entre F_g e k·x0 mede 70 px).
function draw(){
 const C=css,W=fit.w,H=fit.h,ml=30,mr=20,fy=Math.round(H*.62),bw=50,bh=50;
 const xmin=-0.75*su.L0,xmax=P.x0+.5,sc=(W-ml-mr)/(xmax-xmin),X=x=>ml+(x-xmin)*sc;
 const x=q[0],cx=X(x),cy=fy-bh/2;
 ctx.clearRect(0,0,W,H);
 const lab=(s,x,y,col,al)=>{ctx.fillStyle=col;ctx.font='600 12px system-ui,sans-serif';ctx.textAlign=al||'left';ctx.fillText(s,x,y)};
 // chão com régua (metros em relação ao equilíbrio) e parede
 ctx.strokeStyle=C('--ground');ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(X(xmin),fy);ctx.lineTo(W-mr,fy);ctx.stroke();
 const st=Sim.nice((xmax-xmin)/8);ctx.lineWidth=1;ctx.font='11px system-ui,sans-serif';ctx.fillStyle=C('--mut');ctx.strokeStyle=C('--mut');
 for(let g=Math.ceil((xmin+.3)/st)*st;g<=xmax;g+=st){ctx.beginPath();ctx.moveTo(X(g),fy+3);ctx.lineTo(X(g),fy+9);ctx.stroke();ctx.textAlign='center';ctx.fillText(+g.toFixed(6),X(g),fy+22)}
 lab('x (m)',W-mr,fy+36,C('--mut'),'right');
 ctx.strokeStyle=C('--ink');ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(X(xmin),fy-bh-26);ctx.lineTo(X(xmin),fy);ctx.stroke();
 // marcas: equilíbrio (x = 0) e posição inicial (x0), e zona de atrito estático (|x| ≤ xs)
 if($('c_ref').checked){
  ctx.setLineDash([5,4]);ctx.lineWidth=1.3;
  ctx.strokeStyle=C('--ink');ctx.beginPath();ctx.moveTo(X(0),fy-bh-40);ctx.lineTo(X(0),fy);ctx.stroke();lab('x = 0',X(0),fy-bh-46,C('--ink'),'center');
  ctx.strokeStyle=C('--ghost');ctx.beginPath();ctx.moveTo(X(P.x0),fy-bh-40);ctx.lineTo(X(P.x0),fy);ctx.stroke();lab('x_m',X(P.x0),fy-bh-46,C('--mut'),'center');
  ctx.setLineDash([]);
  if(useF()){ctx.fillStyle=C('--vx');ctx.globalAlpha=.18;ctx.fillRect(X(-su.xs),fy-5,X(su.xs)-X(-su.xs),5);ctx.globalAlpha=1;lab('|x| ≤ μₑmg/k',X(0),fy+50,C('--vx'),'center')}
 }
 // mola (zigue-zague) e bloco
//  const xl=X(xmin),xr=cx-bw/2;
//  ctx.strokeStyle=C('--ink');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(xl,cy);
//  for(let i=0;i<20;i++)ctx.lineTo(xl+(xr-xl)*((i+.5)/20),cy+(i%2?10:-10));
//  ctx.lineTo(xr,cy);ctx.stroke();
//  ctx.fillStyle=C('--card');ctx.strokeStyle=C('--ink');ctx.lineWidth=2;ctx.fillRect(cx-bw/2,fy-bh,bw,bh);ctx.strokeRect(cx-bw/2,fy-bh,bw,bh);
//  lab('m',cx,cy+4,C('--ink'),'center');

const xl = X(xmin), xr = cx - bw / 2;
const L = xr - xl;
const R = 16;
const n = 8;
const e = Math.min(20, L * 0.1); // comprimento das extremidades

const xa = xl + e, xb = xr - e;
const Lm = xb - xa;

ctx.strokeStyle = C('--ink');
ctx.lineWidth = 3;
ctx.lineCap = 'round';
ctx.beginPath();

// Trecho reto junto à parede
ctx.moveTo(xl, cy);
ctx.lineTo(xa, cy);

// Espiras da mola
for (let i = 0; i <= 240; i++) {
  const t = i / 240;
  const x = xa + Lm * t;
  const y = cy - R * Math.sin(2 * Math.PI * n * t);
  ctx.lineTo(x, y);
}

// Trecho reto junto ao bloco
ctx.lineTo(xr, cy);
ctx.stroke();

// const xl = X(xmin), xr = cx - bw / 2;
// const L = xr - xl;
// const A = 20;
// const n = 30;

// ctx.strokeStyle = C('--ink');
// ctx.lineWidth = 2;
// ctx.beginPath();
// ctx.moveTo(xl, cy);
// ctx.lineTo(xl + L * 0.08, cy);

// for (let i = 0; i < n; i++) {
//   const x0 = xl + L * (0.08 + 0.84 * i / n);
//   const x1 = xl + L * (0.08 + 0.84 * (i + 1) / n);
//   const xm = (x0 + x1) / 2;
//   const a = i % 2 ? -A : A;

//   ctx.quadraticCurveTo(xm, cy + a, x1, cy);
// }

// ctx.lineTo(xr, cy);
// ctx.stroke();

// Bloco
ctx.fillStyle = C('--ink');
ctx.strokeStyle = C('--ink');
ctx.lineWidth = 2;
ctx.fillRect(cx - bw / 2, fy - bh, bw, bh);
ctx.strokeRect(cx - bw / 2, fy - bh, bw, bh);

lab('m', cx, cy + 4, C('--card'), 'center');


 // forças
 const Fg=P.m*P.g,Fel=-P.k*x,fr=fricF(q[0],q[1]),k=70/Math.max(Fg,P.k*P.x0);
 const Fv=(l,v,ox,oy,wx,wy,col)=>{const dx=wx*k,dy=-wy*k,L=Math.hypot(dx,dy);if(L<3)return;
  arrow(ctx,ox,oy,dx,dy,col,2.6);lab(l+'='+f2(Math.abs(v))+' N',ox+dx+dx/L*8,oy+dy+dy/L*12+(Math.abs(dy/L)<.3?4:0),col,dx/L>.3?'left':dx/L<-.3?'right':'center')};
 if($('c_f').checked){
  Fv('F_g',Fg,cx+10,cy,0,-Fg,C('--a'));
  Fv('N',Fg,cx-10,cy,0,Fg,C('--vy'));
  Fv('F_el',Fel,cx,fy-bh-8,Fel,0,C('--acc'));
  Fv('f',fr,cx,fy,fr,0,C('--vx'));
 }
 // barras de energia: Ep, Ec e Q como fração de E0 (a soma é sempre E0)
 if($('c_bar').checked){
  const ec=.5*P.m*q[1]*q[1],ep=.5*P.k*x*x,bwid=200,bx0=W-mr-bwid,by0=8;let xx=bx0;
  [[ep,C('--vy'),'U'],[ec,C('--vx'),'K'],[Q,C('--a'),'Q']].forEach(([v,col,nm],j)=>{const w=Math.max(0,Math.min(bwid-(xx-bx0),v/su.E0*bwid));ctx.fillStyle=col;ctx.fillRect(xx,by0,w,12);xx+=w;lab(nm,bx0+j*46,by0+28,col)});
  ctx.strokeStyle=C('--line');ctx.lineWidth=1;ctx.strokeRect(bx0,by0,bwid,12);lab('E₀ = '+f2(su.E0)+' J',bx0+bwid,by0+28,C('--mut'),'right');
 }
 // leituras, texto e gráficos
 const r=row();
 out('t',t);out('x',x);out('v',q[1]);out('Fel',Fel);out('f',fr);out('Ec',r[3]);out('Ep',r[4]);out('Q',Q);
 {const s=status();if(s!==lastSt){lastSt=s;$('cmp').textContent=s;Sim.math($('cmp'))}}   // só re-renderiza quando o texto muda
 const tf=Math.min(4*su.T,su.tEnd);
 plots[0].draw(rows,tt=>[tt,P.x0*Math.cos(su.w*tt),0,0,0,0,0,0,0],tf);plots[1].draw(rows,null,tf);plots[2].draw(rows,null,tf);
}
reset();
Sim.loop(dt=>{step(dt);draw()});
})();
