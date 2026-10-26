/* =====================================================================
   doiscorpos.js: problema de dois corpos. Dois corpos orbitam o centro de massa (CM) comum; mostra as duas
   órbitas elípticas, a órbita da massa reduzida (a órbita relativa) e o CM. Depende de core.js.

   Organização: 1. Configuração · 2. Interface · 3. Física (setup, deriv, step) · 4. Controle · 5. step ·
                6. status · 7. draw · 8. Loop   (mesma estrutura dos outros arquivos)

   Unidades: massas em M☉ (massas solares), distâncias em UA, tempo em anos. Nelas, G = 4π² UA³/(M☉·ano²).
   Velocidades são mostradas em km/s (1 UA/ano = 4,74047 km/s) e forças em N (1 M☉·UA/ano² = 2,986×10²⁶ N).

   Física:
     Cada corpo sofre a força gravitacional F_g = G·m1·m2/r² apontando para o outro (3ª lei de Newton: forças iguais e
     opostas). Integra-se o sistema inteiro (8 variáveis: posição e velocidade dos dois corpos) com RK4.
     Com o CM na origem e em repouso (momento total nulo), r = r2 − r1 é a posição relativa e
         r1 = −(m2/M)·r,    r2 = +(m1/M)·r,    M = m1 + m2.
     O corpo fictício de massa reduzida μ = m1·m2/M na posição r, atraído por uma massa fixa M no CM, obedece a
         μ·r'' = −G·m1·m2·r/r³   ⇔   r'' = −G·M·r/r³,
     ou seja, a órbita relativa é uma órbita de Kepler: elipse com o CM num foco, semi-eixo maior a e excentricidade e,
         r = a·(1 − e²)/(1 + e·cos θ),    T = 2π·√(a³/(G·M)).
     As órbitas dos corpos são cópias da relativa, reduzidas por m2/M (corpo 1, do lado oposto) e m1/M (corpo 2): mesma
     excentricidade, mesmo período, semi-eixos a1 = (m2/M)·a e a2 = (m1/M)·a, e r1/r2 = m2/m1 sempre.
     Conservação: E = ½·m1·v1² + ½·m2·v2² − G·m1·m2/r = −G·m1·m2/(2a)   e   L = μ·√(G·M·a·(1−e²)) (em torno do CM).
   Condição inicial: a partir da anomalia média M0 (0° = periastro) resolve-se a equação de Kepler para a posição e a
   velocidade relativas. Passo variável: h = DT·min(1, 2·(r/a)^1,5) (mais curto perto do periastro).
   Modos: 'idle' (pré-visualização) | 'run' | 'end' (6 períodos).
   Linhas de dados dos gráficos: [t, r, r1, r2, v1, v2, v_rel, K, U, E, L]  (v em km/s).
   ===================================================================== */
