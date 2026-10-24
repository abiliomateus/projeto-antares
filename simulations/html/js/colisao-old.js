/* =====================================================================
   colisao.js: colisão entre duas partículas (discos lisos) em duas dimensões. Depende de core.js.

   Organização: 1. Configuração · 2. Interface · 3. Física (setup, collide) · 4. Controle ·
                5. step · 6. status · 7. draw · 8. Loop   (mesma estrutura dos outros arquivos)

   Modelo:
     Sem forças externas, o movimento é retilíneo uniforme: não há integrador. O instante do contato é
     calculado exatamente (equação do 2º grau) dentro de cada passo de DT = 1/240 s.
     Discos lisos: o impulso J age só ao longo da NORMAL n (da partícula 1 para a 2, na linha dos centros);
     a componente TANGENCIAL da velocidade de cada partícula não muda.
       vrn = (v2 − v1)·n  (negativo na aproximação)      μ = m1·m2/(m1+m2)
       J = −(1+e)·μ·vrn      v1' = v1 − (J/m1)·n      v2' = v2 + (J/m2)·n
     e = coeficiente de restituição (1 = elástica, 0 = perfeitamente inelástica).
     Perda de energia cinética: ΔEc = −½·μ·(1−e²)·vrn².   O momento total sempre se conserva.
   Preparação da cena (setup): a partir das velocidades e do parâmetro de impacto b (distância
   perpendicular entre a trajetória relativa e a linha dos centros), as posições iniciais são escolhidas
   para o choque ocorrer em t = th, com o centro de massa (CM) na origem nesse instante.
   Modos: 'idle' (pré-visualização, com o choque previsto) | 'run' | 'end'.
   Linhas de dados dos gráficos: [t, |v1|, |v2|, px, py, |p|, Ec1, Ec2, Ec total].
   ===================================================================== */
