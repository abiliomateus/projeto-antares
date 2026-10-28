/* =====================================================================
   massamola.js: oscilador massa-mola com arrasto proporcional à velocidade (amortecimento viscoso).
   Depende de core.js.

   Organização: 1. Configuração · 2. Interface · 3. Física (setup, step) · 4. Controle ·
                5. step · 6. status · 7. draw (mola, amortecedor, retrato de fase) · 8. Loop

   Modelo (1 dimensão): bloco de massa m sobre uma superfície horizontal sem atrito de contato, preso a uma mola de
   constante k e a um amortecedor (êmbolo num fluido). x = deslocamento em relação ao equilíbrio (x > 0 à direita).
   Estado: q = [x, v].
     Força elástica:  F_el = −k·x      Arrasto:  F_d = −b·v      Gravitacional: F_g = m·g      Normal: N = F_g
     Equação:  m·x'' = −k·x − b·x'   ⇔   x'' + 2γ·x' + ω0²·x = 0,   γ = b/(2m),  ω0 = √(k/m),  ζ = b/(2·√(k·m))
     Soltando do repouso em x0:
       subamortecido (ζ < 1):  x = x0·e^(−γt)·[cos(ωd·t) + (γ/ωd)·sen(ωd·t)],  ωd = √(ω0² − γ²)   (envoltória ±x0·e^(−γt))
       crítico (ζ = 1):        x = x0·(1 + γt)·e^(−γt)
       superamortecido (ζ > 1): x = x0·(s2·e^(s1·t) − s1·e^(s2·t))/(s2 − s1),  s1,2 = −γ ± √(γ² − ω0²)
     Energia: E = ½·m·v² + ½·k·x²,  dE/dt = −b·v²,  Q = ∫ b·v² dt (dissipada), E + Q = E0 = ½·k·x0².
   A caixa "Com arrasto" liga e desliga o amortecedor (b = 0). O seletor de regime ajusta b para ζ = 0,2, 1 ou 2.
   Integração: RK4 de [x, v, Q] com passo fixo.
   Modos: 'idle' (pré-visualização) | 'run' | 'end'.
   Linhas de dados dos gráficos: [t, x, v, Ec, Ep, E, Q, F_el, F_d].
   ===================================================================== */