(function(){
const {$,rk4,f2,arrow,css}=Sim, P={}, G=4*Math.PI*Math.PI, KMS=4.74047, FN=2.986e26, NPER=20000, D=Math.PI/180, cv=$('cv'), ctx=cv.getContext('2d');
const fit=Sim.fit(cv,.7,380,600);
Sim.interactive(cv,fit);   // zoom e deslocamento do canvas (ver core.js)
Sim.playbar(cv,()=>mode,()=>paused);   // ▶/⏸ e reiniciar sobre o canvas (ver core.js)
let st=[0,0,0,0,0,0,0,0],t=0,mode='idle',paused=false,rows=[],tr=[],acc=0,cnt=0,lastSt='',su;

// ---- Parâmetros ajustáveis (valor em P.<id>) ----
// Os rótulos aceitam HTML e LaTeX (MathJax): \( ... \), escrito aqui como '\\( ... \\)'.
Sim.controls($('ctl'),[
 {id:'m1',label:'Massa \\(m_1\\)',unit:'M_sol',min:.2,max:10,step:.1,val:4},
 {id:'m2',label:'Massa \\(m_2\\)',unit:'M_sol',min:.2,max:10,step:.1,val:2.5},
 {id:'a',label:'Semi-eixo maior relativo \\(a\\)',unit:'UA',min:1,max:10,step:.1,val:4},
 {id:'e',label:'Excentricidade \\(\\epsilon\\)',unit:'',min:0,max:.95,step:.01,val:0.5},
 {id:'om',label:'Orientação da órbita',unit:'°',min:0,max:360,step:5,val:0},
 {id:'M0',label:'Posição inicial (anomalia média \\(M_0\\))',unit:'°',min:0,max:360,step:5,val:0},
 {id:'spd',label:'Velocidade da animação',unit:'x',min:.1,max:3,step:.1,val:1}
],P,id=>{if(id!=='spd')reset()});
const out=Sim.readouts($('ro'),[['t','\\(t\\) (anos)'],['r','\\(r\\) (UA)'],['r1','\\(r_1\\) (UA)'],['r2','\\(r_2\\) (UA)'],['v1','\\(v_1\\) (km/s)'],['v2','\\(v_2\\) (km/s)'],['E','\\(E\\) (M☉·UA²/ano²)'],['L','\\(L\\) (M☉·UA²/ano)']]);

// ---- Gráficos (colunas: 1=r 2=r1 3=r2 4=v1 5=v2 6=v_rel 7=K 8=U 9=E 10=L) ----
// Título e legenda ficam em HTML (com MathJax) acima de cada canvas; as cores precisam coincidir com as de lá.
// const plots=[
//  new Sim.Plot($('p1'),{title:'',mt:8,series:[{col:1,name:'',color:'--ink'},{col:2,name:'',color:'--acc'},{col:3,name:'',color:'--vx'}]}),
//  new Sim.Plot($('p2'),{title:'',mt:8,series:[{col:4,name:'',color:'--acc'},{col:5,name:'',color:'--vx'},{col:6,name:'',color:'--ink'}]}),
//  new Sim.Plot($('p3'),{title:'',mt:8,series:[{col:7,name:'',color:'--vx'},{col:8,name:'',color:'--vy'},{col:9,name:'',color:'--a'}]}),
//  new Sim.Plot($('p4'),{title:'',mt:8,series:[{col:10,name:'',color:'--a'}]})
// ];

// ---- Física ----
// Grandezas da órbita (Kepler) e condição inicial. rel(E) dá a posição e a velocidade relativas (UA, UA/ano) para a
// anomalia excêntrica E, já giradas por ω; kepler(M) resolve M = E − e·sen E (Newton, com M reduzido a [0, 2π)). fa e fb são as frações
// m2/M e m1/M: corpo 1 em −fa·r e corpo 2 em +fb·r. box = janela que cobre as três órbitas (relativa e dos corpos).
function setup(){
 const M=P.m1+P.m2,mu=P.m1*P.m2/M,a=P.a,e=P.e,b=a*Math.sqrt(1-e*e),n=Math.sqrt(G*M/(a*a*a)),T=2*Math.PI/n,w=P.om*D,fa=P.m2/M,fb=P.m1/M;
 const kepler=Ma=>{const k=Math.floor(Ma/(2*Math.PI)),m=Ma-2*Math.PI*k;let E=e<.8?m:Math.PI;for(let i=0;i<80;i++){const dl=(E-e*Math.sin(E)-m)/(1-e*Math.cos(E));E-=dl;if(Math.abs(dl)<1e-14)break}return E+2*Math.PI*k};   // reduz M a [0, 2π) (a partida E = π só converge aí) e devolve E contínuo
 const rel=E=>{const c=Math.cos(E),s=Math.sin(E),x=a*(c-e),y=b*s,vx=-a*n*s/(1-e*c),vy=b*n*c/(1-e*c),cw=Math.cos(w),sw=Math.sin(w);
  return{x:x*cw-y*sw,y:x*sw+y*cw,vx:vx*cw-vy*sw,vy:vx*sw+vy*cw}};
 const p0=rel(kepler(P.M0*D)),init=[-fa*p0.x,-fa*p0.y,-fa*p0.vx,-fa*p0.vy,fb*p0.x,fb*p0.y,fb*p0.vx,fb*p0.vy];
 let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
 for(let i=0;i<=200;i++){const p=rel(2*Math.PI*i/200);[1,-fa,fb].forEach(s=>{x0=Math.min(x0,s*p.x);x1=Math.max(x1,s*p.x);y0=Math.min(y0,s*p.y);y1=Math.max(y1,s*p.y)})}
 return{M,mu,a,e,b,n,T,w,fa,fb,kepler,rel,init,box:{x0,x1,y0,y1},E0:-G*P.m1*P.m2/(2*a),L0:mu*Math.sqrt(G*M*a*(1-e*e)),DT:T/NPER,tEnd:6*T};
}
// EQUAÇÕES DO MOVIMENTO: z = [x1, y1, vx1, vy1, x2, y2, vx2, vy2]. Para outro modelo (um 3º corpo, arrasto, correção
// relativística), altere esta função.
const deriv=z=>{const dx=z[4]-z[0],dy=z[5]-z[1],d3=Math.pow(dx*dx+dy*dy,1.5),g1=G*P.m2/d3,g2=G*P.m1/d3;
 return[z[2],z[3],g1*dx,g1*dy,z[6],z[7],-g2*dx,-g2*dy]};
const row=()=>{const x1=st[0],y1=st[1],u1=st[2],v1=st[3],x2=st[4],y2=st[5],u2=st[6],v2=st[7],r=Math.hypot(x2-x1,y2-y1),s1=Math.hypot(u1,v1),s2=Math.hypot(u2,v2);
 const K=.5*P.m1*s1*s1+.5*P.m2*s2*s2,U=-G*P.m1*P.m2/r;
 return[t,r,Math.hypot(x1,y1),Math.hypot(x2,y2),s1*KMS,s2*KMS,Math.hypot(u2-u1,v2-v1)*KMS,K,U,K+U,P.m1*(x1*v1-y1*u1)+P.m2*(x2*v2-y2*u2)]};
const record=()=>{rows.push(row());tr.push([st[0],st[1],st[4],st[5]])};

// ---- Controle ----
function reset(){su=setup();st=su.init.slice();t=0;rows=[];tr=[];acc=0;cnt=0;paused=false;mode='idle';$('bp').textContent='Pausar'}
function launch(){reset();mode='run';record()}
function end(){record();mode='end'}
$('bl').onclick=launch;
$('bp').onclick=()=>{if(mode!=='run')return;paused=!paused;$('bp').textContent=paused?'Continuar':'Pausar'};
$('bc').onclick=reset;

// Passo variável de RK4: h = DT·min(1, 2·(r/a)^1,5), mais curto perto do periastro, onde a órbita é rápida. O tempo
// simulado avança T/8 por segundo (×velocidade da animação), isto é, um período a cada 8 s. Grava um ponto a cada 40 passos.
function step(dt){
 if(mode!=='run'||paused)return;
 acc+=dt*(su.T/8)*P.spd;
 for(;;){
  const r=Math.hypot(st[4]-st[0],st[5]-st[1]),h=su.DT*Math.min(1,2*Math.pow(r/su.a,1.5));
  if(acc<h)break;
  acc-=h;st=rk4(deriv,st,h);t+=h;
  if(++cnt%40===0)record();
  if(t>=su.tEnd){end();return}
 }
}

// Frase de situação mostrada sob o canvas (LaTeX; renderizada por MathJax quando o texto muda).
const M_=x=>'\\('+x+'\\)',fm=Sim.fm,ex=v=>{if(!v)return'0';const q=v.toExponential(1).split('e');return q[0].replace('.',',')+'\\times 10^{'+(+q[1])+'}'},MS='\\,M_\\odot',UA='\\,\\mathrm{UA}';
function status(){
 const last=rows.length?rows[rows.length-1]:null;
 if(mode==='end'&&last){
  let dE=0,dL=0;rows.forEach(r=>{dE=Math.max(dE,Math.abs(r[9]-su.E0)/Math.abs(su.E0));dL=Math.max(dL,Math.abs(r[10]-su.L0)/su.L0)});
  const cm=Math.hypot(P.m1*st[0]+P.m2*st[4],P.m1*st[1]+P.m2*st[5])/su.M;
  return'Fim da simulação (6 períodos). Conservação: '+M_('\\Delta E/|E_0|\\le '+ex(dE))+' e '+M_('\\Delta L/L_0\\le '+ex(dL))+'; o CM continuou na origem ('+M_('|\\vec R_{cm}|\\approx '+ex(cm)+UA)+').';
 }
 return'Massa total '+M_('M=m_1+m_2='+fm(su.M)+MS)+' e massa reduzida '+M_('\\mu=\\dfrac{m_1m_2}{m_1+m_2}='+fm(su.mu)+MS)+'. Terceira lei de Kepler: '+M_('T=\\sqrt{a^3/M}='+fm(su.T)+'\\,\\mathrm{anos}')+'. Semi-eixos das órbitas dos corpos: '+
  M_('a_1=\\dfrac{m_2}{M}a='+fm(su.fa*su.a)+UA)+' e '+M_('a_2=\\dfrac{m_1}{M}a='+fm(su.fb*su.a)+UA)+', logo '+M_('r_1/r_2=m_2/m_1='+fm(P.m2/P.m1))+' o tempo todo. O CM está no foco comum das duas elipses, e a órbita de '+M_('\\mu')+' (tracejada em preto) é a órbita relativa.';
}

// ---- Desenho ----
// Mundo em UA (y para cima), CM na origem; X() e Y() convertem para pixels. A janela cobre a órbita relativa (a maior).
// Corpos: círculos com raio crescendo com a massa (só visual). Forças: escala fixa (a força no periastro mede 60 px);
// velocidades: escala fixa (a maior velocidade possível de um corpo mede 45 px).
const sup='⁰¹²³⁴⁵⁶⁷⁸⁹',sci=v=>{if(!v)return'0';const ex=Math.floor(Math.log10(Math.abs(v))),m=v/Math.pow(10,ex);return m.toFixed(1).replace('.',',')+'×10'+String(ex).split('').map(c=>c==='-'?'⁻':sup[+c]).join('')};
function draw(){
 const C=css,W=fit.w,H=fit.h,bx=su.box,mg=34,{fa,fb}=su;
 const sc=Math.min((W-2*mg)/(bx.x1-bx.x0),(H-2*mg)/(bx.y1-bx.y0)),cx=(bx.x0+bx.x1)/2,cy=(bx.y0+bx.y1)/2,X=x=>W/2+(x-cx)*sc,Y=y=>H/2-(y-cy)*sc,ox=X(0),oy=Y(0);
 ctx.clearRect(0,0,W,H);
 const lab=(s,x,y,col,al)=>{ctx.fillStyle=col;ctx.font=C('--normalfont');ctx.textAlign=al||'left';ctx.fillText(s,x,y)};
 // grade e eixos (CM na origem), marcas em UA
 const stp=Sim.nice(Math.max(bx.x1-bx.x0,bx.y1-bx.y0)/7),gx0=cx-W/2/sc,gx1=cx+W/2/sc,gy0=cy-H/2/sc,gy1=cy+H/2/sc;
 ctx.lineWidth=1;ctx.strokeStyle=C('--grid');
 for(let g=Math.ceil(gx0/stp)*stp;g<=gx1;g+=stp){ctx.beginPath();ctx.moveTo(X(g),0);ctx.lineTo(X(g),H);ctx.stroke()}
 for(let g=Math.ceil(gy0/stp)*stp;g<=gy1;g+=stp){ctx.beginPath();ctx.moveTo(0,Y(g));ctx.lineTo(W,Y(g));ctx.stroke()}
 ctx.strokeStyle=C('--ghost');ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(0,oy);ctx.lineTo(W,oy);ctx.moveTo(ox,0);ctx.lineTo(ox,H);ctx.stroke();
 ctx.font=C('--normalfont');ctx.fillStyle=C('--mut');
 for(let g=Math.ceil(gx0/stp)*stp;g<=gx1;g+=stp)if(Math.abs(g)>1e-9){ctx.textAlign='center';ctx.fillText(+g.toFixed(6),X(g),oy+14)}
 for(let g=Math.ceil(gy0/stp)*stp;g<=gy1;g+=stp)if(Math.abs(g)>1e-9){ctx.textAlign='right';ctx.fillText(+g.toFixed(6),ox-5,Y(g)+4)}
 lab('x (UA)',W-8,oy-8,C('--mut'),'right');lab('y (UA)',ox+8,14,C('--mut'));
 // órbitas elípticas (analíticas, tracejadas): dos corpos (cópias reduzidas da relativa) e da massa reduzida (relativa)
 const ell=(s,col,w)=>{ctx.setLineDash([6,5]);ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();
  for(let i=0;i<=240;i++){const p=su.rel(2*Math.PI*i/240);i?ctx.lineTo(X(s*p.x),Y(s*p.y)):ctx.moveTo(X(s*p.x),Y(s*p.y))}ctx.stroke();ctx.setLineDash([])};
 if($('c_el').checked){ell(-fa,C('--vy'),1);ell(fb,C('--vx'),1)}
 if($('c_mu').checked)ell(1,C('--ink'),1);
 // rastros simulados
 if($('c_tr').checked&&tr.length>1)[[0,1,C('--vy')],[2,3,C('--vx')]].forEach(([i,j,col])=>{
  ctx.strokeStyle=col;ctx.lineWidth=2.4;ctx.globalAlpha=.65;ctx.beginPath();tr.forEach((p,k)=>k?ctx.lineTo(X(p[i]),Y(p[j])):ctx.moveTo(X(p[i]),Y(p[j])));ctx.stroke();ctx.globalAlpha=1});
 const x1=st[0],y1=st[1],x2=st[4],y2=st[5],dx=x2-x1,dy=y2-y1,r=Math.hypot(dx,dy),ux=dx/r,uy=dy/r;
 // linha corpo 1 – CM – corpo 2
 if($('c_lin').checked){ctx.strokeStyle=C('--ink');ctx.globalAlpha=.45;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(X(x1),Y(y1));ctx.lineTo(X(x2),Y(y2));ctx.stroke();ctx.globalAlpha=1}
 // massa reduzida μ: posição relativa r = r2 − r1, com origem no CM (ela orbita o CM como se ele tivesse massa M)
 if($('c_mu').checked){
  ctx.strokeStyle=C('--ink');ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(X(dx),Y(dy));ctx.stroke();
  ctx.fillStyle=C('--card');ctx.lineWidth=2;ctx.beginPath();ctx.arc(X(dx),Y(dy),6,0,7);ctx.fill();ctx.stroke();
  lab('μ',X(dx)+10,Y(dy)-8,C('--ink'));lab('r',(ox+X(dx))/2+6,(oy+Y(dy))/2-6,C('--mut'));
 }
 // forças e velocidades
 const arr=(l,x,y,vx,vy,col,w)=>{const L=Math.hypot(vx,vy);if(L<3)return;arrow(ctx,x,y,vx,vy,col,w||2.6);lab(l,x+vx+vx/L*8,y+vy+vy/L*12+(Math.abs(vy/L)<.3?4:0),col,vx/L>.3?'left':vx/L<-.3?'right':'center')};
 const rp=su.a*(1-su.e),Fmax=G*P.m1*P.m2/(rp*rp),F=G*P.m1*P.m2/(r*r),kf=60/Fmax,vmax=Math.max(fa,fb)*Math.sqrt(G*su.M*(1+su.e)/rp),kv=45/vmax;
 const b1=[X(x1),Y(y1)],b2=[X(x2),Y(y2)];
 if($('c_f').checked){arr('F_g,1='+sci(F*FN)+' N',b1[0],b1[1],ux*F*kf,-uy*F*kf,C('--a'));arr('F_g,2='+sci(F*FN)+' N',b2[0],b2[1],-ux*F*kf,uy*F*kf,C('--a'))}
 if($('c_v').checked){[[st,0,C('--vy'),'v₁'],[st,4,C('--vx'),'v₂']].forEach(([s,i,col,nm])=>{const vx=s[i+2],vy=s[i+3];arr(nm+'='+f2(Math.hypot(vx,vy)*KMS)+' km/s',i?b2[0]:b1[0],i?b2[1]:b1[1],vx*kv,-vy*kv,col,2.2)})}
 // CM (cruz) e corpos
 ctx.strokeStyle=C('--ink');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(ox-7,oy);ctx.lineTo(ox+7,oy);ctx.moveTo(ox,oy-7);ctx.lineTo(ox,oy+7);ctx.stroke();lab('CM',ox+9,oy-9,C('--ink'));
 [[b1,P.m1,C('--vy'),'1'],[b2,P.m2,C('--vx'),'2']].forEach(([p,m,col,nm])=>{const rr=5+4*Math.cbrt(m);ctx.fillStyle=col;ctx.beginPath();ctx.arc(p[0],p[1],rr,0,7);ctx.fill();lab(nm,p[0],p[1]+4,C('--sky'),'center')});
 // leituras, texto e gráficos
 const rw=row();
 out('t',t);out('r',rw[1]);out('r1',rw[2]);out('r2',rw[3]);out('v1',rw[4]);out('v2',rw[5]);out('E',rw[9]);out('L',rw[10]);
 {const s=status();if(s!==lastSt){lastSt=s;$('cmp').textContent=s;Sim.math($('cmp'))}}   // só re-renderiza quando o texto muda
 const tf=2*su.T,M0=P.M0*D;
 // referência tracejada do gráfico de distâncias: solução de Kepler, r = a(1 − e·cos E) com M = n·t + M0
 const kep=tt=>{const E=su.kepler(su.n*tt+M0),rr=su.a*(1-su.e*Math.cos(E));return[tt,rr,fa*rr,fb*rr,0,0,0,0,0,0,0]};
//  plots[0].draw(rows,kep,tf);plots[1].draw(rows,null,tf);plots[2].draw(rows,null,tf,[()=>su.E0]);plots[3].draw(rows,null,tf,[()=>su.L0]);
}
reset();
Sim.loop(dt=>{step(dt);draw()});
})();
