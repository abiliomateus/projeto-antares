/* =====================================================================
   loop.js: partícula solta de uma altura h que percorre uma rampa e um loop (conservação de energia).
   Depende de core.js.

   Organização: 1. Configuração · 2. Interface · 3. Física (geom, accel) · 4. Controle ·
                5. step · 6. status · 7. draw · 8. Loop   (mesma estrutura dos outros arquivos)

   Pista (plano x–y, y para cima, origem na base do loop), percorrida da esquerda para a direita:
     rampa reta de inclinação α  →  arco de concordância de raio R (tangente ao chão na origem)
     →  loop circular de raio R (centro em (0, R), sentido anti-horário)  →  trecho plano de saída.
   A pista é descrita pelo comprimento de arco s (s = 0 na base): geom(s) devolve posição (x, y),
   ângulo da tangente θ e curvatura κ (>0 = curva para a esquerda, em direção ao centro).
   Estado na pista: q = [s, v], com v a velocidade escalar ao longo da pista.
     Aceleração tangencial:  dv/dt = −g·sen θ + f/m        (f = força de atrito ao longo da tangente)
     Normal (empurra a partícula para o lado de dentro da curva):  N = m·(κ·v² + g·cos θ)
     Atrito cinético: |f| = μ·N, contra a velocidade; parada se |m·g·sen θ| ≤ μ·N (atrito estático).
     Energia: E = ½·m·v² + m·g·y  e  Q = ∫ μ·N·|v| dt (dissipada), com  E + Q = E0 = m·g·h.
   Perda de contato: se N < 0 (só é possível no loop), a pista não consegue empurrar a partícula, que
   passa a voo livre (parábola): FL = [x, y, vx, vy]. O voo termina ao tocar a pista de novo.
   Sem atrito, o loop é completado se h ≥ 2,5·R; a perda de contato ocorre em cos φ = −2(h − R)/(3R).
   Modos: 'idle' (pré-visualização) | 'run' | 'end'. Motivo do fim (fim): 'saiu' | 'voo' | 'parou' | 'tempo'.
   Linhas de dados dos gráficos: [t, Ec, Ep, E, Q, v, N/(m·g)].
   ===================================================================== */
