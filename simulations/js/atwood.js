/* =====================================================================
   blocos.js: dois blocos ligados por uma corda sobre uma polia fixa, em dois planos
   inclinados com ângulos independentes e a MESMA ALTURA H. Depende de core.js.
   Com altura igual, os comprimentos dos planos são L1 = H/sen α e L2 = H/sen β (por isso os ângulos
   têm mínimo de 15°). Os blocos partem do ponto médio de cada plano.

   Organização: 1. Configuração · 2. Interface · 3. Física (phys, deriv) · 4. Controle ·
                5. step · 6. status · 7. draw · 8. Loop   (mesma estrutura de inclinado.js)

   Modelo (corda inextensível e sem massa, polia sem massa e sem atrito):
     Coordenada única x (m): positiva quando m₁ DESCE o plano esquerdo (ângulo α) e m₂ SOBE o direito (β).
     Pi = mi·g · Pi∥ = mi·g·sen θi · Ni = mi·g·cos θi
     Força motriz  Fd = P1∥ − P2∥
     Repouso:   se |Fd| ≤ μₑ·(N1+N2) o sistema não se move (a = 0). O atrito estático total vale |Fd|
                e é dividido entre os blocos na proporção do máximo de cada um (o problema é
                indeterminado; esta é a escolha mais simples).
     Movimento: atrito cinético μc·Ni em cada bloco, contra o movimento:
                a = (Fd ∓ μc·(N1+N2)) / (m1+m2)
     Tensão:    T = P1∥ + F1 − m1·a, em que F1 é o atrito em m₁ ao longo de +x.
   Estado: q = [x, v] (m e m/s).  Modos: 'idle' | 'run' | 'end' (um bloco chegou ao limite do plano).
   Linhas de dados dos gráficos: [t, x, v, Ec, ΔEp, ΔE]  (ΔE = Ec + ΔEp: nulo sem atrito, negativo com atrito).
   ===================================================================== */