(function(){
const {$,f2,arrow,css}=Sim, DT=1/240, P={}, cv=$('cv'), ctx=cv.getContext('2d'), R=Math.PI/180;
const fit=Sim.fit(cv,.6,380,600);
let A,B,t=0,mode='idle',paused=false,rows=[],tr=[],rec=null,acc=0,cnt=0,su;

// ---- Parâmetros ajustáveis (valor em P.<id>) ----
Sim.controls($('ctl'),[
 {id:'m1',label:'Massa \\(m_1\\)',unit:'kg',min:.5,max:10,step:.5,val:2},
 {id:'m2',label:'Massa \\(m_2\\)',unit:'kg',min:.5,max:10,step:.5,val:1},
 {id:'v1',label:'Velocidade de \\(m_1\\)',unit:'m/s',min:0,max:10,step:.5,val:5},
 {id:'ang1',label:'Direção de \\(v_1\\)',unit:'°',min:-180,max:180,step:5,val:0},
 {id:'v2',label:'Velocidade de \\(m_2\\)',unit:'m/s',min:0,max:10,step:.5,val:0},
 {id:'ang2',label:'Direção de \\(v_2\\)',unit:'°',min:-180,max:180,step:5,val:180},
 {id:'theta1',label:'Ângulo de desvio de \\(m_1\\)',unit:'°',min:0,max:90,step:1,val:45},
 {id:'e',label:'Restituição \\(e\\)',unit:'',min:0,max:1,step:.05,val:1},
 {id:'spd',label:'Velocidade da animação',unit:'×',min:.1,max:2,step:.1,val:1}
],P,id=>{if(id!=='spd')reset()});
const out=Sim.readouts($('ro'),[['t','Tempo (s)'],['p','|p| total (kg·m/s)'],['ec','Ec total (J)'],['dec','ΔEc (J)'],['v1','|v₁| (m/s)'],['v2','|v₂| (m/s)'],['a1','direção de v₁ (°)'],['a2','direção de v₂ (°)']]);

// ---- Gráficos (colunas: 1=|v1| 2=|v2| 3=px 4=py 5=|p| 6=Ec1 7=Ec2 8=Ec) ----
const plots=[
 new Sim.Plot($('p1'),{title:'velocidades em m/s',series:[{col:1,name:'|v₁|',color:'--acc'},{col:2,name:'|v₂|',color:'--vx'}]}),
 new Sim.Plot($('p2'),{title:'momento linear total em kg·m/s',series:[{col:3,name:'pₓ',color:'--vx'},{col:4,name:'p_y',color:'--vy'},{col:5,name:'|p|',color:'--acc'}]}),
 new Sim.Plot($('p3'),{title:'energia cinética em J',series:[{col:6,name:'Ec₁',color:'--acc'},{col:7,name:'Ec₂',color:'--vx'},{col:8,name:'Ec total',color:'--vy'}]})
];

// ---- Física ----
const rad=m=>.25*Math.sqrt(m)+.25;   // raio (m) em função da massa; troque aqui para outra relação
// Calcula a cena: velocidades, posições iniciais, instante e geometria do choque previsto e velocidades finais.
function setup(){
 const M=P.m1+P.m2,r1=rad(P.m1),r2=rad(P.m2),Rr=r1+r2,a1=P.ang1*R,a2=P.ang2*R,b=(rad(P.m1)+rad(P.m2))*Math.cos(P.theta1*Math.PI/180.);
 const v1=[P.v1*Math.cos(a1),P.v1*Math.sin(a1)],v2=[P.v2*Math.cos(a2),P.v2*Math.sin(a2)];
 const vr=[v2[0]-v1[0],v2[1]-v1[1]],vm=Math.hypot(vr[0],vr[1]),approach=vm>=.2;
 const uh=approach?[vr[0]/vm,vr[1]/vm]:[1,0],D=Math.max(1.6*vm,4),hit=approach&&Math.abs(b)<Rr;
 const th=hit?(D-Math.sqrt(Rr*Rr-b*b))/vm:(approach?D/vm:3);          // instante do contato (ou da maior aproximação)
 const rel0=[-uh[0]*D-uh[1]*b,-uh[1]*D+uh[0]*b];                      // posição inicial de 2 relativa a 1
 const vcm=[(P.m1*v1[0]+P.m2*v2[0])/M,(P.m1*v1[1]+P.m2*v2[1])/M],pcm0=[-vcm[0]*th,-vcm[1]*th];
 const p1=[pcm0[0]-rel0[0]*P.m2/M,pcm0[1]-rel0[1]*P.m2/M],p2=[pcm0[0]+rel0[0]*P.m1/M,pcm0[1]+rel0[1]*P.m1/M];
 const c1=[p1[0]+v1[0]*th,p1[1]+v1[1]*th],c2=[p2[0]+v2[0]*th,p2[1]+v2[1]*th];   // centros no contato
 let n=[1,0],u1=v1,u2=v2;
 if(hit){
  const dx=c2[0]-c1[0],dy=c2[1]-c1[1],d=Math.hypot(dx,dy);n=[dx/d,dy/d];
  const vrn=(v2[0]-v1[0])*n[0]+(v2[1]-v1[1])*n[1],J=-(1+P.e)*vrn*P.m1*P.m2/M;
  u1=[v1[0]-J/P.m1*n[0],v1[1]-J/P.m1*n[1]];u2=[v2[0]+J/P.m2*n[0],v2[1]+J/P.m2*n[1]];
 }
 return{M,r1,r2,Rr,v1,v2,vcm,pcm0,p1,p2,c1,c2,n,u1,u2,th,hit,approach,b,tEnd:th+2.5};
}
// Aplica o impulso na normal (estado atual de A e B) e registra o evento em `rec`.
function collide(){
 const dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy),nx=dx/d,ny=dy/d,M=P.m1+P.m2;
 const vrn=(B.vx-A.vx)*nx+(B.vy-A.vy)*ny,J=-(1+P.e)*vrn*P.m1*P.m2/M;
 const px0=P.m1*A.vx+P.m2*B.vx,py0=P.m1*A.vy+P.m2*B.vy,e0=.5*P.m1*(A.vx**2+A.vy**2)+.5*P.m2*(B.vx**2+B.vy**2);
 const c1=[A.x,A.y],c2=[B.x,B.y];
 A.vx-=J/P.m1*nx;A.vy-=J/P.m1*ny;B.vx+=J/P.m2*nx;B.vy+=J/P.m2*ny;
 const px1=P.m1*A.vx+P.m2*B.vx,py1=P.m1*A.vy+P.m2*B.vy,e1=.5*P.m1*(A.vx**2+A.vy**2)+.5*P.m2*(B.vx**2+B.vy**2);
 rec={t,c1,c2,n:[nx,ny],e0,e1,dp:Math.hypot(px1-px0,py1-py0)};
}
const row=()=>{const va=Math.hypot(A.vx,A.vy),vb=Math.hypot(B.vx,B.vy),px=P.m1*A.vx+P.m2*B.vx,py=P.m1*A.vy+P.m2*B.vy,ea=.5*P.m1*va*va,eb=.5*P.m2*vb*vb;return[t,va,vb,px,py,Math.hypot(px,py),ea,eb,ea+eb]};
const record=()=>{rows.push(row());tr.push([t,A.x,A.y,B.x,B.y])};

// ---- Controle ----
function reset(){
 su=setup();
 A={x:su.p1[0],y:su.p1[1],vx:su.v1[0],vy:su.v1[1]};B={x:su.p2[0],y:su.p2[1],vx:su.v2[0],vy:su.v2[1]};
 t=0;rec=null;rows=[];tr=[];acc=0;paused=false;mode='idle';$('bp').textContent='Pausar';
}
function launch(){reset();mode='run';record()}
$('bl').onclick=launch;
$('bp').onclick=()=>{if(mode!=='run')return;paused=!paused;$('bp').textContent=paused?'Continuar':'Pausar'};
$('bc').onclick=reset;

// Passos fixos de DT. Em cada passo, verifica se o contato ocorre dentro dele: resolve |d + Δv·τ| = r1+r2
// e, se 0 ≤ τ ≤ DT, avança até o contato, aplica o impulso e avança o resto do passo.
function step(dt){
 if(mode!=='run'||paused)return;
 acc+=dt*P.spd;
 while(acc>=DT){
  acc-=DT;
  const dx=B.x-A.x,dy=B.y-A.y,dvx=B.vx-A.vx,dvy=B.vy-A.vy;
  const a=dvx*dvx+dvy*dvy,bq=dx*dvx+dy*dvy,c=dx*dx+dy*dy-su.Rr*su.Rr;
  let tau=-1;
  if(a>1e-12&&bq<0){const disc=bq*bq-a*c;if(disc>=0){const x=(-bq-Math.sqrt(disc))/a;if(x>=0&&x<=DT)tau=x}}
  const mv=h=>{A.x+=A.vx*h;A.y+=A.vy*h;B.x+=B.vx*h;B.y+=B.vy*h;t+=h};
  if(tau>=0){mv(tau);collide();mv(DT-tau)}else mv(DT);
  if(++cnt%2===0)record();
  if(t>=su.tEnd){record();mode='end';return}
 }
}

// Frase de situação mostrada sob o canvas.
function status(){
 if(!su.approach)return'Velocidade relativa quase nula: as partículas não se aproximam.';
 if(!su.hit)return'Sem colisão: |b| = '+f2(Math.abs(su.b))+' m ≥ r₁+r₂ = '+f2(su.Rr)+' m. As partículas passam sem interagir.';
 if(rec)return'Colisão em t = '+f2(rec.t)+' s. Ec: '+f2(rec.e0)+' → '+f2(rec.e1)+' J (ΔEc = '+f2(rec.e1-rec.e0)+' J). Momento total conservado: |Δp| = '+f2(rec.dp)+'.';
 const E=(u,w)=>.5*P.m1*(u[0]**2+u[1]**2)+.5*P.m2*(w[0]**2+w[1]**2);
 return'Colisão prevista em t = '+f2(su.th)+' s, com normal a '+f2((Math.atan2(su.n[1],su.n[0])/R+360)%360)+'°. Perda prevista de Ec: '+f2(E(su.v1,su.v2)-E(su.u1,su.u2))+' J.';
}

// ---- Desenho ----
// Mundo em metros (y para cima); X() e Y() convertem para pixels. A janela é calculada a partir das posições
// em t = 0, no choque e no fim. Com "Referencial do CM", subtrai-se do desenho a posição e a velocidade do CM.
function draw(){
 const C=css,W=fit.w,H=fit.h,fr=$('c_fr').checked,vs=9;
 const cm=tt=>[su.pcm0[0]+su.vcm[0]*tt,su.pcm0[1]+su.vcm[1]*tt],off=tt=>fr?cm(tt):[0,0];
 const vf=fr?su.vcm:[0,0];
 const pos=(i,tt)=>{const o=off(tt),s=tt<=su.th?[i?su.p2:su.p1,i?su.v2:su.v1,0]:[i?su.c2:su.c1,i?su.u2:su.u1,su.th];
  return[s[0][0]+s[1][0]*(tt-s[2])-o[0],s[0][1]+s[1][1]*(tt-s[2])-o[1]]};
 let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
 [0,su.th,su.tEnd].forEach(tt=>[0,1].forEach(i=>{const p=pos(i,tt);x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])}));
 const pad=Math.max(su.r1,su.r2)+1.2,bw=Math.max(x1-x0+2*pad,8),bh=Math.max(y1-y0+2*pad,5),cx=(x0+x1)/2,cy=(y0+y1)/2;
 const sc=Math.min((W-30)/bw,(H-30)/bh),X=x=>W/2+(x-cx)*sc,Y=y=>H/2-(y-cy)*sc;
 ctx.clearRect(0,0,W,H);
 // grade
 const st=Sim.nice(Math.max(bw,bh)/9);ctx.lineWidth=1;ctx.strokeStyle=C('--grid');
 for(let g=Math.ceil((cx-W/2/sc)/st)*st;g<=cx+W/2/sc;g+=st){ctx.beginPath();ctx.moveTo(X(g),0);ctx.lineTo(X(g),H);ctx.stroke()}
 for(let g=Math.ceil((cy-H/2/sc)/st)*st;g<=cy+H/2/sc;g+=st){ctx.beginPath();ctx.moveTo(0,Y(g));ctx.lineTo(W,Y(g));ctx.stroke()}
 ctx.font='11px system-ui,sans.serif';ctx.fillStyle=C('--mut');ctx.textAlign='left';ctx.fillText('grade: '+st+' m',8,H-8);
 const lab=(s,x,y,col,al)=>{ctx.fillStyle=col;ctx.font='600 12px system-ui,sans.serif';ctx.textAlign=al||'left';ctx.fillText(s,x,y)};
 const arr=(x,y,vx,vy,col,w,dash,tx)=>{ctx.setLineDash(dash?[5,4]:[]);arrow(ctx,X(x),Y(y),vx*vs,-vy*vs,col,w);ctx.setLineDash([]);
  if(tx&&Math.hypot(vx,vy)*vs>6)lab(tx,X(x)+vx*vs+(vx>=0?6:-6),Y(y)-vy*vs+4,col,vx>=0?'left':'right')};
 // eixo do choque: normal (linha dos centros) e tangente (plano de contato)