(function(){
const {$,rk4,f2,arrow,css}=Sim, DT=1/480, TMAX=20, P={}, cv=$('cv'), ctx=cv.getContext('2d'), D=Math.PI/180;
const fit=Sim.fit(cv,.52,360,560);
let q=[0,0],FL=null,t=0,mode='idle',fim='',paused=false,rows=[],tr=[],acc=0,cnt=0,Q=0,det=null,lastSt='',su;

Sim.interactive(cv,fit);

// ---- Parâmetros ajustáveis (valor em P.<id>) ----
// Os rótulos aceitam HTML e LaTeX (MathJax): \( ... \), escrito aqui como '\\( ... \\)'.
Sim.controls($('ctl'),[
 {id:'h',label:'Altura inicial \\(h\\)',unit:'m',min:.5,max:15,step:.1,val:5},
 {id:'R',label:'Raio do loop \\(R\\)',unit:'m',min:.5,max:3,step:.1,val:1.5},
 {id:'ang',label:'Inclinação da rampa \\(\\alpha\\)',unit:'°',min:20,max:70,step:1,val:50},
 {id:'m',label:'Massa \\(m\\)',unit:'kg',min:.1,max:5,step:.1,val:1},
 {id:'mu',label:'Coeficiente de atrito \\(\\mu\\) (se ligado)',unit:'',min:0,max:.5,step:.01,val:.1},
 {id:'g',label:'Gravidade \\(g\\)',unit:'m/s²',min:1,max:25,step:.1,val:9.8},
 {id:'spd',label:'Velocidade da animação',unit:'×',min:.1,max:2,step:.1,val:1}
],P,id=>{if(id!=='spd')reset()});
$('c_atr').addEventListener('change',reset);
$('pl').addEventListener('change',e=>{const i=$('g');i.value=e.target.value;i.dispatchEvent(new Event('input'))});
const out=Sim.readouts($('ro'),[['t','\\(t\\) (s)'],['y','Altura \\(y\\) (m)'],['v','\\(v\\) (m/s)'],['N','Normal \\(N\\) (N)'],['Ec','\\(K\\) (J)'],['Ep','\\(U\\) (J)'],['E','\\(E = K + U\\) (J)'],['Q','Dissipada \\(Q\\) (J)']]);

// ---- Gráficos (colunas: 1=Ec 2=Ep 3=E 4=Q 5=v 6=N/(m·g)) ----
// Título e legenda ficam em HTML (com MathJax) acima de cada canvas; as cores precisam coincidir com as de lá.
const plots=[
 new Sim.Plot($('p1'),{title:'',mt:8,series:[{col:1,name:'',color:'--vx'},{col:2,name:'',color:'--vy'},{col:3,name:'',color:'--acc'},{col:4,name:'',color:'--a'}]}),
 new Sim.Plot($('p2'),{title:'',mt:8,series:[{col:5,name:'',color:'--acc'}]}),
 new Sim.Plot($('p3'),{title:'',mt:8,series:[{col:6,name:'',color:'--a'}]})
];

// ---- Física ----
const useF=()=>$('c_atr').checked&&P.mu>0;
// Geometria da pista a partir dos parâmetros: o arco de concordância tem raio R; s0 é o ponto de partida
// (na rampa se h ≥ hf, ou já no arco se h < hf, a altura do início do arco); send é o fim do trecho plano.
function setup(){
 const R=P.R,a=P.ang*D,hf=R*(1-Math.cos(a)),Lf=R*a,Lx=Math.max(3,2.5*R+1.5);
 const s0=P.h>=hf?-(Lf+(P.h-hf)/Math.sin(a)):-R*Math.acos(1-P.h/R);
 return{R,a,hf,Lf,Lx,s0,send:2*Math.PI*R+Lx};
}
// Posição, ângulo da tangente (th) e curvatura (k) no comprimento de arco s. Para outra pista, edite aqui.
function geom(s){
 if(s<=-su.Lf){const d=-s-su.Lf;return{x:-su.R*Math.sin(su.a)-d*Math.cos(su.a),y:su.hf+d*Math.sin(su.a),th:-su.a,k:0}}   // rampa reta
 if(s<0){const b=-s/su.R;return{x:-su.R*Math.sin(b),y:su.R*(1-Math.cos(b)),th:-b,k:1/su.R}}                           // arco de concordância
 if(s<=2*Math.PI*su.R){const f=s/su.R;return{x:su.R*Math.sin(f),y:su.R*(1-Math.cos(f)),th:f,k:1/su.R}}               // loop
 return{x:s-2*Math.PI*su.R,y:0,th:0,k:0};                                                                            // trecho plano
}
// Força de atrito ao longo de +tangente (N). Em repouso: estática se segurar a partícula, senão cinética.
function fricF(s,v){
 if(!useF())return 0;
 const g=geom(s),N=Math.max(0,P.m*(g.k*v*v+P.g*Math.cos(g.th))),at=-P.g*Math.sin(g.th);
 if(Math.abs(v)<1e-9)return Math.abs(at)*P.m<=P.mu*N?P.m*P.g*Math.sin(g.th):-Math.sign(at)*P.mu*N;
 return -Math.sign(v)*P.mu*N;
}
// EQUAÇÕES DO MOVIMENTO na pista: dq/dt para q = [s, v].
const accel=(s,v)=>-P.g*Math.sin(geom(s).th)+fricF(s,v)/P.m;
const deriv=z=>[z[1],accel(z[0],z[1])];
// Estado atual em coordenadas cartesianas (na pista ou em voo livre), com a normal N quando na pista.
function cur(){
 if(FL)return{x:FL[0],y:FL[1],vx:FL[2],vy:FL[3],tr:false,N:0,th:0};
 const g=geom(q[0]),v=q[1];
 return{x:g.x,y:g.y,vx:v*Math.cos(g.th),vy:v*Math.sin(g.th),tr:true,th:g.th,N:Math.max(0,P.m*(g.k*v*v+P.g*Math.cos(g.th)))};
}
const row=()=>{const c=cur(),ec=.5*P.m*(c.vx*c.vx+c.vy*c.vy),ep=P.m*P.g*c.y;return[t,ec,ep,ec+ep,Q,Math.hypot(c.vx,c.vy),c.N/(P.m*P.g)]};
const record=()=>{rows.push(row());const c=cur();tr.push([c.x,c.y])};

// ---- Controle ----
function reset(){su=setup();q=[su.s0,0];FL=null;t=0;rows=[];tr=[];Q=0;det=null;fim='';acc=0;paused=false;mode='idle';$('bp').textContent='Pausar'}
function launch(){reset();mode='run';record()}
function end(){record();mode='end'}
$('bl').onclick=launch;
$('bp').onclick=()=>{if(mode!=='run')return;paused=!paused;$('bp').textContent=paused?'Continuar':'Pausar'};
$('bc').onclick=reset;

// Passos fixos de DT (RK4 na pista; queda livre exata no voo). Na pista: soma o calor dissipado Q, trata a
// parada pelo atrito quando v cruza zero, e passa a voo livre se N < 0.
function step(dt){
 if(mode!=='run'||paused)return;
 acc+=dt*P.spd;
 while(acc>=DT){
  acc-=DT;
  if(FL){
   FL[0]+=FL[2]*DT;FL[1]+=FL[3]*DT-.5*P.g*DT*DT;FL[3]-=P.g*DT;t+=DT;
   const rx=FL[0],ry=FL[1]-su.R;
   if(FL[1]<=0){FL[1]=0;fim='voo';end();return}
   if(rx*rx+ry*ry>su.R*su.R&&rx*FL[2]+ry*FL[3]>0){fim='voo';end();return}
  }else{
   const g0=geom(q[0]);
   if(useF())Q+=P.mu*Math.max(0,P.m*(g0.k*q[1]*q[1]+P.g*Math.cos(g0.th)))*Math.abs(q[1])*DT;
   let n=rk4(deriv,q,DT);
   if(useF()&&q[1]*n[1]<0){const g1=geom(n[0]);if(Math.abs(P.g*Math.sin(g1.th))<=P.mu*Math.max(0,P.g*Math.cos(g1.th)))n[1]=0}   // atrito segura
   if(n[0]<su.s0)n=[su.s0,Math.abs(n[1])];                                                                                   // "batente" no início da rampa
   t+=DT;
   const g1=geom(n[0]);
   if(P.m*(g1.k*n[1]*n[1]+P.g*Math.cos(g1.th))<0){FL=[g1.x,g1.y,n[1]*Math.cos(g1.th),n[1]*Math.sin(g1.th)];det={phi:n[0]/su.R/D};q=n}   // perde o contato
   else{
    q=n;
    if(q[0]>=su.send){fim='saiu';end();return}
    if(q[1]===0&&accel(q[0],0)===0&&t>1){fim='parou';end();return}
   }
  }
  if(++cnt%2===0)record();
  if(t>=TMAX){fim=fim||'tempo';end();return}
 }
}

// Frase de situação mostrada sob o canvas (LaTeX; renderizada por MathJax quando o texto muda).
const M=x=>'\\('+x+'\\)',fm=Sim.fm,J='\\,\\mathrm{J}';
function status(){
 const E0=P.m*P.g*P.h,hc=2.5*P.R,last=rows.length?rows[rows.length-1]:null;
 if(mode==='end'&&last){
  const e='E='+fm(last[3])+J,q2='Q='+fm(last[4])+J;
  if(fim==='saiu')return'Completou o loop e saiu da pista com '+M('v='+fm(last[5])+'\\,\\mathrm{m/s}')+'. Energia mecânica: '+M('E_0='+fm(E0)+J+'\\to '+fm(last[3])+J)+'; dissipada: '+M(q2)+' (soma = '+M('E_0')+').';
  if(fim==='voo')return'Perdeu o contato com a pista em '+M('\\varphi='+fm(det.phi)+'^\\circ')+' (medido a partir da base), onde '+M('N=0')+', e seguiu em voo livre até tocar a pista de novo. No voo, '+M('E')+' não muda ('+M(e)+').';
  if(fim==='parou')return'O atrito segura a partícula: parou com '+M(e)+'; dissipada: '+M(q2)+'.';
  return'Tempo limite ('+M('20\\,\\mathrm{s}')+'): a partícula oscila na pista sem completar o loop. '+M(e)+'; dissipada: '+M(q2)+'.';
 }
 let s='Energia inicial '+M('E_0=mgh='+fm(E0)+J)+'. ';
 if(useF())return s+'Com atrito, parte da energia é dissipada ('+M('E+Q=E_0')+') e a altura mínima para completar o loop passa a ser maior que '+M('2{,}5R='+fm(hc)+'\\,\\mathrm{m}')+'.';
 s+='Sem atrito, o loop é completado se '+M('h\\ge 2{,}5R='+fm(hc)+'\\,\\mathrm{m}')+'. ';
 if(P.h>=hc)return s+'Com este '+M('h')+', a partícula completa o loop.';
 if(P.h>P.R)return s+'Com este '+M('h')+', ela perde o contato em '+M('\\varphi\\approx '+fm(Math.acos(-2*(P.h-P.R)/(3*P.R))/D)+'^\\circ')+' e cai em voo livre.';
 return s+'Com este '+M('h')+' ela sobe só até a altura '+M('h')+' e volta, sem sair da pista.';
}

// ---- Desenho ----
// Mundo em metros (y para cima); X() e Y() convertem para pixels. A janela vai do início da rampa ao fim do
// trecho plano e de y = 0 até max(h, 2R). Partícula desenhada como ponto de tamanho fixo.
function draw(){
 const C=css,W=fit.w,H=fit.h,mL=52,mR=20,mT=40,mB=34,xs=geom(su.s0).x,xe=su.Lx,yt=Math.max(P.h,2*P.R);
 const sc=Math.min((W-mL-mR)/(xe-xs),(H-mT-mB)/yt),X=x=>mL+(x-xs)*sc,Y=y=>H-mB-y*sc;
 ctx.clearRect(0,0,W,H);
 const lab=(s,x,y,col,al)=>{ctx.fillStyle=col;ctx.font=C('--normalfont');ctx.textAlign=al||'left';ctx.fillText(s,x,y)};
 // grade horizontal (alturas em metros)
 const st=Sim.nice(yt/5);ctx.lineWidth=1;ctx.font=C('--normalfont');
 for(let y=0;y<=yt*1.02;y+=st){ctx.strokeStyle=C('--grid');ctx.beginPath();ctx.moveTo(mL,Y(y));ctx.lineTo(W-mR,Y(y));ctx.stroke();ctx.fillStyle=C('--mut');ctx.textAlign='right';ctx.fillText(+y.toFixed(6),mL-6,Y(y)+4)}
 lab('y (m)',8,16,C('--mut'));
 // alturas h (início) e h_c = 2,5R (mínima para completar o loop, sem atrito)
 if($('c_hc').checked){
  ctx.setLineDash([6,5]);ctx.lineWidth=1.3;
  ctx.strokeStyle=C('--ink');ctx.beginPath();ctx.moveTo(X(xs),Y(P.h));ctx.lineTo(X(xe),Y(P.h));ctx.stroke();lab('h',X(xs)+4,Y(P.h)-5,C('--ink'));
  ctx.strokeStyle=C('--a');ctx.beginPath();ctx.moveTo(X(xs),Y(2.5*P.R));ctx.lineTo(X(xe),Y(2.5*P.R));ctx.stroke();lab('h_c = 2,5R',X(xe),Y(2.5*P.R)-5,C('--a'),'right');
  ctx.setLineDash([]);
 }
 // pista
 ctx.strokeStyle=C('--ghost');ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
 for(let s=su.s0;s<=su.send+1e-9;s+=.05){const g=geom(s);s===su.s0?ctx.moveTo(X(g.x),Y(g.y)):ctx.lineTo(X(g.x),Y(g.y))}
 ctx.stroke();ctx.lineCap='butt';
 // rastro
 if($('c_tr').checked&&tr.length>1){ctx.strokeStyle=C('--acc');ctx.lineWidth=2;ctx.globalAlpha=.55;ctx.beginPath();tr.forEach((p,j)=>j?ctx.lineTo(X(p[0]),Y(p[1])):ctx.moveTo(X(p[0]),Y(p[1])));ctx.stroke();ctx.globalAlpha=1}
 // partícula e forças (escala fixa: o peso mede 34 px; setas maiores que 140 px são encurtadas)
 const c=cur(),px=X(c.x),py=Y(c.y),k=34/(P.m*P.g);
 const Fv=(l,v,wx,wy,col)=>{let dx=wx*k,dy=-wy*k;const L=Math.hypot(dx,dy);if(L<3)return;if(L>140){dx*=140/L;dy*=140/L}
  arrow(ctx,px,py,dx,dy,col,2.6);const n=Math.hypot(dx,dy);lab(l+'='+f2(v)+' N',px+dx+dx/n*8,py+dy+dy/n*12+(Math.abs(dy/n)<.3?4:0),col,dx/n>.3?'left':dx/n<-.3?'right':'center')};
 if($('c_f').checked){
  Fv('F_g',P.m*P.g,0,-P.m*P.g,C('--a'));
  if(c.tr){Fv('N',c.N,-Math.sin(c.th)*c.N,Math.cos(c.th)*c.N,C('--acc'));
   const f=fricF(q[0],q[1]);Fv('f',Math.abs(f),Math.cos(c.th)*f,Math.sin(c.th)*f,C('--vx'))}
 }
 ctx.fillStyle=C('--ink');ctx.beginPath();ctx.arc(px,py,9.5,0,7);ctx.fill();
 // barras de energia: Ep, Ec e Q como fração de E0 (a soma é sempre E0)
 if($('c_bar').checked){
  const E0=P.m*P.g*P.h,ec=.5*P.m*(c.vx*c.vx+c.vy*c.vy),ep=P.m*P.g*c.y,bw=200,bx=W-mR-bw,by=8;let x=bx;
  [[ep,C('--vy'),'U'],[ec,C('--vx'),'K'],[Q,C('--a'),'Q']].forEach(([v,col,nm],j)=>{const w=Math.max(0,Math.min(bw-(x-bx),v/E0*bw));ctx.fillStyle=col;ctx.fillRect(x,by,w,12);x+=w;lab(nm,bx+j*46,by+28,col)});
  ctx.strokeStyle=C('--line');ctx.lineWidth=1;ctx.strokeRect(bx,by,bw,12);lab('E₀ = '+f2(E0)+' J',bx+bw,by+28,C('--mut'),'right');
 }
 // leituras, texto e gráficos
 const r=row();
 out('t',t);out('y',c.y);out('v',r[5]);out('N',c.N);out('Ec',r[1]);out('Ep',r[2]);out('E',r[3]);out('Q',Q);
 {const s=status();if(s!==lastSt){lastSt=s;$('cmp').textContent=s;Sim.math($('cmp'))}}   // só re-renderiza quando o texto muda
 plots.forEach(p=>p.draw(rows,null,8));
}
reset();
Sim.loop(dt=>{step(dt);draw()});
})();