(function(){
const {$,rk4,f2,arrow,css}=Sim, DT=1/240, P={}, cv=$('cv'), ctx=cv.getContext('2d'), R=Math.PI/180;
// Tela: proporção 0,62, altura entre 400 e 620 px (precisa de espaço para as setas).
const fit=Sim.fit(cv,.62,400,620);
let q=[0,0],t=0,mode='idle',paused=false,rows=[],acc=0,cnt=0,ph,a0,t0,Xp,Xm,gm,lastSt='';
Sim.interactive(cv,fit);
Sim.playbar(cv,()=>mode==='fly'?'run':mode==='land'?'end':mode,()=>paused);   // ▶/⏸ e reiniciar sobre o canvas (ver core.js)

// ---- Parâmetros ajustáveis (valor em P.<id>) ----
// Os rótulos aceitam HTML e LaTeX (MathJax): \( ... \), escrito aqui como '\\( ... \\)'.
// Altura H igual nos dois planos: L = H/sen θ cresceria sem limite, então os ângulos vão de 15° a 75°.
Sim.controls($('ctl'),[
 {id:'m1',label:'Massa \\(m_1\\) (plano esquerdo)',unit:'kg',min:.5,max:20,step:.5,val:15},
 {id:'m2',label:'Massa \\(m_2\\) (plano direito)',unit:'kg',min:.5,max:20,step:.5,val:3},
//  {id:'ang1',label:'Ângulo \\(\\theta_1\\) (plano esquerdo)',unit:'°',min:15,max:90,step:1,val:90},
//  {id:'ang2',label:'Ângulo \\(\\theta_2\\) (plano direito)',unit:'°',min:15,max:90,step:1,val:90},
//  {id:'mus',label:'Atrito estático \\(\\mu_e\\)',unit:'',min:0,max:1.2,step:.01,val:.53},
//  {id:'muk',label:'Atrito cinético \\(\\mu_c\\)',unit:'',min:0,max:1.2,step:.01,val:.36},
 {id:'g',label:'Gravidade \\(g\\)',unit:'m/s²',min:1,max:25,step:.1,val:9.8},
//  {id:'H',label:'Altura dos planos \\(H\\)',unit:'m',min:2,max:12,step:.5,val:6},
 {id:'spd',label:'Velocidade da animação',unit:'×',min:.1,max:2,step:.1,val:1}
],P,id=>{if(id!=='spd')reset()});
// $('c_atr').addEventListener('change',reset);
$('pl').addEventListener('change',e=>{const i=$('g');i.value=e.target.value;i.dispatchEvent(new Event('input'))});
const out=Sim.readouts($('ro'),[['t','\\(t\\) (s)'],['y','Deslocamento \\(y\\) (m)'],['v','\\(v\\) (m/s)'],['a','\\(a\\) (m/s²)'],['T','Tração \\(T\\) (N)'],['Fd','Força motriz \\(F_d\\) (N)']]);

// ---- Gráficos (colunas: 1=x, 2=v, 3=Ec, 4=ΔEp, 5=ΔE) ----
// Título e legenda ficam em HTML (com MathJax) acima de cada canvas: por isso title e name vazios e mt pequeno.
// As cores abaixo precisam coincidir com as da legenda no HTML.
const plots=[
 new Sim.Plot($('p1'),{title:'',mt:8,series:[{col:1,name:'',color:'--acc'}]}),
 new Sim.Plot($('p2'),{title:'',mt:8,series:[{col:2,name:'',color:'--vy'}]}),
 new Sim.Plot($('p3'),{title:'',mt:8,series:[{col:3,name:'',color:'--vx'},{col:4,name:'',color:'--vy'},{col:5,name:'',color:'--acc'}]})
];

// ---- Física ----
// Geometria com planos de MESMA ALTURA H: comprimentos L1 = H/sen α e L2 = H/sen β; bm = lado dos blocos (m).
const geo=()=>{const L1=10/Math.sin(90*R),L2=10/Math.sin(90*R);return{L1,L2,bm:.09*(L1+L2)/2}};
// Forças, atritos, aceleração e tensão para os parâmetros atuais. Para mudar o modelo (polia com massa,
// atrito diferente em cada plano, etc.), edite aqui. μc é limitado a μₑ.
function phys(){
 const a1=90*R,a2=90*R,s1=Math.sin(a1),c1=Math.cos(a1),s2=Math.sin(a2),c2=Math.cos(a2);
 const W1=P.m1*P.g,W2=P.m2*P.g,N1=W1*c1,N2=W2*c2,Pp1=W1*s1,Pp2=W2*s2;
 const atr=false;
//  $('c_atr').checked,mus=P.mus,muk=Math.min(P.muk,P.mus);
 const Fd=Pp1-Pp2,fm=0,stuck=atr&&Math.abs(Fd)<=fm,sg=Fd>=0?1:-1;
 let F1,F2,a;                       // F1, F2: atrito em cada bloco ao longo de +x
 if(stuck){const w1=fm>0?mus*N1/fm:.5;F1=-Fd*w1;F2=-Fd*(1-w1);a=0}
 else{const fk=atr?muk:0;F1=-sg*fk*N1;F2=-sg*fk*N2;a=(Fd+F1+F2)/(P.m1+P.m2)}
 const T=Pp1+F1-P.m1*a;
 return{s1,c1,s2,c2,W1,W2,N1,N2,Pp1,Pp2,atr,Fd,fm,stuck,F1,F2,a,T,still:Math.abs(a)<1e-9};
}
// EQUAÇÕES DO MOVIMENTO: dq/dt para q = [x, v] (a é constante, mas o RK4 permite acrescentar efeitos).
const deriv=z=>[z[1],ph.a];
const row=()=>{const ec=.5*(P.m1+P.m2)*q[1]*q[1],dep=-ph.Fd*q[0];return[t,q[0],q[1],ec,dep,ec+dep]};

// ---- Controle ----
// Recalcula: ph (forças), gm (geometria), Xp e Xm (deslocamentos máximos em cada sentido, antes de um bloco
// bater na polia ou na base; os planos têm comprimentos diferentes, então Xp ≠ Xm), a0 e t0 (aceleração e
// tempo até o limite SEM atrito, referência tracejada).
function upd(){
 ph=phys();gm=geo();
 const d10=gm.L1/2,d20=gm.L2/2,dmin=1.2*gm.bm;
 Xp=Math.min(gm.L1-gm.bm/2-d10,d20-dmin);Xm=Math.min(gm.L2-gm.bm/2-d20,d10-dmin);
 a0=ph.Fd/(P.m1+P.m2);t0=Math.abs(a0)>1e-9?Math.sqrt(2*(a0>0?Xp:Xm)/Math.abs(a0)):Infinity;
}
function reset(){upd();mode='idle';q=[0,0];t=0;rows=[];acc=0;paused=false;    lastSt = '';$('bp').textContent='Pausar'}
function launch(){reset();mode='run';rows=[row()]}
$('bl').onclick=launch;
$('bp').onclick=()=>{if(mode!=='run')return;paused=!paused;$('bp').textContent=paused?'Continuar':'Pausar'};
$('bc').onclick=reset;

// Passos fixos de DT. Termina quando x chega a Xp ou -Xm (interpolando o ponto final) ou, se o sistema
// não se move, após 6 s.
function step(dt){
 if(mode!=='run'||paused)return;
 acc+=dt*P.spd;
 while(acc>=DT){
  acc-=DT;
  const n=rk4(deriv,q,DT);
  if(n[0]>=Xp||n[0]<=-Xm){
   const lim=n[0]>0?Xp:-Xm,f=(lim-q[0])/(n[0]-q[0]);
   q=[lim,q[1]+f*(n[1]-q[1])];t+=f*DT;rows.push(row());mode='end';return;
  }
  q=n;t+=DT;if(++cnt%2===0)rows.push(row());
  if(ph.still&&t>=6){rows.push(row());mode='end';return}
 }
}

// Frase de situação mostrada sob o canvas (LaTeX; renderizada por MathJax quando o texto muda).
const M=s=>'\\('+s+'\\)',fm=Sim.fm;
function status(){
 const dir=ph.Fd>0?M('m_1')+' desce e '+M('m_2')+' sobe':M('m_2')+' desce e '+M('m_1')+' sobe';
 if(mode==='end'&&!ph.still)return'Um bloco chegou ao limite do plano após '+M('t='+fm(t)+'\\,\\mathrm{s}')+', com '+M('v='+fm(Math.abs(q[1]))+'\\,\\mathrm{m/s}')+'. Sem atrito seriam '+M(fm(t0)+'\\,\\mathrm{s}')+'.';
//  if(ph.stuck)return'Atrito estático segura o sistema: '+M('|P_{1\\parallel}-P_{2\\parallel}|='+fm(Math.abs(ph.Fd))+'\\,\\mathrm{N}\\le\\mu_e(N_1+N_2)='+fm(ph.fm)+'\\,\\mathrm{N}')+'.';
 if(ph.still)return'Equilíbrio: '+M('F_{g1\\parallel}=F_{g2\\parallel}')+', logo '+M('a=0')+' e '+M('T=F_{g1\\parallel}')+'.';
//  return(ph.atr?'Com atrito cinético: ':'Sem atrito: ')+dir+', '+M('a='+fm(Math.abs(ph.a))+'\\,\\mathrm{m/s^2}')+' e '+M('T='+fm(ph.T)+'\\,\\mathrm{N}')+'.';
}

// ---- Desenho ----
// Pixels (y para baixo). Plano esquerdo desce para a esquerda (d1), o direito para a direita (d2);
// n1 e n2 são as normais que saem de cada superfície. A polia fica deslocada do vértice para que a
// corda saia tangente a ela e paralela aos planos, passando pelo centro dos blocos.
function draw(){
 const C=css,W=fit.w,H=fit.h,{s1,c1,s2,c2}=ph,{L1,L2,bm}=gm,mL=105,mR=105,mT=120,mB=40,np=3;
 // Os dois planos têm a mesma altura P.H (vértice à mesma altura sobre o chão); largura total = H(cot α + cot β).
 const sc=Math.min((W-mL-mR)/(10*(c1/s1+c2/s2)),(H-mT-mB)/10);
 const EL=10*c1/s1*sc,Ax=mL+(W-mL-mR-EL-10*c2/s2*sc)/2+EL,yb=H-mB,Ay=yb-10*sc;
 const d1=[-c1,s1],n1=[-s1,-c1],d2=[c2,s2],n2=[s2,-c2],b=np*bm*sc;
 const BL=[Ax+d1[0]*L1*sc,Ay+d1[1]*L1*sc],BR=[Ax+d2[0]*L2*sc,Ay+d2[1]*L2*sc];
 ctx.clearRect(0,0,W,H);
 // planos e chão
 ctx.fillStyle=C('--ground');ctx.beginPath();ctx.moveTo(Ax,Ay);ctx.lineTo(BR[0],BR[1]);ctx.lineTo(BR[0],yb);ctx.lineTo(BL[0],yb);ctx.lineTo(BL[0],BL[1]);ctx.closePath();ctx.fill();
 ctx.strokeStyle=C('--ground');ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(12,yb);ctx.lineTo(W-12,yb);ctx.stroke();
//  ctx.strokeStyle=C('--ink');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(BL[0],BL[1]);ctx.lineTo(Ax,Ay);ctx.lineTo(BR[0],BR[1]);ctx.stroke();
 ctx.font=C('--normalfont');ctx.fillStyle=C('--mut');ctx.strokeStyle=C('--mut');ctx.lineWidth=1.5;
//  if(P.ang1>1){ctx.beginPath();ctx.arc(BL[0],BL[1],40,-90*R,0);ctx.stroke();ctx.textAlign='left'}
//  if(P.ang2>1){ctx.beginPath();ctx.arc(BR[0],BR[1],40,Math.PI,Math.PI+90*R);ctx.stroke();ctx.textAlign='right'}
 // polia (centro Pc tal que a corda fica à altura do centro dos blocos)
 const rp=Math.min(Math.max(100,0.75*b/2),b/2),k0=b/2-rp;
 let w=[0,-k0];
 if(Math.sin((90+90)*R)>.15){const det=n1[0]*n2[1]-n1[1]*n2[0];w=[(k0*n2[1]-n1[1]*k0)/det,(n1[0]*k0-k0*n2[0])/det]}
 const Pc=[Ax+w[0],Ay+w[1]],x=q[0];
 const C1=[Ax+d1[0]*(L1/2+x)*sc+n1[0]*b/2,Ay+d1[1]*(L1/2+x)*sc+n1[1]*b/2];
 const C2=[Ax+d2[0]*(L2/2-x)*sc+n2[0]*b/2,Ay+d2[1]*(L2/2-x)*sc+n2[1]*b/2];
 ctx.strokeStyle=C('--ink');ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(Ax,Ay);ctx.lineTo(Pc[0],Pc[1]);ctx.stroke();
 ctx.fillStyle=C('--card');ctx.lineWidth=2;ctx.beginPath();ctx.arc(Pc[0],Pc[1],rp,0,7);ctx.fill();ctx.stroke();
 ctx.fillStyle=C('--ink');ctx.lineWidth=1;ctx.beginPath();ctx.arc(Pc[0],Pc[1],3,0,7);ctx.fill();ctx.stroke();
 // corda: tangente à polia, paralela a cada plano; o arco passa pelo topo
 ctx.strokeStyle=C('--ink');ctx.lineWidth=2.5;ctx.beginPath();
 ctx.moveTo(C1[0],C1[1]);ctx.lineTo(Pc[0]+rp*n1[0],Pc[1]+rp*n1[1]);
 ctx.arc(Pc[0],Pc[1],rp,-Math.PI/2-90*R,-Math.PI/2+90*R);
 ctx.lineTo(C2[0],C2[1]);ctx.stroke();
 // blocos
 [[C1,-90*R,'m₁'],[C2,90*R,'m₂']].forEach(([c,r,l])=>{
  ctx.save();ctx.translate(c[0],c[1]);
  ctx.fillStyle=C('--ink');ctx.strokeStyle=C('--ink');ctx.lineWidth=2;ctx.fillRect(-1.5*b/(2*np),-1.5*b/(2*np),1.5*b/np,1.5*b/np);
  ctx.fillStyle=C('--sky');ctx.font=C('--normalfont');ctx.textAlign='center';ctx.fillText(l,0,4);ctx.restore();
 });
 // forças: escala fixa (o maior peso mede 70 px); as demais ficam proporcionais
 const k=70/Math.max(ph.W1,ph.W2),F=(lab,v,ox,oy,dx,dy,col,dash,wd)=>{
  ctx.setLineDash(dash?[5,4]:[]);arrow(ctx,ox,oy,dx,dy,col,wd||2.6);ctx.setLineDash([]);
  const len=Math.hypot(dx,dy);if(len<3)return;
  const ux=dx/len,uy=dy/len;ctx.fillStyle=col;ctx.font=C('--normalfont');
  ctx.textAlign=ux>.3?'left':ux<-.3?'right':'center';
  ctx.fillText(lab+'='+f2(v)+' N',ox+dx+ux*8,oy+dy+uy*12+(Math.abs(uy)<.3?4:0));
 };
 // e = sentido de +x em cada bloco (m₁: rampa abaixo; m₂: rampa acima); a corda puxa para o vértice (−d)
 [{c:C1,d:d1,n:n1,e:d1,W:ph.W1,N:ph.N1,Pp:ph.Pp1,Ff:ph.F1,m:P.m1,i:'₁'},
  {c:C2,d:d2,n:n2,e:[-d2[0],-d2[1]],W:ph.W2,N:ph.N2,Pp:ph.Pp2,Ff:ph.F2,m:P.m2,i:'₂'}].forEach(B=>{
  const[ox,oy]=B.c;
  if($('c_f').checked){
    F('F_g'+B.i,B.W,ox,oy,0,B.W*k,C('--a'));
    F('N'+B.i,B.N,ox,oy,B.n[0]*B.N*k,B.n[1]*B.N*k,C('--acc'));
    F('f'+B.i,Math.abs(B.Ff),ox,oy,B.e[0]*B.Ff*k,B.e[1]*B.Ff*k,C('--vx'));
    F('T',ph.T,ox,oy,-B.d[0]*ph.T*k,-B.d[1]*ph.T*k,C('--vy'));
    if($('c_res').checked){const fr=B.m*ph.a;F('F'+B.i,Math.abs(fr),ox+B.n[0]*(b/2+14),oy+B.n[1]*(b/2+14),B.e[0]*fr*k,B.e[1]*fr*k,C('--ink'),false,3.4)}
  }
 });
 // leituras, texto e gráficos
 out('t',t);out('y',q[0]);out('v',q[1]);out('a',ph.a);out('T',ph.T);out('Fd',ph.Fd);
 {const st=status();if(st!==lastSt){lastSt=st;$('cmp').textContent=st;Sim.math($('cmp'))}}   // só re-renderiza quando o texto muda
 const id=tt=>{const u=Math.min(tt,t0),xx=.5*a0*u*u,v=a0*u,ec=.5*(P.m1+P.m2)*v*v,dep=-ph.Fd*xx;return[tt,xx,v,ec,dep,ec+dep]};
 const ta=!ph.still?Math.sqrt(2*(ph.a>0?Xp:Xm)/Math.abs(ph.a)):0,tf=Math.min(Math.max(ta,isFinite(t0)?t0:0,1),25);
 plots.forEach(p=>p.draw(rows,id,tf));
}
reset();
Sim.loop(dt=>{step(dt);draw()});
})();
