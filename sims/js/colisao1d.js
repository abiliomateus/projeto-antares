/* =====================================================================
   colisao1d.js: colisão unidimensional entre dois blocos (carrinhos num trilho), com coeficiente de restituição e,
   barras de antes e depois para o momento e a energia, e troca para o referencial do centro de massa (CM).
   Depende de core.js.

   Organização: 1. Configuração · 2. Interface · 3. Física (setup, pos) · 4. Controle · 5. step · 6. status ·
                7. draw (trilho, barras) · 8. Loop   (mesma estrutura dos outros arquivos)

   Modelo: o bloco 1 (massa m1, à esquerda) tem velocidade v1 e o bloco 2 (m2, à direita) tem velocidade v2; os dois
   andam sem atrito. Só há colisão se v1 > v2. Os blocos têm largura w = 0,5·∛m (m em kg), e o contato acontece
   quando a face direita do 1 encontra a face esquerda do 2, em x = 0, no instante t = TC. Sem forças externas, o movimento
   é uniforme (não há integrador): o choque é um evento em t = TC.
   Colisão: o momento total se conserva e a restituição define a velocidade relativa depois do choque,
         m1·v1 + m2·v2 = m1·u1 + m2·u2,     e = (u2 − u1)/(v1 − v2)     (0 ≤ e ≤ 1)
     ⇒  u1 = [(m1 − e·m2)·v1 + (1 + e)·m2·v2]/M,    u2 = [(m2 − e·m1)·v2 + (1 + e)·m1·v1]/M,    M = m1 + m2.
     e = 1: elástica (Ec se conserva); e = 0: perfeitamente inelástica (os blocos seguem juntos);
     ΔEc = −½·μ·(1 − e²)·(v1 − v2)²,  com μ = m1·m2/M.
     Velocidade do CM: v_cm = (m1·v1 + m2·v2)/M (constante). No referencial do CM, u_i' = −e·v_i' (as velocidades invertem).
   Referencial do CM (caixa): só muda o desenho, subtraindo a posição e a velocidade do CM; a física é a mesma.
   Modos: 'idle' (pré-visualização) | 'run' | 'end' (2,5 s depois do choque).
   Linhas de dados dos gráficos: [t, x1, x2, v1, v2, p1, p2, p, K1, K2, K].
   ===================================================================== */
