/* =====================================================================
   inclinado.js: bloco num plano inclinado, com e sem atrito. Depende de core.js.

   Organização (de cima para baixo):
     1. Configuração   canvas e estado
     2. Interface      sliders, leituras, gráficos
     3. Física         phys() = forças e aceleração; deriv() = equações do movimento
     4. Controle       upd(), reset(), launch(), botões
     5. step(dt)       avança a simulação em passos fixos
     6. draw()         rampa, bloco, vetores de força, leituras e gráficos
     7. Loop

   Modelo (1 dimensão, ao longo da rampa; s cresce descendo, a partir do topo):
     P = m·g          peso (vertical, para baixo)
     P∥ = P·sen θ     componente ao longo da rampa     P⊥ = P·cos θ   componente perpendicular
     N = P⊥           normal (perpendicular à rampa)
     Repouso: o atrito estático iguala P∥ (f = P∥) enquanto tg θ ≤ μₑ. Acima disso o bloco desliza.
     Deslizando: f = μc·N, a = (P∥ − f)/m = g·(sen θ − μc·cos θ).
     Sem atrito: f = 0 e a = g·sen θ.
   Estado: q = [s, v] (m e m/s). Modos: 'idle' (antes de soltar) | 'run' | 'end' (chegou à base).
   Linhas de dados dos gráficos: [t, s, v, Ec, Ep, E total]  (energia em J, Ep medida a partir da base).
   ===================================================================== */