//  const ct=rec||(su.hit?{t:su.th,c1:su.c1,c2:su.c2,n:su.n}:null);
//  if(ct&&$('c_ax').checked){
//   const o=off(ct.t),n=ct.n,tg=[-n[1],n[0]],a=[ct.c1[0]-o[0],ct.c1[1]-o[1]],cp=[a[0]+n[0]*su.r1,a[1]+n[1]*su.r1],ex=1.3;
//   ctx.setLineDash([6,5]);ctx.strokeStyle=C('--ghost');ctx.lineWidth=1.3;ctx.beginPath();
//   ctx.moveTo(X(a[0]-n[0]*ex),Y(a[1]-n[1]*ex));ctx.lineTo(X(a[0]+n[0]*(su.Rr+ex)),Y(a[1]+n[1]*(su.Rr+ex)));
//   ctx.moveTo(X(cp[0]-tg[0]*(su.Rr+ex)),Y(cp[1]-tg[1]*(su.Rr+ex)));ctx.lineTo(X(cp[0]+tg[0]*(su.Rr+ex)),Y(cp[1]+tg[1]*(su.Rr+ex)));
//   ctx.stroke();ctx.setLineDash([]);
//   lab('n',X(a[0]+n[0]*(su.Rr+ex))+6,Y(a[1]+n[1]*(su.Rr+ex)),C('--mut'));lab('t',X(cp[0]+tg[0]*(su.Rr+ex))+6,Y(cp[1]+tg[1]*(su.Rr+ex)),C('--mut'));
//  }
 // fantasmas: posições e velocidades previstas no contato (somem após o choque)
 if(su.hit&&!rec){
  const o=off(su.th);
  [[su.c1,su.r1,su.u1,C('--vy')],[su.c2,su.r2,su.u2,C('--vx')]].forEach(([c,r,u,col])=>{
   const gx=c[0]-o[0],gy=c[1]-o[1];ctx.setLineDash([4,4]);ctx.strokeStyle=col;ctx.globalAlpha=.55;ctx.lineWidth=1.5;
   ctx.beginPath();ctx.arc(X(gx),Y(gy),r*sc,0,7);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
   if($('c_v').checked)arr(gx,gy,u[0]-vf[0],u[1]-vf[1],col,2,true);
  });
 }
 // rastros
 if($('c_tr').checked&&tr.length>1)[[1,2,C('--vy')],[3,4,C('--vx')]].forEach(([ix,iy,col])=>{
  ctx.strokeStyle=col;ctx.lineWidth=2;ctx.globalAlpha=.6;ctx.beginPath();
  tr.forEach((r,j)=>{const o=off(r[0]);j?ctx.lineTo(X(r[ix]-o[0]),Y(r[iy]-o[1])):ctx.moveTo(X(r[ix]-o[0]),Y(r[iy]-o[1]))});ctx.stroke();ctx.globalAlpha=1;
 });
 // centro de massa
 const oc=off(t),cmp=cm(t),cmx=cmp[0]-oc[0],cmy=cmp[1]-oc[1];
 if($('c_cm').checked){
  ctx.strokeStyle=C('--ink');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(X(cmx)-6,Y(cmy));ctx.lineTo(X(cmx)+6,Y(cmy));ctx.moveTo(X(cmx),Y(cmy)-6);ctx.lineTo(X(cmx),Y(cmy)+6);ctx.stroke();
  lab('CM',X(cmx)+8,Y(cmy)-8,C('--ink'));
  if(!fr)arr(cmx,cmy,su.vcm[0],su.vcm[1],C('--ink'),3.2,false,'v_cm');
 }
 // partículas e velocidades
 [[A,su.r1,C('--vy'),'1','v_1'],[B,su.r2,C('--vx'),'2','v_2']].forEach(([p,r,col,nm,vl])=>{
  ctx.fillStyle=col;ctx.globalAlpha=1;ctx.beginPath();ctx.arc(X(p.x-oc[0]),Y(p.y-oc[1]),r*sc,0,7);ctx.fill();ctx.globalAlpha=1;
  ctx.strokeStyle=col;ctx.lineWidth=2.2;ctx.stroke();
  if($('c_v').checked)arr(p.x-oc[0],p.y-oc[1],p.vx-vf[0],p.vy-vf[1],col,2.8,false,vl);lab(nm,X(p.x-oc[0]),Y(p.y-oc[1])+4,C('--sky'),'center');
 });
 // leituras, texto e gráficos
 const r0=row(),e00=.5*P.m1*P.v1*P.v1+.5*P.m2*P.v2*P.v2;
 out('t',t);out('p',r0[5]);out('ec',r0[8]);out('dec',r0[8]-e00);out('v1',r0[1]);out('v2',r0[2]);
 out('a1',(Math.atan2(A.vy,A.vx)/R+360)%360);out('a2',(Math.atan2(B.vy,B.vx)/R+360)%360);
 $('cmp').textContent=status();
 plots.forEach(p=>p.draw(rows,null,su.tEnd));
}
reset();
Sim.loop(dt=>{step(dt);draw()});
})();