(function(){
const {$,f2,arrow,css}=Sim, P={}, TC=2, TEND=TC+2.5, DT=1/240, cv=$('cv'), ctx=cv.getContext('2d');
const bcv=[$('b1'),$('b2')], fitb=bcv.map(c=>Sim.fit(c,.62,210,300)), bctx=bcv.map(c=>c.getContext('2d'));
const fit=Sim.fit(cv,.42,270,420);
Sim.interactive(cv,fit);   // zoom e deslocamento do canvas (ver core.js)
Sim.playbar(cv,()=>mode,()=>paused);   // ▶/⏸ e reiniciar sobre o canvas (ver core.js)
let t=0,mode='idle',paused=false,col=false,rows=[],acc=0,cnt=0,lastSt='',su;

// ---- Parâmetros ajustáveis (valor em P.<id>) ----
// Os rótulos aceitam HTML e LaTeX (MathJax): \( ... \), escrito aqui como '\\( ... \\)'.
Sim.controls($('ctl'),[
 {id:'m1',label:'Massa \\(m_1\\)',unit:'kg',min:.1,max:100,step:.1,val:2},
 {id:'m2',label:'Massa \\(m_2\\)',unit:'kg',min:.1,max:100,step:.1,val:1},
 {id:'v1',label:'Velocidade \\(v_1\\)',unit:'m/s',min:-10,max:10,step:.5,val:4},
 {id:'v2',label:'Velocidade \\(v_2\\)',unit:'m/s',min:-10,max:10,step:.5,val:-1},
 {id:'e',label:'Restituição \\(e\\) (0 = grudam)',unit:'',min:0,max:1,step:.05,val:1},
 {id:'spd',label:'Velocidade da animação',unit:'×',min:.1,max:2,step:.1,val:1}
],P,id=>{if(id!=='spd')reset()});
const out=Sim.readouts($('ro'),[['t','\\(t\\) (s)'],['v1','\\(v_1\\) (m/s)'],['v2','\\(v_2\\) (m/s)'],['p','\\(p\\) (kg·m/s)'],['K','\\(K\\) (J)'],['dK','\\(\\Delta K\\) (J)'],['vcm','\\(v_{cm}\\) (m/s)'],['xcm','\\(x_{cm}\\) (m)']]);

Sim.speedbar(cv, 'spd');

// ---- Gráficos (colunas: 1=x1 2=x2 3=v1 4=v2 5=p1 6=p2 7=p 8=K1 9=K2 10=K) ----
// Título e legenda ficam em HTML (com MathJax) acima de cada canvas; as cores precisam coincidir com as de lá.
const plots=[
 new Sim.Plot($('p1'),{title:'',mt:8,series:[{col:1,name:'',color:'--acc'},{col:2,name:'',color:'--vx'}]}),
 new Sim.Plot($('p2'),{title:'',mt:8,series:[{col:3,name:'',color:'--acc'},{col:4,name:'',color:'--vx'}]}),
 new Sim.Plot($('p3'),{title:'',mt:8,series:[{col:5,name:'',color:'--acc'},{col:6,name:'',color:'--vx'},{col:7,name:'',color:'--ink'}]}),
 new Sim.Plot($('p4'),{title:'',mt:8,series:[{col:8,name:'',color:'--acc'},{col:9,name:'',color:'--vx'},{col:10,name:'',color:'--ink'}]})
];

// ---- Física ----
// Velocidades depois do choque (u1, u2), larguras dos blocos, posições iniciais e grandezas de antes e depois (para as barras):
// pb/pa = momento de [bloco 1, bloco 2, sistema] antes/depois; Kb/Ka = energia cinética. Sem colisão (v1 ≤ v2), os blocos
// seguem como estão, com folga de 2 m.
function setup(){
 const M=P.m1+P.m2,w1=1.5,w2=1.5,v1=P.v1,v2=P.v2,e=P.e,hit=v1>v2+1e-9;
 const u1=hit?((P.m1-e*P.m2)*v1+(1+e)*P.m2*v2)/M:v1,u2=hit?((P.m2-e*P.m1)*v2+(1+e)*P.m1*v1)/M:v2;
 const x10=hit?-w1/2-v1*TC:-w1/2-2,x20=hit?w2/2-v2*TC:w2/2,vcm=(P.m1*v1+P.m2*v2)/M,xcm0=(P.m1*x10+P.m2*x20)/M;
 const pr=(a,b)=>[P.m1*a,P.m2*b,P.m1*a+P.m2*b],kr=(a,b)=>[.5*P.m1*a*a,.5*P.m2*b*b,.5*P.m1*a*a+.5*P.m2*b*b];
 return{M,mu:P.m1*P.m2/M,w1,w2,v1,v2,u1,u2,e,hit,x10,x20,vcm,xcm0,pb:pr(v1,v2),pa:pr(u1,u2),Kb:kr(v1,v2),Ka:kr(u1,u2)};
}
// Posições dos centros e velocidades [x1, v1, x2, v2] no instante tt, antes (after = false) ou depois do choque.
// Depois do choque, as faces se encontram em x = 0 e cada bloco segue com sua nova velocidade.
const pos=(tt,after)=>(!su.hit||tt<TC||!after)?[su.x10+su.v1*tt,su.v1,su.x20+su.v2*tt,su.v2]:[-su.w1/2+su.u1*(tt-TC),su.u1,su.w2/2+su.u2*(tt-TC),su.u2];
const xcm=tt=>su.xcm0+su.vcm*tt;
const row=()=>{const s=pos(t,col),x1=s[0],v1=s[1],x2=s[2],v2=s[3],p1=P.m1*v1,p2=P.m2*v2,k1=.5*P.m1*v1*v1,k2=.5*P.m2*v2*v2;return[t,x1,x2,v1,v2,p1,p2,p1+p2,k1,k2,k1+k2]};
const record=()=>rows.push(row());

// ---- Controle ----
function reset(){su=setup();t=0;col=false;rows=[];acc=0;cnt=0;paused=false;mode='idle';$('bp').textContent='Pausar'}
function launch(){reset();mode='run';record()}
function end(){record();mode='end'}
$('bl').onclick=launch;
$('bp').onclick=()=>{if(mode!=='run')return;paused=!paused;$('bp').textContent=paused?'Continuar':'Pausar'};
$('bc').onclick=reset;

// Passos fixos de DT. No instante TC grava dois pontos (um antes e um depois do choque), o que dá o "salto" nos gráficos.
function step(dt){
 if(mode!=='run'||paused)return;
 acc+=dt*P.spd;
 while(acc>=DT){
  acc-=DT;
  if(su.hit&&!col&&t+DT>=TC){t=TC;record();col=true;record()}
  t+=DT;if(++cnt%2===0)record();
  if(t>=TEND){t=TEND;end();return}
 }
}

// Frase de situação mostrada sob o canvas (LaTeX; renderizada por MathJax quando o texto muda).
const M_=x=>'\\('+x+'\\)',fm=Sim.fm,MS='\\,\\mathrm{m/s}',J='\\,\\mathrm{J}',KP='\\,\\mathrm{kg\\,m/s}';
function status(){
 if(!su.hit)return'Sem colisão: '+M_('v_1\\le v_2')+', então o bloco 1 não alcança o bloco 2.';
 const tipo=su.e>=.999?'elástica ('+M_('K')+' se conserva)':su.e<=.001?'perfeitamente inelástica (os blocos seguem juntos)':'parcialmente inelástica';
 if(col)return'Colisão '+tipo+' em '+M_('t='+fm(TC)+'\\,\\mathrm{s}')+'. Momento: '+M_('p='+fm(su.pb[2])+KP+'\\to '+fm(su.pa[2])+KP)+' (conservado). Energia: '+M_('K='+fm(su.Kb[2])+J+'\\to '+fm(su.Ka[2])+J)+' ('+M_('\\Delta K='+fm(su.Ka[2]-su.Kb[2])+J)+'). Restituição medida: '+M_('(u_2-u_1)/(v_1-v_2)='+fm((su.u2-su.u1)/(su.v1-su.v2)))+'.';
 return'Colisão '+tipo+' prevista em '+M_('t='+fm(TC)+'\\,\\mathrm{s}')+', em '+M_('x=0')+'. Depois do choque: '+M_('u_1='+fm(su.u1)+MS)+' e '+M_('u_2='+fm(su.u2)+MS)+'. Perda de energia prevista: '+M_('\\Delta K=-\\tfrac{1}{2}\\mu(1-e^2)(v_1-v_2)^2='+fm(su.Ka[2]-su.Kb[2])+J)+'. Velocidade do CM: '+M_('v_{cm}='+fm(su.vcm)+MS)+'.';
}

// ---- Desenho ----
// Trilho: mundo em metros na horizontal, y em pixels. A janela cobre os blocos em t = 0, no choque e no fim. Com
// "Referencial do CM", subtrai-se de todas as posições e velocidades as do CM. Velocidades: 7 px por m/s (no máximo 140 px).
function draw(){
 const C=css,W=fit.w,H=fit.h,fy=Math.round(H*.68),bh=Math.max(32,Math.min(50,H*.10)),cmf=$('c_cm').checked,off=tt=>cmf?xcm(tt):0,vo=cmf?su.vcm:0;
 let x0=1e9,x1=-1e9;
 [[0,false],[TC,false],[TC,true],[TEND,true]].forEach(([tt,af])=>{const s=pos(tt,af),o=off(tt);x0=Math.min(x0,s[0]-su.w1/2-o,s[2]-su.w2/2-o);x1=Math.max(x1,s[0]+su.w1/2-o,s[2]+su.w2/2-o)});
 const pad=Math.max(1.2,(x1-x0)*.06);x0-=pad;x1+=pad;
 const sc=(W-30)/(x1-x0),X=x=>15+(x-x0)*sc,o=off(t),s=pos(t,col);
 ctx.clearRect(0,0,W,H);
 const lab=(q,x,y,c,al)=>{ctx.fillStyle=c;ctx.font='600 12px system-ui,sans-serif';ctx.textAlign=al||'left';ctx.fillText(q,x,y)};
 // trilho com régua (metros; no referencial do CM, relativos ao CM)
 ctx.strokeStyle=C('--ground');ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(8,fy);ctx.lineTo(W-8,fy);ctx.stroke();
 const stp=Sim.nice((x1-x0)/8);ctx.lineWidth=1;ctx.font='11px system-ui,sans-serif';ctx.fillStyle=C('--mut');ctx.strokeStyle=C('--mut');
 for(let g=Math.ceil(x0/stp)*stp;g<=x1;g+=stp){ctx.beginPath();ctx.moveTo(X(g),fy+3);ctx.lineTo(X(g),fy+9);ctx.stroke();ctx.textAlign='center';ctx.fillText(+g.toFixed(6),X(g),fy+22)}
 lab(cmf?"x′ (m), relativo ao CM":'x (m)',W-10,fy+38,C('--mut'),'right');
 // ponto do choque (só no referencial do laboratório)
 if(!cmf){ctx.setLineDash([4,4]);ctx.strokeStyle=C('--ghost');ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(X(0),fy-bh-50);ctx.lineTo(X(0),fy);ctx.stroke();ctx.setLineDash([]);lab('contato (x = 0)',X(0),fy-bh-56,C('--mut'),'center')}
 // blocos e velocidades
 [[s[0],s[1],su.w1,C('--vy'),'m₁','v₁'],[s[2],s[3],su.w2,C('--vx'),'m₂','v₂']].forEach(([x,v,w,col_,nm,vn])=>{
  const xl=X(x-w/2-o),wp=w*sc;
  ctx.fillStyle=col_;ctx.globalAlpha=.2;ctx.fillRect(xl,fy-bh,wp,bh);ctx.globalAlpha=1;ctx.strokeStyle=col_;ctx.lineWidth=2;ctx.strokeRect(xl,fy-bh,wp,bh);
  lab(nm,xl+wp/2,fy-bh/2+4,col_,'center');
  if($('c_v').checked){const vv=v-vo,L=Math.max(-140,Math.min(140,vv*7)),ay=fy-bh-14,ax=xl+wp/2;
   if(Math.abs(L)>2){arrow(ctx,ax,ay,L,0,col_,2.8);lab(vn+' = '+f2(vv)+' m/s',ax+L+(L>=0?8:-8),ay+4,col_,L>=0?'left':'right')}else lab(vn+' = 0',ax,ay-4,col_,'center')}
 });
 // centro de massa (linha tracejada e seta de v_cm no referencial do laboratório)
 const cx=X(xcm(t)-o);ctx.setLineDash([5,4]);ctx.strokeStyle=C('--ink');ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(cx,fy-bh-34);ctx.lineTo(cx,fy+4);ctx.stroke();ctx.setLineDash([]);
 lab('CM',cx,fy-bh-40,C('--ink'),'center');
 if(!cmf&&Math.abs(su.vcm)>.05&&$('c_v').checked){const L=Math.max(-140,Math.min(140,su.vcm*7));arrow(ctx,cx,fy-bh-30,L,0,C('--ink'),3);lab('v_cm = '+f2(su.vcm)+' m/s',cx+L+(L>=0?8:-8),fy-bh-26,C('--ink'),L>=0?'left':'right')}
 // barras de antes e depois, leituras, texto e gráficos
 bars(0);bars(1);
 const r=row();
 out('t',t);out('v1',r[3]);out('v2',r[4]);out('p',r[7]);out('K',r[10]);out('dK',r[10]-su.Kb[2]);out('vcm',su.vcm);out('xcm',xcm(t));
 {const q=status();if(q!==lastSt){lastSt=q;$('cmp').textContent=q;Sim.math($('cmp'))}}   // só re-renderiza quando o texto muda
 plots[0].draw(rows,null,TEND,[xcm]);plots[1].draw(rows,null,TEND,[()=>su.vcm]);plots[2].draw(rows,null,TEND);plots[3].draw(rows,null,TEND);
}
// Barras de antes e depois (k = 0: momento, com sinal; k = 1: energia cinética). Cada grupo (bloco 1, bloco 2, sistema) tem
// uma barra clara (antes) e uma barra cheia (depois); antes do choque, "depois" é só o valor previsto (contorno tracejado).
// No grupo "sistema" da energia, o trecho tracejado em rosa é a energia perdida no choque.
function bars(k){
 const c=bctx[k],W=fitb[k].w,H=fitb[k].h,C=css,ml=46,mr=10,mt=16,mb=30,A=k?su.Kb:su.pb,B=k?su.Ka:su.pa,cl=[C('--vy'),C('--vx'),C('--ink')];
 c.clearRect(0,0,W,H);
 const mx=Math.max(1e-9,...A.map(Math.abs),...B.map(Math.abs))*1.2,lo=k?0:-mx,Y=v=>H-mb-(v-lo)/(mx-lo)*(H-mt-mb),gw=(W-ml-mr)/3,bw=gw*.3;
 const st=Sim.nice((mx-lo)/4);c.lineWidth=1;c.font='11px system-ui,sans-serif';
 for(let g=Math.ceil(lo/st)*st;g<=mx;g+=st){c.strokeStyle=Math.abs(g)<1e-9?C('--ghost'):C('--grid');c.beginPath();c.moveTo(ml,Y(g));c.lineTo(W-mr,Y(g));c.stroke();c.fillStyle=C('--mut');c.textAlign='right';c.fillText(+g.toFixed(4),ml-5,Y(g)+4)}
 const val=(v,x,top)=>{c.fillStyle=C('--ink');c.font='600 11px system-ui,sans-serif';c.textAlign='center';c.fillText(f2(v),x,top)};
 ['m₁','m₂','sistema'].forEach((nm,i)=>{
  const gx=ml+gw*i+gw/2,xa=gx-bw-3,xd=gx+3;
  c.fillStyle=C('--mut');c.font='12px system-ui,sans-serif';c.textAlign='center';c.fillText(nm,gx,H-mb+16);
  c.globalAlpha=.3;c.fillStyle=cl[i];c.fillRect(xa,Math.min(Y(0),Y(A[i])),bw,Math.abs(Y(A[i])-Y(0)));c.globalAlpha=1;c.strokeStyle=cl[i];c.lineWidth=1.5;c.strokeRect(xa,Math.min(Y(0),Y(A[i])),bw,Math.abs(Y(A[i])-Y(0)));
  val(A[i],xa+bw/2,A[i]>=0?Y(A[i])-4:Y(A[i])+13);
  const hh=Math.abs(Y(B[i])-Y(0)),yt=Math.min(Y(0),Y(B[i]));
  if(col||!su.hit){c.fillStyle=cl[i];c.fillRect(xd,yt,bw,hh)}else{c.setLineDash([4,3]);c.strokeStyle=cl[i];c.lineWidth=1.8;c.strokeRect(xd,yt,bw,hh);c.setLineDash([])}
  val(B[i],xd+bw/2,B[i]>=0?Y(B[i])-4:Y(B[i])+13);
  if(k&&i===2&&su.hit&&A[2]-B[2]>1e-9){c.setLineDash([3,3]);c.strokeStyle=C('--a');c.lineWidth=1.6;c.strokeRect(xd,Y(A[2]),bw,Y(B[2])-Y(A[2]));c.setLineDash([]);c.fillStyle=C('--a');c.font='600 11px system-ui,sans-serif';c.textAlign='left';c.fillText('perda',xd+bw+4,(Y(A[2])+Y(B[2]))/2+4)}
 });
}
reset();
Sim.loop(dt=>{step(dt);draw()});
})();