(function(){
const {$,rk4,f2,arrow,css}=Sim, DT=1/240, P={}, cv=$('cv'), ctx=cv.getContext('2d'), R=Math.PI/180;
// Tela: proporção 0,7, altura entre 330 e 560 px (precisa de espaço para as setas).
let q=[0,0],t=0,mode='idle',paused=false,rows=[],acc=0,cnt=0,ph,a0,t0,lastSt='';

const fit=Sim.fit(cv,.7,330,560);

Sim.interactive(cv,fit);
Sim.playbar(cv,()=>mode==='fly'?'run':mode==='land'?'end':mode,()=>paused);   // ▶/⏸ e reiniciar sobre o canvas (ver core.js)

// ---- Parâmetros ajustáveis (valor em P.<id>) ----
Sim.controls($('ctl'),[
 {id:'m',label:'Massa',unit:'kg',min:.5,max:20,step:.5,val:2},
 {id:'ang',label:'Ângulo da rampa',unit:'°',min:0,max:75,step:1,val:30},
 {id:'mus',label:'Atrito estático μₑ',unit:'',min:0,max:1.2,step:.01,val:.5},
 {id:'muk',label:'Atrito cinético μc',unit:'',min:0,max:1.2,step:.01,val:.3},
 {id:'g',label:'Gravidade',unit:'m/s²',min:1,max:25,step:.1,val:9.8},
 {id:'L',label:'Comprimento da rampa',unit:'m',min:2,max:20,step:.5,val:8},
 {id:'spd',label:'Velocidade da animação',unit:'×',min:.1,max:2,step:.1,val:1}
],P,id=>{if(!Sim._loadingURL && id!=='spd')reset()});
$('c_atr').addEventListener('change',reset);
$('pl').addEventListener('change',e=>{const i=$('g');i.value=e.target.value;i.dispatchEvent(new Event('input'))});
const out=Sim.readouts($('ro'),[['t','Tempo (s)'],['s','s (m)'],['v','v (m/s)'],['a','a (m/s²)'],['W','Força gravitacional (N)'],['N','Normal N (N)'],['f','Atrito f (N)'],['Fr','Resultante (N)']]);

Sim.settings(cv, $('ctl'));

// ---- Gráficos (colunas: 1=s, 2=v, 3=Ec, 4=Ep, 5=E total) ----
const plots=[
 new Sim.Plot($('p1'),{title:'posição s(t) em m',series:[{col:1,name:'s',color:'--acc'}]}),
 new Sim.Plot($('p2'),{title:'velocidade v(t) em m/s',series:[{col:2,name:'v',color:'--vy'}]}),
 new Sim.Plot($('p3'),{title:'energia em J',series:[{col:3,name:'K',color:'--vx'},{col:4,name:'U',color:'--vy'},{col:5,name:'E total',color:'--acc'}]})
];

// ---- Física ----
const bm=()=>P.L*.08;   // lado do bloco em metros (o bloco para quando sua frente chega à base)
// Forças e aceleração para os parâmetros atuais. Para mudar o modelo de atrito, edite aqui.
// μc é limitado a μₑ (fisicamente, o atrito cinético não passa do estático).
function phys(){
 const th=P.ang*R,sn=Math.sin(th),cs=Math.cos(th),mus=P.mus,muk=Math.min(P.muk,P.mus);
 const atr=$('c_atr').checked,stuck=atr&&sn<=mus*cs;
 const W=P.m*P.g,N=W*cs,Pp=W*sn,f=stuck?Pp:(atr?muk*N:0),Fr=Pp-f;
 return{th,sn,cs,atr,stuck,W,N,Pp,f,Fr,a:Fr/P.m,mus,muk,Smax:P.L-bm(),still:Math.abs(Fr)<1e-9};
}
// EQUAÇÕES DO MOVIMENTO: dq/dt para q = [s, v]. Para acrescentar força aplicada, resistência do ar etc.,
// altere phys() (forças) e/ou esta função.
const deriv=x=>[x[1],ph.a];
const row=()=>{const ec=.5*P.m*q[1]*q[1],ep=P.m*P.g*(P.L-q[0])*ph.sn;return[t,q[0],q[1],ec,ep,ec+ep]};

// ---- Controle ----
// Recalcula grandezas derivadas: ph (forças), a0 e t0 (aceleração e tempo até a base SEM atrito, referência).
function upd(){ph=phys();a0=P.g*ph.sn;t0=a0>1e-9?Math.sqrt(2*ph.Smax/a0):Infinity}
function reset(){upd();mode='idle';q=[0,0];t=0;rows=[];acc=0;paused=false;    lastSt = '';$('bp').textContent='Pausar'}
function launch(){reset();mode='run';rows=[row()]}
$('bl').onclick=launch;
$('bp').onclick=()=>{if(mode!=='run')return;paused=!paused;$('bp').textContent=paused?'Continuar':'Pausar'};
$('bc').onclick=reset;

// Passos fixos de DT (independentes da taxa de quadros). Termina ao chegar à base (interpolando o ponto
// final) ou, se o bloco não se move, após 6 s.
function step(dt){
 if(mode!=='run'||paused)return;
 acc+=dt*P.spd;
 while(acc>=DT){
  acc-=DT;
  const n=rk4(deriv,q,DT);
  if(n[0]>=ph.Smax){
   const f=(ph.Smax-q[0])/(n[0]-q[0]);
   q=[ph.Smax,q[1]+f*(n[1]-q[1])];t+=f*DT;rows.push(row());mode='end';return;
  }
  q=n;t+=DT;if(++cnt%2===0)rows.push(row());
  if(ph.still&&t>=6){rows.push(row());mode='end';return}
 }
}

// Frase de situação mostrada sob o canvas.
const M = s => '\\(' + s + '\\)';
const fm = Sim.fm;

function status() {
    const tn = Math.tan(ph.th);

    if (mode === 'end' && !ph.still) {
        return 'Chegou à base em ' + M(fm(t) + '\\,\\mathrm{s}') +
            ' com ' + M('v = ' + fm(q[1]) + '\\,\\mathrm{m/s}') +
            '. Sem atrito: ' + M('t_0' + ' = ' + fm(t0) + '\\,\\mathrm{s}') +
            ' e ' + M('v_0 = ' + fm(a0 * t0) + '\\,\\mathrm{m/s}') + '.';
    }

    if (ph.stuck) {
        return 'Atrito estático segura o bloco: ' +
            M('\\tan\\theta = ' + fm(tn)) +
            ' ' + M('\\leq \\mu_e = ' + fm(ph.mus)) +
            ', logo ' + M('f = F_{g\\parallel}') +
            ' e ' + M('a = 0') + '.';
    }

    if (!ph.atr) {
        return 'Sem atrito: só ' + M('F_g') + ' e ' + M('N') +
            ' atuam, ' + M('f = 0') + ' e ' +
            M('a = g\\,\\mathrm{sen}\\,\\theta = ' + fm(a0) +
              '\\,\\mathrm{m/s^2}') + '.';
    }

    return 'Com atrito cinético: ' +
        M('f = \\mu_c N') + ' e ' +
        M('a = ' + fm(ph.a) + '\\,\\mathrm{m/s^2}') +
        ' (' + M('\\tan\\theta = ' + fm(tn)) +
        ' ' + M('> \\mu_e = ' + fm(ph.mus)) + ').';
}


// ---- Desenho ----
// Convenção de pixels (y para baixo): d = direção rampa abaixo, n = normal que sai da superfície.
function draw(){
 const C=css,W=fit.w,H=fit.h,{th,sn,cs}=ph,L=P.L,mL=50,mR=50,mT=125,mB=44;
 const sc=Math.min((W-mL-mR)/Math.max(L*cs,.5),(H-mT-mB)/Math.max(L*sn,.5)),ex=L*cs*sc;
 const Tx=mL+(W-mL-mR-ex)/2,Bx=Tx+ex,By=H-mB,Ty=By-L*sn*sc,d=[cs,sn],n=[sn,-cs];
 ctx.clearRect(0,0,W,H);
 // rampa e chão
 ctx.fillStyle=C('--ground');ctx.beginPath();ctx.moveTo(Tx,Ty);ctx.lineTo(Bx,By);ctx.lineTo(Tx,By);ctx.closePath();ctx.fill();
 ctx.strokeStyle=C('--ground');ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(12,By);ctx.lineTo(W-12,By);ctx.stroke();
 ctx.strokeStyle=C('--ink');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(Tx,Ty);ctx.lineTo(Bx,By);ctx.stroke();
 if(th>0.02){ctx.strokeStyle=C('--mut');ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(Bx,By,42,Math.PI,Math.PI+th);ctx.stroke();
  ctx.fillStyle=C('--mut');ctx.font=C('--normalfont');ctx.textAlign='right';ctx.fillText('θ = '+P.ang+'°',Bx-48,By-6)}
 // bloco: centro C = ponto da superfície + metade do lado ao longo de n
 const b=bm()*sc,u=q[0]*sc+b/2,Cx=Tx+d[0]*u+n[0]*b/2,Cy=Ty+d[1]*u+n[1]*b/2;
 ctx.save();ctx.translate(Cx,Cy);ctx.rotate(th);
 ctx.fillStyle=C('--ink');ctx.strokeStyle=C('--ink');ctx.lineWidth=2;ctx.fillRect(-b/2,-b/2,b,b);ctx.strokeRect(-b/2,-b/2,b,b);
 ctx.fillStyle=C('--card');ctx.font=C('--normalfont');ctx.textAlign='center';ctx.fillText('m',0,4);ctx.restore();
 // forças: escala fixa, o peso mede 72 px; as outras ficam proporcionais a ele
 const k=72/ph.W,F=(lab,v,ox,oy,dx,dy,col,dash,w)=>{
  ctx.setLineDash(dash?[5,4]:[]);arrow(ctx,ox,oy,dx,dy,col,w||2.6);ctx.setLineDash([]);
  const len=Math.hypot(dx,dy);if(len<3)return;
  const ux=dx/len,uy=dy/len;ctx.fillStyle=col;ctx.font=C('--normalfont');
  ctx.textAlign=ux>.3?'left':ux<-.3?'right':'center';
  ctx.fillText(lab+'='+f2(v)+' N',ox+dx+ux*8,oy+dy+uy*12+(Math.abs(uy)<.3?4:0));
 };
 if($('c_f').checked){
    if($('c_comp').checked){
    F('F_g∥',ph.Pp,Cx,Cy,d[0]*ph.Pp*k,d[1]*ph.Pp*k,C('--a'),true,2);
    F('F_g⊥',ph.N,Cx,Cy,-n[0]*ph.N*k,-n[1]*ph.N*k,C('--a'),true,2);
    }
    F('F_g',ph.W,Cx,Cy,0,ph.W*k,C('--a'));
    F('N',ph.N,Cx,Cy,n[0]*ph.N*k,n[1]*ph.N*k,C('--acc'));
    F('f',ph.f,Cx,Cy,-d[0]*ph.f*k,-d[1]*ph.f*k,C('--vx'));
 }
 if($('c_res').checked)F('F',ph.Fr,Cx+n[0]*(b/2+14),Cy+n[1]*(b/2+14),d[0]*ph.Fr*k,d[1]*ph.Fr*k,C('--vy'),false,3.4);
 // leituras e gráficos
 out('t',t);out('s',q[0]);out('v',q[1]);out('a',ph.a);out('W',ph.W);out('N',ph.N);out('f',ph.f);out('Fr',ph.Fr);
 {const st=status();if(st!==lastSt){lastSt=st;$('cmp').textContent=st;Sim.math($('cmp'))}}   // só re-renderiza quando o texto muda
 const id=tt=>{const u=Math.min(tt,t0),s=.5*a0*u*u,v=a0*u,ec=.5*P.m*v*v,ep=P.m*P.g*(P.L-s)*ph.sn;return[tt,s,v,ec,ep,ec+ep]};
 const ta=!ph.still&&ph.a>1e-9?Math.sqrt(2*ph.Smax/ph.a):0,tf=Math.min(Math.max(ta,isFinite(t0)?t0:0,1),25);
 plots.forEach(p=>p.draw(rows,id,tf));
}

Sim.urlLoad();
reset();
Sim.urlButton(cv);

Sim.loop(dt=>{step(dt);draw()});
})();