(function(){
const {$,rk4,f2,arrow,css}=Sim, DT=1/5000, P={}, cv=$('cv'), ctx=cv.getContext('2d'), pcv=$('p4'), pctx=pcv.getContext('2d');
const fit=Sim.fit(cv,.5,340,500), fph=Sim.fit(pcv,.8,260,380);
let q=[0,0],t=0,mode='idle',paused=false,rows=[],acc=0,cnt=0,Q=0,lastSt='',su;

Sim.interactive(cv,fit);
Sim.playbar(cv,()=>mode==='fly'?'run':mode==='land'?'end':mode,()=>paused);   // ▶/⏸ e reiniciar sobre o canvas (ver core.js)

// ---- Parâmetros ajustáveis (valor em P.<id>) ----
// Os rótulos aceitam HTML e LaTeX (MathJax): \( ... \), escrito aqui como '\\( ... \\)'.
// spd e nesp (espiras do desenho da mola) não alteram a física; qualquer outro parâmetro reinicia a simulação.
Sim.controls($('ctl'),[
 {id:'m',label:'Massa \\(m\\)',unit:'kg',min:.1,max:5,step:.1,val:1},
 {id:'k',label:'Constante elástica \\(k\\)',unit:'N/m',min:1,max:50,step:.5,val:10},
 {id:'x0',label:'Deslocamento inicial \\(x_m\\)',unit:'m',min:.1,max:2,step:.05,val:1},
 {id:'b',label:'Coeficiente de arrasto \\(b\\) (se ligado)',unit:'N·s/m',min:0,max:60,step:.01,val:1},
 {id:'g',label:'Gravidade \\(g\\)',unit:'m/s²',min:1,max:25,step:.1,val:9.8},
 {id:'nesp',label:'Espiras da mola (só o desenho)',unit:'',min:4,max:24,step:1,val:16},
 {id:'spd',label:'Velocidade da animação',unit:'×',min:.1,max:2,step:.05,val:1}
],P,id=>{if(id==='spd'||id==='nesp')return;$('reg').value='';reset()});
$('c_arr').addEventListener('change',reset);
// Regime: ajusta b para ζ = 0,2 (sub), 1 (crítico) ou 2 (super), com o k e o m atuais: b = 2·ζ·√(k·m).
$('reg').addEventListener('change',e=>{
 const sel=e.target.value,z={sub:.2,crit:1,super:2}[sel];if(!z)return;
 const i=$('b');i.value=Math.min(60,2*z*Math.sqrt(P.k*P.m));i.dispatchEvent(new Event('input'));$('reg').value=sel;
});
$('pl').addEventListener('change',e=>{const i=$('g');i.value=e.target.value;i.dispatchEvent(new Event('input'))});
const out=Sim.readouts($('ro'),[['t','\\(t\\) (s)'],['x','\\(x\\) (m)'],['v','\\(v\\) (m/s)'],['Fel','\\(F_{el}\\) (N)'],['Fd','\\(F_d\\) (N)'],['Ec','\\(K\\) (J)'],['Ep','\\(U\\) (J)'],['Q','Dissipada \\(Q\\) (J)']]);

Sim.panel(cv, $('ctl'));
Sim.panel(cv, $('book'), { type: 'book' });

// ---- Gráficos (colunas: 1=x 2=v 3=Ec 4=Ep 5=E 6=Q 7=F_el 8=F_d) ----
// Título e legenda ficam em HTML (com MathJax) acima de cada canvas; as cores precisam coincidir com as de lá.
const plots=[
 new Sim.Plot($('p1'),{title:'',mt:8,series:[{col:1,name:'',color:'--acc'}]}),
 new Sim.Plot($('p2'),{title:'',mt:8,series:[{col:3,name:'',color:'--vx'},{col:4,name:'',color:'--vy'},{col:5,name:'',color:'--acc'},{col:6,name:'',color:'--a'}]}),
 new Sim.Plot($('p3'),{title:'',mt:8,series:[{col:7,name:'',color:'--acc'},{col:8,name:'',color:'--vx'}]})
];

// ---- Física ----
const useD=()=>$('c_arr').checked;
// Grandezas derivadas: ω0, T0, γ, ζ, regime ('sem' | 'sub' | 'crit' | 'super'), ωd (subamortecido), taxa de decaimento
// mais lenta λ (γ no sub e no crítico; γ − √(γ² − ω0²) no super), energia E0 e duração da simulação (tEnd).
// L0 = comprimento natural desenhado da mola (só visual).
function setup(){
 const w0=Math.sqrt(P.k/P.m),T0=2*Math.PI/w0,b=useD()?P.b:0,gam=b/(2*P.m),zeta=b/(2*Math.sqrt(P.k*P.m));
 const reg=b<=0?'sem':zeta<.99?'sub':zeta<=1.01?'crit':'super';
 const wd=reg==='sub'?Math.sqrt(w0*w0-gam*gam):0,lam=reg==='super'?gam-Math.sqrt(gam*gam-w0*w0):gam;
 return{w0,T0,b,gam,zeta,reg,wd,lam,E0:.5*P.k*P.x0*P.x0,L0:P.x0+.8,tEnd:Math.max(2,Math.min(60,10*T0,b>0?6/lam:Infinity))};
}
const row=()=>{const x=q[0],v=q[1],ec=.5*P.m*v*v,ep=.5*P.k*x*x;return[t,x,v,ec,ep,ec+ep,Q,-P.k*x,-su.b*v]};
const record=()=>rows.push(row());

// ---- Controle ----
function reset(){su=setup();q=[P.x0,0];t=0;rows=[];Q=0;acc=0;paused=false;mode='idle';$('bp').textContent='Pausar'}
function launch(){reset();mode='run';record()}
function end(){record();mode='end'}
$('bl').onclick=launch;
$('bp').onclick=()=>{if(mode!=='run')return;paused=!paused;$('bp').textContent=paused?'Continuar':'Pausar'};
$('bc').onclick=reset;

// Passos fixos de DT (RK4 de [x, v, Q]).
// EQUAÇÕES DO MOVIMENTO: m·x'' = −k·x − b·x', e dQ/dt = b·v². Para outro tipo de amortecimento (arrasto quadrático
// −c·|v|·v, atrito seco) ou uma força externa, altere a função de derivadas abaixo.
function step(dt){
 if(mode!=='run'||paused)return;
 acc+=dt*P.spd;
 while(acc>=DT){
  acc-=DT;
  const n=rk4(z=>[z[1],(-P.k*z[0]-su.b*z[1])/P.m,su.b*z[1]*z[1]],[q[0],q[1],0],DT);
  Q+=n[2];q=[n[0],n[1]];t+=DT;
  if(++cnt%2===0)record();
  if(t>=su.tEnd){end();return}
 }
}

// Frase de situação mostrada sob o canvas (LaTeX; renderizada por MathJax quando o texto muda).
const M=x=>'\\('+x+'\\)',fm=Sim.fm,J='\\,\\mathrm{J}',MS='\\,\\mathrm{s}',IS='\\,\\mathrm{s^{-1}}';
function status(){
 const last=rows.length?rows[rows.length-1]:null;
 if(mode==='end'&&last)return'Fim da simulação ('+M(fm(su.tEnd)+MS)+'). '+M('E='+fm(last[5])+J)+' e dissipada '+M('Q='+fm(last[6])+J)+
  (su.b>0?' ('+M('E+Q=E_0')+': a energia que sai da mola e do bloco vira calor no amortecedor).':': sem arrasto, a energia mecânica se conserva e o bloco oscila indefinidamente.');
 let s=M('\\omega_0=\\sqrt{k/m}='+fm(su.w0)+'\\,\\mathrm{rad/s}')+', '+M('T_0=2\\pi/\\omega_0='+fm(su.T0)+MS)+', '+M('E_0=\\tfrac{1}{2}kx_m^2='+fm(su.E0)+J)+'. ';
 if(su.reg==='sem')return s+'Sem arrasto, '+M('E')+' é constante e '+M('x(t)=x_m\\cos\\omega_0 t')+'.';
 s+='Com arrasto '+M('F_d=-bv')+': '+M('\\gamma=b/2m='+fm(su.gam)+IS)+' e '+M('\\zeta=b/(2\\sqrt{km})='+fm(su.zeta))+'. ';
 if(su.reg==='sub')return s+'Subamortecido ('+M('\\zeta<1')+'): oscila com '+M('\\omega_d=\\sqrt{\\omega_0^2-\\gamma^2}='+fm(su.wd)+'\\,\\mathrm{rad/s}')+' e amplitude '+M('x_me^{-\\gamma t}')+' (tracejado); tempo de decaimento '+M('\\tau=1/\\gamma='+fm(1/su.gam)+MS)+'.';
 if(su.reg==='crit')return s+'Criticamente amortecido ('+M('\\zeta=1')+'): volta ao equilíbrio no menor tempo possível, sem oscilar: '+M('x=x_m(1+\\gamma t)e^{-\\gamma t}')+'.';
 return s+'Superamortecido ('+M('\\zeta>1')+'): volta ao equilíbrio sem oscilar, mais devagar que no caso crítico; a taxa de decaimento lenta é '+M('\\lambda=\\gamma-\\sqrt{\\gamma^2-\\omega_0^2}='+fm(su.lam)+IS)+'.';
}

// ---- Desenho ----
// Desenho da mola entre a parede (xa) e a face esquerda do bloco (xb), na altura cy (pixels). Estilo escolhido em
// <select id="mola">: 'helice' (espiras com profundidade), 'seno' (senóide) ou 'zigue' (zigue-zague).
// Todos têm trechos retos nas pontas e n espiras. O raio R do desenho cresce um pouco quando a mola é comprimida
// (lnat = comprimento natural em pixels), e o passo das espiras acompanha o comprimento: juntas na compressão,
// separadas na extensão. Para um novo estilo, acrescente uma <option> no HTML e um ramo aqui.
// HÉLICE: é a projeção de uma hélice vista com a câmera um pouco girada. Cada espira é uma elipse (deslocamento
// horizontal em quadratura com a altura) levada adiante pelo passo p:
//     x = a + p·(θ + π/2)/2π + e·(sen θ + 1),   y = R·cos θ,   θ de −π/2 a −π/2 + 2π·n   (e = 0,8·R)
// A profundidade é z = sen θ: a parte da frente (z ≥ 0) é desenhada em traço forte e a de trás (z < 0) em traço
// mais fino e mais claro. Se o deslocamento e e a altura variassem em fase, sairia só uma senóide inclinada.
function spring(xa,xb,cy,lnat,n){
 const len=Math.max(xb-xa,4),lead=Math.min(25,len*.2),a=xa+lead,b=xa+len-lead,R=Math.max(8,Math.min(16,11*Math.sqrt(lnat/len)));
 ctx.lineJoin='round';ctx.lineCap='round';
//  if(estilo==='helice'){
  const m=40*n,p=(b-a)/n,e=1.*R,pts=[];
  for(let i=0;i<=m;i++){const th=-Math.PI/2+2*Math.PI*n*i/m;pts.push([a+p*(th+Math.PI/2)/(2*Math.PI)+e*(Math.sin(th)+1),cy-R*Math.cos(th),Math.sin(th)])}
  [[false,2,.8],[true,2.,1]].forEach(([frente,lw,al])=>{          // primeiro o fundo, depois a frente
   ctx.lineWidth=lw;ctx.globalAlpha=al;ctx.beginPath();let ult=-2;
   for(let i=0;i<m;i++){if((pts[i][2]+pts[i+1][2]>=0)!==frente)continue;if(ult!==i-1)ctx.moveTo(pts[i][0],pts[i][1]);ctx.lineTo(pts[i+1][0],pts[i+1][1]);ult=i}
   ctx.stroke()});
  ctx.globalAlpha=1;ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(xa,cy);ctx.lineTo(a,cy);ctx.moveTo(b,cy);ctx.lineTo(xa+len,cy);ctx.stroke();
  return;
//  }
//  ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(xa,cy);
//  if(estilo==='zigue'){for(let i=0;i<2*n;i++)ctx.lineTo(a+(b-a)*((i+.5)/(2*n)),cy+(i%2?R:-R))}
//  else{const m=40*n;for(let i=0;i<=m;i++)ctx.lineTo(a+(b-a)*i/m,cy-R*Math.sin(2*Math.PI*n*i/m))}   // senóide
//  ctx.lineTo(xa+len,cy);ctx.stroke();
}

// Amortecedor (êmbolo num cilindro cheio de fluido) entre a parede (xa) e a face do bloco (xb), na altura y. O cilindro
// é fixo na parede e aberto à direita; o êmbolo (placa) desliza nele e é ligado ao bloco por uma haste. Representação
// simbólica: a posição do êmbolo no cilindro acompanha a do bloco (pos de 0 a 1), em vez da escala real do curso.
function dashpot(xa,xb,y,Lc,pos){
 const hh=9,x1=xa+6,xp=x1+6+(Lc-12)*Math.max(0,Math.min(1,pos));
 ctx.lineWidth=2.4;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
 ctx.moveTo(xa,y);ctx.lineTo(x1,y);                                   // haste fixa na parede
 ctx.moveTo(x1+Lc,y-hh);ctx.lineTo(x1,y-hh);ctx.lineTo(x1,y+hh);ctx.lineTo(x1+Lc,y+hh);   // cilindro (aberto à direita)
 ctx.moveTo(xp,y);ctx.lineTo(xb,y);                                   // haste móvel até o bloco
 ctx.stroke();ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(xp,y-hh+2);ctx.lineTo(xp,y+hh-2);ctx.stroke();   // êmbolo
}
// Retrato de fase: v em função de x. A elipse tracejada é a trajetória sem arrasto (E = E0); com arrasto, a curva
// espirala para a origem (subamortecido) ou vai direto a ela (crítico e superamortecido).
function phase(){
 const C=css,W=fph.w,H=fph.h,m=34,A=P.x0,B=P.x0*su.w0,X=x=>m+(x+A)/(2*A)*(W-2*m),Y=v=>H-m-(v+B)/(2*B)*(H-2*m);
 pctx.clearRect(0,0,W,H);pctx.lineWidth=1;pctx.font=C('--normalfont');
 const sx=Sim.nice(A/2),sv=Sim.nice(B/2);
 for(let g=-Math.floor(A/sx)*sx;g<=A+1e-9;g+=sx){pctx.strokeStyle=C('--grid');pctx.beginPath();pctx.moveTo(X(g),m/2);pctx.lineTo(X(g),H-m);pctx.stroke();if(Math.abs(g)>1e-9){pctx.fillStyle=C('--mut');pctx.textAlign='center';pctx.fillText(+g.toFixed(4),X(g),H-m+14)}}
 for(let g=-Math.floor(B/sv)*sv;g<=B+1e-9;g+=sv){pctx.strokeStyle=C('--grid');pctx.beginPath();pctx.moveTo(m,Y(g));pctx.lineTo(W-m/2,Y(g));pctx.stroke();if(Math.abs(g)>1e-9){pctx.fillStyle=C('--mut');pctx.textAlign='right';pctx.fillText(+g.toFixed(4),m-5,Y(g)+4)}}
 pctx.strokeStyle=C('--ink');pctx.lineWidth=1.4;pctx.beginPath();pctx.moveTo(m,Y(0));pctx.lineTo(W-m/2,Y(0));pctx.moveTo(X(0),m/2);pctx.lineTo(X(0),H-m);pctx.stroke();
 pctx.fillStyle=C('--ink');pctx.textAlign='right';pctx.font=C('--normalfont');pctx.fillText('x (m)',W-6,Y(0)-6);pctx.textAlign='left';pctx.fillText('v (m/s)',X(0)+6,m/2+8);
 pctx.setLineDash([5,4]);pctx.strokeStyle=C('--ghost');pctx.lineWidth=1.3;pctx.beginPath();
 for(let a=0;a<=2*Math.PI+.05;a+=.05)pctx.lineTo(X(P.x0*Math.cos(a)),Y(-P.x0*su.w0*Math.sin(a)));pctx.stroke();pctx.setLineDash([]);
 if(rows.length>1){pctx.strokeStyle=C('--acc');pctx.lineWidth=2;pctx.beginPath();rows.forEach((r,j)=>j?pctx.lineTo(X(r[1]),Y(r[2])):pctx.moveTo(X(r[1]),Y(r[2])));pctx.stroke()}
 pctx.fillStyle=C('--ghost');pctx.beginPath();pctx.arc(X(P.x0),Y(0),4,0,7);pctx.fill();
 pctx.fillStyle=C('--ink');pctx.beginPath();pctx.arc(X(q[0]),Y(q[1]),5.5,0,7);pctx.fill();
}
// Mundo em metros na horizontal (x = 0 no equilíbrio); y em pixels. A mola tem comprimento natural desenhado L0 = x0 + 0,8 m,
// e o bloco tem tamanho fixo em pixels. Com arrasto, a mola fica na parte de cima e o amortecedor na de baixo.
// Forças: escala fixa (a maior entre F_g e k·x0 mede 70 px).
function draw(){
 const C=css,W=fit.w,H=fit.h,ml=30,mr=20,fy=Math.round(H*.62),bw=50,bh=50,damp=su.b>0;
 const xmin=-su.L0,xmax=P.x0+.5,sc=(W-ml-mr)/(xmax-xmin),X=x=>ml+(x-xmin)*sc;
 const x=q[0],cx=X(x),cy=fy-bh/2,yS=cy,yD=fy-bh*.28;
 ctx.clearRect(0,0,W,H);
 const lab=(s,x,y,col,al)=>{ctx.fillStyle=col;ctx.font=C('--normalfont');ctx.textAlign=al||'left';ctx.fillText(s,x,y)};
 // chão com régua (metros em relação ao equilíbrio) e parede
 ctx.strokeStyle=C('--ground');ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(X(xmin),fy);ctx.lineTo(W-mr,fy);ctx.stroke();
 const st=Sim.nice((xmax-xmin)/8);ctx.lineWidth=1;ctx.font=C('--normalfont');ctx.fillStyle=C('--mut');ctx.strokeStyle=C('--mut');
 for(let g=Math.ceil((xmin+.3)/st)*st;g<=xmax;g+=st){ctx.beginPath();ctx.moveTo(X(g),fy+3);ctx.lineTo(X(g),fy+9);ctx.stroke();ctx.textAlign='center';ctx.fillText(+g.toFixed(6),X(g),fy+22)}
 lab('x (m)',W-mr,fy+36,C('--mut'),'right');
 ctx.strokeStyle=C('--ink');ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(X(xmin),fy-bh-26);ctx.lineTo(X(xmin),fy);ctx.stroke();
 // marcas: equilíbrio (x = 0) e posição inicial (x0)
 if($('c_ref').checked){
  ctx.setLineDash([5,4]);ctx.lineWidth=1.3;
  ctx.strokeStyle=C('--ink');ctx.beginPath();ctx.moveTo(X(0),fy-bh-40);ctx.lineTo(X(0),fy);ctx.stroke();lab('x = 0',X(0),fy-bh-46,C('--ink'),'center');
  ctx.strokeStyle=C('--ghost');ctx.beginPath();ctx.moveTo(X(P.x0),fy-bh-40);ctx.lineTo(X(P.x0),fy);ctx.stroke();lab('x_m',X(P.x0),fy-bh-46,C('--mut'),'center');
  ctx.setLineDash([]);
 }
 // mola, amortecedor e bloco
 const xl=X(xmin),xr=cx-bw/2;
 ctx.strokeStyle=C('--ink'); spring(xl,xr,yS,su.L0*sc-bw/2,P.nesp);
//  if(damp)dashpot(xl,xr,yD,Math.max(18,Math.min(90,.85*(.8*sc-bw/2-6))),(x+P.x0)/(2*P.x0));
 ctx.fillStyle=C('--ink');ctx.strokeStyle=C('--ink');ctx.lineWidth=2;ctx.fillRect(cx-bw/2,fy-bh,bw,bh);ctx.strokeRect(cx-bw/2,fy-bh,bw,bh);
 lab('m',cx,cy+4,C('--card'),'center');
 // forças
 const Fg=P.m*P.g,Fel=-P.k*x,Fd=-su.b*q[1],k=70/Math.max(Fg,P.k*P.x0);
 const Fv=(l,v,ox,oy,wx,wy,col)=>{const dx=wx*k,dy=-wy*k,L=Math.hypot(dx,dy);if(L<3)return;
  arrow(ctx,ox,oy,dx,dy,col,2.6);lab(l+'='+f2(Math.abs(v))+' N',ox+dx+dx/L*8,oy+dy+dy/L*12+(Math.abs(dy/L)<.3?4:0),col,dx/L>.3?'left':dx/L<-.3?'right':'center')};
 if($('c_f').checked){
  Fv('F_g',Fg,cx+10,cy,0,-Fg,C('--a'));
  Fv('N',Fg,cx-10,cy,0,Fg,C('--vy'));
  Fv('F_el',Fel,cx,fy-bh-8,Fel,0,C('--acc'));
  Fv('F_d',Fd,cx,fy,Fd,0,C('--vx'));
 }
 // barras de energia: Ep, Ec e Q como fração de E0 (a soma é sempre E0)
 if($('c_bar').checked){
  const ec=.5*P.m*q[1]*q[1],ep=.5*P.k*x*x,bwid=200,bx0=W-mr-bwid,by0=0.1*H;let xx=bx0;
  [[ep,C('--vy'),'U'],[ec,C('--vx'),'K'],[Q,C('--a'),'Q']].forEach(([v,col,nm],j)=>{const w=Math.max(0,Math.min(bwid-(xx-bx0),v/su.E0*bwid));ctx.fillStyle=col;ctx.fillRect(xx,by0,w,12);xx+=w;lab(nm,bx0+j*46,by0+28,col)});
  ctx.strokeStyle=C('--line');ctx.lineWidth=1;ctx.strokeRect(bx0,by0,bwid,12);lab('E₀ = '+f2(su.E0)+' J',bx0+bwid,by0+28,C('--mut'),'right');
 }
 // leituras, texto e gráficos
 const r=row();
 out('t',t);out('x',x);out('v',q[1]);out('Fel',Fel);out('Fd',Fd);out('Ec',r[3]);out('Ep',r[4]);out('Q',Q);
 {const s=status();if(s!==lastSt){lastSt=s;$('cmp').textContent=s;Sim.math($('cmp'))}}   // só re-renderiza quando o texto muda
 const tf=su.tEnd,env=su.reg==='sub'||su.reg==='sem'?[tt=>P.x0*Math.exp(-su.gam*tt),tt=>-P.x0*Math.exp(-su.gam*tt)]:[];   // envoltória ±x0·e^(−γt)
 plots[0].draw(rows,null,tf,env);plots[1].draw(rows,null,tf);plots[2].draw(rows,null,tf);phase();
}
Sim.urlLoad();
reset();
Sim.urlButton(cv);
Sim.loop(dt=>{step(dt);draw()});
})();
