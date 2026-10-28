/* =====================================================================
   pendulo.js: pêndulo de Galileu (fio que encontra um pino) e conservação de energia. Depende de core.js.

   Organização: 1. Configuração · 2. Interface · 3. Física (setup, cur, trackStep, flightStep) ·
                4. Controle · 5. step · 6. status · 7. draw · 8. Loop   (mesma estrutura dos outros arquivos)

   Montagem (plano x–y, y para cima, origem no ponto de suspensão O): um pino P fica na vertical que passa
   por O, a uma distância d = f·L abaixo dele. Enquanto a partícula está à esquerda da vertical, o fio gira
   em torno de O (raio L); ao passar pela vertical, o fio se apoia no pino e passa a girar em torno de P
   (raio r = L − d); ao voltar, solta-se do pino. O ponto mais baixo é o mesmo nos dois lados.
   Na pista circular: θ = ângulo do fio com a vertical para baixo (θ < 0 à esquerda, θ > 0 à direita).
     θ'' = −(g/ℓ)·sen θ − γ·θ'    (ℓ = L ou r; γ = resistência do ar linear, opcional)
     Tensão: T = F_g·cos θ + m·ℓ·ω²,  com F_g = m·g      (componentes de F_g: F_g·sen θ tangente, F_g·cos θ radial)
     Cruzando a vertical, a velocidade linear é contínua: ω muda de escala (ω·ℓ_antes/ℓ_depois).
     Energia: E = ½·m·v² + m·g·h (h acima do ponto mais baixo);  Q = dissipada;  E + Q = E0 = m·g·h0.
   Fio frouxo: se T < 0 (só acima da altura do centro), a partícula passa a voo livre (FL = [x, y, vx, vy]). Quando
   a distância ao centro volta a ser ℓ, o fio estica num puxão inelástico: a componente radial da velocidade é perdida
   (a energia ½·m·v_r² entra em Q). Se a partícula dá a volta no pino (|θ| ≥ π), o fio se enrola e o movimento termina.
   Com h0 ≤ r a partícula volta exatamente à altura h0 do outro lado (resultado de Galileu).
   Modos: 'idle' (pré-visualização) | 'run' | 'end'. Motivo do fim (fim): 'enrola' | 'tempo'.
   Linhas de dados dos gráficos: [t, Ec, Ep, E, Q, h, T/F_g].
   ===================================================================== */
(function(){
const {$,rk4,f2,arrow,css}=Sim, DT=1/600, TMAX=30, P={}, cv=$('cv'), ctx=cv.getContext('2d'), D=Math.PI/180;
const fit=Sim.fit(cv,.7,380,560);
let q=[0,0],side='L',FL=null,t=0,mode='idle',fim='',paused=false,rows=[],tr=[],acc=0,cnt=0,Qd=0,Qj=0,jerks=0,lastSt='',su;

Sim.interactive(cv,fit);
Sim.playbar(cv,()=>mode==='fly'?'run':mode==='land'?'end':mode,()=>paused);   // ▶/⏸ e reiniciar sobre o canvas (ver core.js)

// ---- Parâmetros ajustáveis (valor em P.<id>) ----
// Os rótulos aceitam HTML e LaTeX (MathJax): \( ... \), escrito aqui como '\\( ... \\)'.
Sim.controls($('ctl'),[
 {id:'L',label:'Comprimento do fio \\(L\\)',unit:'m',min:.5,max:3,step:.1,val:1.5},
 {id:'th0',label:'Ângulo inicial \\(\\theta_0\\)',unit:'°',min:5,max:90,step:1,val:50},
 {id:'f',label:'Posição do pino \\(d/L\\)',unit:'',min:.1,max:.9,step:.01,val:.5},
 {id:'m',label:'Massa \\(m\\)',unit:'kg',min:.1,max:5,step:.1,val:1},
 {id:'gam',label:'Resistência do ar \\(\\gamma\\) (se ligada)',unit:'1/s',min:0,max:.6,step:.01,val:.1},
 {id:'g',label:'Gravidade \\(g\\)',unit:'m/s²',min:1,max:25,step:.1,val:9.8},
 {id:'spd',label:'Velocidade da animação',unit:'×',min:.1,max:2,step:.1,val:1}
],P,id=>{if(id!=='spd')reset()});
$('c_pino').addEventListener('change',reset);
$('c_ar').addEventListener('change',reset);
$('pl').addEventListener('change',e=>{const i=$('g');i.value=e.target.value;i.dispatchEvent(new Event('input'))});
const out=Sim.readouts($('ro'),[['t','\\(t\\) (s)'],['th','\\(\\theta\\) (°)'],['v','\\(v\\) (m/s)'],['T','Tração \\(T\\) (N)'],['Ec','\\(K\\) (J)'],['Ep','\\(U\\) (J)'],['E','\\(E\\) (J)'],['Q','Dissipada \\(Q\\) (J)']]);

Sim.speedbar(cv, 'spd');

// ---- Gráficos (colunas: 1=Ec 2=Ep 3=E 4=Q 5=h 6=T/F_g) ----
// Título e legenda ficam em HTML (com MathJax) acima de cada canvas; as cores precisam coincidir com as de lá.
const plots=[
 new Sim.Plot($('p1'),{title:'',mt:8,series:[{col:1,name:'',color:'--vx'},{col:2,name:'',color:'--vy'},{col:3,name:'',color:'--acc'},{col:4,name:'',color:'--a'}]}),
 new Sim.Plot($('p2'),{title:'',mt:8,series:[{col:5,name:'',color:'--vy'}]}),
 new Sim.Plot($('p3'),{title:'',mt:8,series:[{col:6,name:'',color:'--acc'}]})
];

// ---- Física ----
// Geometria: com pino, d = f·L; sem pino, d = 0 (os dois lados giram em torno de O com raio L).
// S.L e S.R: centro (c) e raio (l) do fio à esquerda e à direita da vertical.
function setup(){
 const peg=$('c_pino').checked,L=P.L,d=peg?P.f*L:0,r=L-d,h0=L*(1-Math.cos(P.th0*D));
 return{peg,L,d,r,h0,S:{L:{c:[0,0],l:L},R:{c:[0,-d],l:r}}};
}
// Estado atual em coordenadas cartesianas (no fio esticado ou em voo livre).
function cur(){
 if(FL)return{x:FL[0],y:FL[1],vx:FL[2],vy:FL[3],fl:true};
 const s=su.S[side],th=q[0],w=q[1];
 return{x:s.c[0]+s.l*Math.sin(th),y:s.c[1]-s.l*Math.cos(th),vx:s.l*w*Math.cos(th),vy:s.l*w*Math.sin(th),fl:false,th,w,s};
}
const tens=c=>c.fl?0:P.m*(c.s.l*c.w*c.w+P.g*Math.cos(c.th));
const row=()=>{const c=cur(),ec=.5*P.m*(c.vx*c.vx+c.vy*c.vy),ep=P.m*P.g*(c.y+su.L);return[t,ec,ep,ec+ep,Qd,c.y+su.L,tens(c)/(P.m*P.g)]};
const record=()=>{rows.push(row());const c=cur();tr.push([c.x,c.y])};

// ---- Controle ----
function reset(){su=setup();side='L';q=[-P.th0*D,0];FL=null;t=0;rows=[];tr=[];Qd=0;Qj=0;jerks=0;fim='';acc=0;paused=false;mode='idle';$('bp').textContent='Pausar'}
function launch(){reset();mode='run';record()}
function end(){record();mode='end'}
$('bl').onclick=launch;
$('bp').onclick=()=>{if(mode!=='run')return;paused=!paused;$('bp').textContent=paused?'Continuar':'Pausar'};
$('bc').onclick=reset;

// Um passo no fio esticado (RK4 de [θ, ω, Q]). Ao cruzar a vertical, avança até θ = 0, troca o centro e o
// raio (ω muda de escala) e avança o resto do passo. Se T < 0, o fio fica frouxo e começa o voo livre.
function trackStep(h){
 const gm=$('c_ar').checked?P.gam:0,mk=l=>z=>[z[1],-(P.g/l)*Math.sin(z[0])-gm*z[1],P.m*gm*l*l*z[1]*z[1]];
 let s=su.S[side],n=rk4(mk(s.l),[q[0],q[1],0],h);
 if((side==='L'&&n[0]>0)||(side==='R'&&n[0]<0)){
  const h1=q[0]/(q[0]-n[0])*h;
  n=rk4(mk(s.l),[q[0],q[1],0],h1);Qd+=n[2];
  const o=side==='L'?'R':'L',s2=su.S[o];q=[0,n[1]*s.l/s2.l];side=o;s=s2;
  n=rk4(mk(s.l),[q[0],q[1],0],h-h1);
 }
 Qd+=n[2];q=[n[0],n[1]];t+=h;
 if(Math.abs(q[0])>=Math.PI){fim='enrola';end();return}
 if(P.m*(s.l*q[1]*q[1]+P.g*Math.cos(q[0]))<0){const c=cur();FL=[c.x,c.y,c.vx,c.vy]}
}
// Um passo de voo livre (queda livre exata). A restrição ativa é a do lado em que a partícula está.
// Quando a distância ao centro volta a ser ℓ com velocidade radial para fora, o fio estica (puxão inelástico).
function flightStep(h){
 FL[0]+=FL[2]*h;FL[1]+=FL[3]*h-.5*P.g*h*h;FL[3]-=P.g*h;t+=h;
 const sd=FL[0]<0||!su.peg?'L':'R',s=su.S[sd],dx=FL[0]-s.c[0],dy=FL[1]-s.c[1],dist=Math.hypot(dx,dy);
 if(dist>s.l&&dx*FL[2]+dy*FL[3]>0){
  const ux=dx/dist,uy=dy/dist,vr=FL[2]*ux+FL[3]*uy,th=Math.atan2(dx,-dy);
  Qd+=.5*P.m*vr*vr;Qj+=.5*P.m*vr*vr;jerks++;                       // energia perdida no puxão
  q=[th,((FL[2]-vr*ux)*Math.cos(th)+(FL[3]-vr*uy)*Math.sin(th))/s.l];side=sd;FL=null;
 }
}
function step(dt){
 if(mode!=='run'||paused)return;
 acc+=dt*P.spd;
 while(acc>=DT){
  acc-=DT;
  if(FL)flightStep(DT);else trackStep(DT);
  if(mode!=='run')return;
  if(++cnt%2===0)record();
  if(t>=TMAX){fim='tempo';end();return}
 }
}

// Frase de situação mostrada sob o canvas (LaTeX; renderizada por MathJax quando o texto muda).
const M=x=>'\\('+x+'\\)',fm=Sim.fm,J='\\,\\mathrm{J}',MT='\\,\\mathrm{m}';
function status(){
 const last=rows.length?rows[rows.length-1]:null,E0=P.m*P.g*su.h0,ar=$('c_ar').checked&&P.gam>0;
 if(mode==='end'&&last){
  const e=M('E='+fm(last[3])+J),q2=M('Q='+fm(last[4])+J);
  if(fim==='enrola')return'A partícula deu a volta no pino e o fio se enrolou nele: fim do movimento. '+e+'; dissipada: '+q2+'.';
  return'Tempo limite ('+M('30\\,\\mathrm{s}')+'). '+e+'; dissipada: '+q2+(jerks?'; puxões do fio: '+jerks+'.':'.');
 }
 let s='Altura inicial '+M('h=L(1-\\cos\\theta_0)='+fm(su.h0)+MT)+', energia '+M('E_0=mgh='+fm(E0)+J)+'. ';
 if(!su.peg)s+='Sem pino, o fio gira em torno de '+M('O')+' dos dois lados e a partícula volta à altura '+M('h')+'; para pequenos ângulos, '+M('T\\approx 2\\pi\\sqrt{L/g}='+fm(2*Math.PI*Math.sqrt(su.L/P.g))+'\\,\\mathrm{s}')+'.';
 else{
  s+='Com o pino, o raio à direita é '+M('r=L-d='+fm(su.r)+MT)+'. ';
  if(su.h0<=su.r)s+='Como '+M('h\\le r')+', o fio fica esticado e a partícula sobe de novo até a mesma altura '+M('h')+'. ';
  else if(su.h0<2.5*su.r)s+='Como '+M('h>r')+', o fio fica frouxo em '+M('\\varphi\\approx '+fm(Math.acos(-2*(su.h0-su.r)/(3*su.r))/D)+'^\\circ')+' (medido a partir da base, em torno do pino) e a partícula cai em voo livre até o fio esticar de novo, com perda de energia. ';
  else s+='Como '+M('h\\ge 2{,}5r')+', a partícula dá a volta no pino e o fio se enrola nele. ';
  s+='Período para pequenos ângulos: '+M('T\\approx\\pi\\sqrt{L/g}+\\pi\\sqrt{r/g}='+fm(Math.PI*Math.sqrt(su.L/P.g)+Math.PI*Math.sqrt(su.r/P.g))+'\\,\\mathrm{s}')+'.';
 }
 if(ar)s+=' Com resistência do ar, '+M('E+Q=E_0')+'.';
 if(jerks)s+=' Puxões do fio: '+jerks+' (energia perdida neles: '+M(fm(Qj)+J)+').';
 return s;
}

// ---- Desenho ----
// Mundo em metros (y para cima, origem em O). A janela é centrada em x = 0 e cobre as duas oscilações.
// Partícula desenhada como círculo de tamanho fixo (a massa não altera o desenho).
function draw(){
 const C=css,W=fit.w,H=fit.h,mT=16,mB=26;
 const Wd=Math.max(su.L*Math.sin(P.th0*D),su.r)+.25,yt=su.h0>su.r?Math.max(.25,su.r-su.d+.15):.25;
 const sc=Math.min((W-30)/(2*Wd),(H-mT-mB)/(yt+su.L+.2)),X=x=>W/2+x*sc,Y=y=>mT+(yt-y)*sc;
 ctx.clearRect(0,0,W,H);
 const lab=(s,x,y,col,al)=>{ctx.fillStyle=col;ctx.font=C('--normalfont');ctx.textAlign=al||'left';ctx.fillText(s,x,y)};
 // altura inicial h (referência: a partícula deve voltar a esta linha) e trajetórias circulares
 if($('c_h').checked){ctx.setLineDash([6,5]);ctx.lineWidth=1.3;ctx.strokeStyle=C('--ink');const yh=-su.L*Math.cos(P.th0*D);
  ctx.beginPath();ctx.moveTo(X(-Wd),Y(yh));ctx.lineTo(X(Wd),Y(yh));ctx.stroke();ctx.setLineDash([]);lab('h = '+f2(su.h0)+' m',X(Wd)-4,Y(yh)-5,C('--ink'),'right')}
 if($('c_g').checked){ctx.setLineDash([3,4]);ctx.lineWidth=1.2;ctx.strokeStyle=C('--ghost');ctx.beginPath();
  for(let a=-P.th0*D;a<=1e-9;a+=.02)ctx.lineTo(X(su.L*Math.sin(a)),Y(-su.L*Math.cos(a)));
  const tm=su.h0>=2*su.r?Math.PI:Math.acos(1-su.h0/su.r);
  for(let a=0;a<=tm;a+=.02)ctx.lineTo(X(su.S.R.c[0]+su.r*Math.sin(a)),Y(su.S.R.c[1]-su.r*Math.cos(a)));
  ctx.stroke();ctx.setLineDash([])}
 // suporte, fio e pino
 ctx.strokeStyle=C('--ink');ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(X(-.35),Y(0));ctx.lineTo(X(.35),Y(0));ctx.stroke();
 const c=cur(),bx=X(c.x),by=Y(c.y);
 ctx.lineWidth=2;ctx.setLineDash(c.fl?[4,4]:[]);ctx.beginPath();ctx.moveTo(X(0),Y(0));
 if(c.x>0&&su.peg){ctx.lineTo(X(0),Y(-su.d));ctx.lineTo(bx,by)}else ctx.lineTo(bx,by);
 ctx.stroke();ctx.setLineDash([]);
 if(su.peg){ctx.fillStyle=C('--ground');ctx.beginPath();ctx.arc(X(0),Y(-su.d),5.5,0,7);ctx.fill();ctx.strokeStyle=C('--ink');ctx.lineWidth=1.5;ctx.stroke();lab('pino',X(0)+9,Y(-su.d)+4,C('--mut'))}
 // rastro
 if($('c_tr').checked&&tr.length>1){ctx.strokeStyle=C('--acc');ctx.lineWidth=2;ctx.globalAlpha=.5;ctx.beginPath();tr.forEach((p,j)=>j?ctx.lineTo(X(p[0]),Y(p[1])):ctx.moveTo(X(p[0]),Y(p[1])));ctx.stroke();ctx.globalAlpha=1}
 // forças (escala fixa: F_g mede 34 px; setas maiores que 140 px são encurtadas)
 const Fg=P.m*P.g,k=34/Fg;
 const Fv=(l,v,wx,wy,col,dash)=>{let dx=wx*k,dy=-wy*k;const L=Math.hypot(dx,dy);if(L<3)return;if(L>140){dx*=140/L;dy*=140/L}
  ctx.setLineDash(dash?[5,4]:[]);arrow(ctx,bx,by,dx,dy,col,dash?2:2.6);ctx.setLineDash([]);const n=Math.hypot(dx,dy);
  lab(l+'='+f2(v)+' N',bx+dx+dx/n*8,by+dy+dy/n*12+(Math.abs(dy/n)<.3?4:0),col,dx/n>.3?'left':dx/n<-.3?'right':'center')};
 if($('c_f').checked){
  Fv('F_g',Fg,0,-Fg,C('--a'));
  if(!c.fl){
   const th=c.th,u=[Math.sin(th),-Math.cos(th)],tg=[Math.cos(th),Math.sin(th)],T=tens(c);
   Fv('T',T,-u[0]*T,-u[1]*T,C('--acc'));
   if($('c_comp').checked){Fv('F_g∥',Fg*Math.abs(Math.sin(th)),-Fg*Math.sin(th)*tg[0],-Fg*Math.sin(th)*tg[1],C('--a'),true);Fv('F_g⊥',Fg*Math.abs(Math.cos(th)),Fg*Math.cos(th)*u[0],Fg*Math.cos(th)*u[1],C('--a'),true)}
   const vv=Math.hypot(c.vx,c.vy);if($('c_ar').checked&&P.gam>0&&vv>1e-6)Fv('f_ar',P.m*P.gam*vv,-P.m*P.gam*c.vx,-P.m*P.gam*c.vy,C('--vx'));
  }
 }
 ctx.fillStyle=C('--ink');ctx.beginPath();ctx.arc(bx,by,12,0,7);ctx.fill();

 //  // barras de energia: Ep, Ec e Q como fração de E0 (a soma é sempre E0)
//  const E0=P.m*P.g*su.h0,ec=.5*P.m*(c.vx*c.vx+c.vy*c.vy),ep=P.m*P.g*(c.y+su.L);
//  if($('c_bar').checked){
//   const bw=200,bx0=W-20-bw,by0=0.1*H;let x=bx0;
//   [[ep,C('--vy'),'U'],[ec,C('--vx'),'K'],[Qd,C('--a'),'Q']].forEach(([v,col,nm],j)=>{const w=Math.max(0,Math.min(bw-(x-bx0),v/E0*bw));ctx.fillStyle=col;ctx.fillRect(x,by0,w,12);x+=w;lab(nm,bx0+j*46,by0+28,col)});
//   ctx.strokeStyle=C('--line');ctx.lineWidth=1;ctx.strokeRect(bx0,by0,bw,12);lab('E₀ = '+f2(E0)+' J',bx0+bw,by0+28,C('--mut'),'right');
//  }

// barras de energia: Ep, Ec e Q como fração de E0
const E0=P.m*P.g*su.h0,
      ec=.5*P.m*(c.vx*c.vx+c.vy*c.vy),
      ep=P.m*P.g*(c.y+su.L);

if($('c_bar').checked){
  const bh=.35*H,bw=14,gap=5,
        bx=W-25,by=0.1*H;
  let y=by+bh;

  [[ep,C('--vy'),'U'],
   [ec,C('--vx'),'K'],
   [Qd,C('--a'),'Q']].forEach(([v,col,nm])=>{
    const h=bh*Math.max(0,Math.min(1,v/E0));
    y-=h;
    ctx.fillStyle=col;
    ctx.fillRect(bx,y,bw,h);
    // y-=gap;
  });

  ctx.strokeStyle=C('--line');
  ctx.lineWidth=1;
  ctx.strokeRect(bx,by,bw,bh);

  lab('U',bx-bw-5,by+bh,C('--vy'));
  lab('K',bx-bw-5,by+bh-bh/3,C('--vx'));
  lab('Q',bx-bw-5,by+bh-2*bh/3,C('--a'));
  lab('E₀ = '+f2(E0)+' J',bx-bw-35,by-8,C('--mut'));
}

 // leituras, texto e gráficos
 const r=row();
 out('t',t);out('th',c.fl?'voo livre':c.th/D);out('v',Math.hypot(c.vx,c.vy));out('T',tens(c));out('Ec',r[1]);out('Ep',r[2]);out('E',r[3]);out('Q',Qd);
 {const s=status();if(s!==lastSt){lastSt=s;$('cmp').textContent=s;Sim.math($('cmp'))}}   // só re-renderiza quando o texto muda
 const per=Math.PI*Math.sqrt(su.L/P.g)+Math.PI*Math.sqrt(su.r/P.g),tf=Math.min(TMAX,4*per);
 plots[0].draw(rows,null,tf);plots[1].draw(rows,tt=>[tt,0,0,0,0,su.h0,0],tf);plots[2].draw(rows,null,tf);
}
reset();
Sim.loop(dt=>{step(dt);draw()});
})();
