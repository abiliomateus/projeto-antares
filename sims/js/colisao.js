/* =====================================================================
   colisao.js: colisão entre duas partículas PONTUAIS em duas dimensões. Depende de core.js.

   Organização: 1. Configuração · 2. Interface · 3. Física (setup, collide) · 4. Controle ·
                5. step · 6. status · 7. draw · 8. Loop   (mesma estrutura dos outros arquivos)

   Cena: os eixos x–y têm origem no ponto da colisão. As duas partículas chegam à origem no mesmo
   instante t = TC (uma partícula parada fica na origem desde o início). Sem forças externas, o
   movimento é retilíneo uniforme: não há integrador, e o choque é um evento em t = TC.

   Modelo do choque (sem raio, não há "normal": o resultado é fixado pela conservação e por θ₁):
     1. Momento total conservado:  p = m1·v1 + m2·v2 = M·c   (c = velocidade do CM).
     2. Restituição e = |v_rel depois| / |v_rel antes|, com v_rel = v2 − v1. No referencial do CM,
        a velocidade final de 1 é u1 − c = (m2/M)·w′, com |w′| = e·|v_rel|.
        Logo u1 está numa CIRCUNFERÊNCIA de centro c e raio ρ = (m2/M)·e·|v_rel|.
     3. θ₁ (desvio de 1 no referencial do laboratório) fixa a DIREÇÃO φ = ang1 + θ₁ de u1; o módulo
        vem da interseção da semirreta de direção φ com a circunferência:
              s = û·c ± √((û·c)² − |c|² + ρ²)
        Depois, u2 = c − (m1/m2)·(u1 − c).
     Perda de energia cinética: ΔEc = −½·μ·(1−e²)·|v_rel|², com μ = m1·m2/(m1+m2).
     Limites: se |c| > ρ, só são possíveis direções num cone de meio-ângulo asin(ρ/|c|) em torno de c;
     o slider de θ₁ é limitado a esse intervalo (thetaRange + Sim.setRange), então a animação
     sempre reproduz o θ₁ mostrado no slider. Quando existem duas soluções
     (semirreta corta a circunferência duas vezes), a caixa "Outra solução" escolhe a menor.
   Modos: 'idle' (pré-visualização, com o resultado previsto) | 'run' | 'end'.
   Linhas de dados dos gráficos: [t, |v1|, |v2|, px, py, |p|, Ec1, Ec2, Ec total].
   ===================================================================== */
(function(){
const {$,f2,arrow,css}=Sim, DT=1/240, TC=2, P={}, cv=$('cv'), ctx=cv.getContext('2d'), R=Math.PI/180;
const fit=Sim.fit(cv,.6,380,600);
let lastSt='',A,B,t=0,mode='idle',paused=false,rows=[],tr=[],rec=null,acc=0,cnt=0,su;

Sim.interactive(cv,fit);
Sim.playbar(cv,()=>mode==='fly'?'run':mode==='land'?'end':mode,()=>paused);   // ▶/⏸ e reiniciar sobre o canvas (ver core.js)

// ---- Parâmetros ajustáveis (valor em P.<id>) ----
// Os rótulos aceitam HTML e fórmulas em LaTeX (MathJax): \( ... \), escrito aqui como '\\( ... \\)'.
Sim.controls($('ctl'),[
 {id:'m1',label:'Massa \\(m_1\\)',unit:'kg',min:.5,max:10,step:.5,val:1},
 {id:'m2',label:'Massa \\(m_2\\)',unit:'kg',min:.5,max:10,step:.5,val:1},
 {id:'v1',label:'Módulo de \\(\\vec v_1\\)',unit:'m/s',min:0,max:10,step:.5,val:3},
 {id:'ang1',label:'Direção de \\(\\vec v_1\\)',unit:'°',min:-180,max:180,step:5,val:0},
 {id:'v2',label:'Módulo de \\(\\vec v_2\\)',unit:'m/s',min:0,max:10,step:.5,val:0},
 {id:'ang2',label:'Direção de \\(\\vec v_2\\)',unit:'°',min:-180,max:180,step:5,val:0},
 {id:'dfl',label:'Desvio de 1, \\(\\theta_1\\)',unit:'°',min:-180,max:180,step:1,val:30},
 {id:'e',label:'Coeficiente de restituição \\(e\\)',unit:'',min:0,max:1,step:.05,val:1},
 {id:'spd',label:'Velocidade da animação',unit:'×',min:.1,max:2,step:.1,val:1}
],P,id=>{if(!Sim._loadingURL && id!=='spd')reset()});
$('c_alt').addEventListener('change',reset);
const out=Sim.readouts($('ro'),[['t','\\(t\\) (s)'],['p','\\(|\\vec p|\\) (kg·m/s)'],['ec','\\(K\\) (J)'],['dec','\\(\\Delta K\\) (J)'],['v1','\\(|\\vec v_1|\\) (m/s)'],['v2','\\(|\\vec v_2|\\) (m/s)'],['a1','direção de \\(\\vec v_1\\) (°)'],['a2','direção de \\(\\vec v_2\\) (°)']]);

Sim.panel(cv, $('ctl'));
Sim.panel(cv, $('book'), { type: 'book' });

// ---- Gráficos (colunas: 1=|v1| 2=|v2| 3=px 4=py 5=|p| 6=Ec1 7=Ec2 8=Ec) ----
// Título e legenda ficam em HTML (com MathJax) acima de cada canvas: por isso title e name vazios e mt pequeno.
// As cores abaixo precisam coincidir com as da legenda no HTML.
const plots=[
//  new Sim.Plot($('p1'),{title:'',mt:8,series:[{col:1,name:'',color:'--acc'},{col:2,name:'',color:'--vx'}]}),
//  new Sim.Plot($('p2'),{title:'',mt:8,series:[{col:3,name:'',color:'--vx'},{col:4,name:'',color:'--vy'},{col:5,name:'',color:'--acc'}]}),
//  new Sim.Plot($('p3'),{title:'',mt:8,series:[{col:6,name:'',color:'--acc'},{col:7,name:'',color:'--vx'},{col:8,name:'',color:'--vy'}]})
];

// ---- Física ----
const wrap=x=>((x+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;   // ângulo em (−π, π]
const dir=v=>(Math.atan2(v[1],v[0])/R+360)%360;
// Calcula a cena e o resultado do choque (ver o cabeçalho). Para outro critério de escolha da solução,
// altere aqui. Se as velocidades forem iguais (v_rel ≈ 0) não há colisão.
function setup(){
 const M=P.m1+P.m2,a1=P.ang1*R,a2=P.ang2*R;
 const v1=[P.v1*Math.cos(a1),P.v1*Math.sin(a1)],v2=[P.v2*Math.cos(a2),P.v2*Math.sin(a2)];
 const vm=Math.hypot(v2[0]-v1[0],v2[1]-v1[1]),hit=vm>=.05;
 const c=[(P.m1*v1[0]+P.m2*v2[0])/M,(P.m1*v1[1]+P.m2*v2[1])/M],cm=Math.hypot(c[0],c[1]),rho=P.m2/M*P.e*vm;
 let u1=v1,u2=v2,phi=a1,clamp=false,two=false,all=true,dc=0,gdeg=180;
 
if(hit){

  // Colisão unidimensional quando o desvio de 1 é zero
  const cross=v1[0]*v2[1]-v1[1]*v2[0];
  const collinear=P.v2<.05 ||
    Math.abs(cross)<1e-8*Math.max(1,P.v1*P.v2);

  if(Math.abs(P.dfl)<1e-9 && P.v1>=.05 && collinear){

    // Eixo orientado na direção inicial da partícula 1
    const ex=v1[0]/P.v1,ey=v1[1]/P.v1;
    const w1=P.v1;
    const w2=v2[0]*ex+v2[1]*ey;

    // Velocidades finais na colisão unidimensional
    const s1=((P.m1-P.e*P.m2)*w1+
              (1+P.e)*P.m2*w2)/M;

    const s2=((P.m2-P.e*P.m1)*w2+
              (1+P.e)*P.m1*w1)/M;

    u1=[s1*ex,s1*ey];
    u2=[s2*ex,s2*ey];

  }else{

    // Modelo bidimensional original
    phi=a1+P.dfl*R;

    if(cm>rho-1e-9){
      const psi=Math.atan2(c[1],c[0]),
            gam=Math.asin(Math.min(1,rho/cm)),
            d=wrap(phi-psi);

      all=false;
      dc=wrap(psi-a1)/R;
      gdeg=gam/R;

      if(Math.abs(d)>gam+1e-9){
        phi=psi+Math.sign(d)*gam;
        clamp=true;
      }
    }

    const ux=Math.cos(phi),uy=Math.sin(phi),
          uc=ux*c[0]+uy*c[1],
          sq=Math.sqrt(Math.max(0,uc*uc-cm*cm+rho*rho));

    two=cm>rho+1e-9 && uc-sq>1e-9;

    const s=Math.max(0,
      ($('c_alt').checked&&two)?uc-sq:uc+sq
    );

    u1=[s*ux,s*uy];

    u2=[
      c[0]-P.m1/P.m2*(u1[0]-c[0]),
      c[1]-P.m1/P.m2*(u1[1]-c[1])
    ];
  }
}
 
 return{M,v1,v2,c,u1,u2,hit,clamp,two,all,dc,gdeg,dUsed:wrap(phi-a1)/R,tEnd:TC+2.5,p1:[-v1[0]*TC,-v1[1]*TC],p2:[-v2[0]*TC,-v2[1]*TC]};
}
// Intervalo de θ₁ possível (graus, relativo a ang1): limites do slider (sl) e texto do rótulo (txt, LaTeX).
function thetaRange(s){
 if(!s.hit||s.all)return{sl:[-180,180],txt:'(qualquer valor)'};
 let lo=Math.ceil(s.dc-s.gdeg-1e-9),hi=Math.floor(s.dc+s.gdeg+1e-9);
 if(lo>hi)lo=hi=Math.round(s.dc);
 return{sl:(s.dc-s.gdeg<-180||s.dc+s.gdeg>180)?[-180,180]:[lo,hi],txt:'(possível: \\([\\,'+lo+'^\\circ,\\,'+hi+'^\\circ\\,]\\))'};
}
const en=(a,b)=>.5*P.m1*(a[0]*a[0]+a[1]*a[1])+.5*P.m2*(b[0]*b[0]+b[1]*b[1]);
// Evento da colisão em t = TC: troca as velocidades e registra o resultado em `rec`.
function collide(){
 const e0=en([A.vx,A.vy],[B.vx,B.vy]),px0=P.m1*A.vx+P.m2*B.vx,py0=P.m1*A.vy+P.m2*B.vy;
 [A.vx,A.vy]=su.u1;[B.vx,B.vy]=su.u2;
 rec={e0,e1:en(su.u1,su.u2),dp:Math.hypot(P.m1*A.vx+P.m2*B.vx-px0,P.m1*A.vy+P.m2*B.vy-py0)};
}
const row=()=>{const va=Math.hypot(A.vx,A.vy),vb=Math.hypot(B.vx,B.vy),px=P.m1*A.vx+P.m2*B.vx,py=P.m1*A.vy+P.m2*B.vy,ea=.5*P.m1*va*va,eb=.5*P.m2*vb*vb;return[t,va,vb,px,py,Math.hypot(px,py),ea,eb,ea+eb]};
const record=()=>{rows.push(row());tr.push([t,A.x,A.y,B.x,B.y])};

// ---- Controle ----
function reset(){
 su=setup();
 const rg=thetaRange(su);                              // limita o slider de θ₁ aos valores possíveis
 if(Sim.setRange('dfl',rg.sl[0],rg.sl[1]))su=setup();  // o valor foi ajustado: recalcula com o novo θ₁
 Sim.setLabel('dfl','Desvio de 1, \\(\\theta_1\\) <small>'+rg.txt+'</small>');
 A={x:su.p1[0],y:su.p1[1],vx:su.v1[0],vy:su.v1[1]};B={x:su.p2[0],y:su.p2[1],vx:su.v2[0],vy:su.v2[1]};
 t=0;rec=null;rows=[];tr=[];acc=0;paused=false;mode='idle';$('bp').textContent='Pausar';
}
function launch(){reset();mode='run';record()}
$('bl').onclick=launch;
$('bp').onclick=()=>{if(mode!=='run')return;paused=!paused;$('bp').textContent=paused?'Continuar':'Pausar'};
$('bc').onclick=reset;

// Passos fixos de DT. Se o instante TC cair dentro do passo, avança até TC, aplica a colisão e avança o resto.
function step(dt){
 if(mode!=='run'||paused)return;
 acc+=dt*P.spd;
 const mv=h=>{A.x+=A.vx*h;A.y+=A.vy*h;B.x+=B.vx*h;B.y+=B.vy*h;t+=h};
 while(acc>=DT){
  acc-=DT;
  if(!rec&&su.hit&&t<TC&&t+DT>=TC){const h=TC-t;mv(h);t=TC;collide();mv(DT-h)}else mv(DT);
  if(++cnt%2===0)record();
  if(t>=su.tEnd){record();mode='end';return}
 }
}

// Frase de situação mostrada sob o canvas (LaTeX; renderizada por MathJax quando o texto muda).
const M=x=>'\\('+x+'\\)',fm=Sim.fm;
function status(){
 if(!su.hit)return'Sem colisão: as velocidades são praticamente iguais ('+M('\\vec v_1\\approx\\vec v_2')+'), então as partículas não se aproximam.';
 if(rec)return'Colisão na origem em '+M('t='+fm(TC)+'\\,\\mathrm{s}')+'. '+M('K')+': '+M(fm(rec.e0)+'\\to '+fm(rec.e1)+'\\,\\mathrm{J}')+' ('+M('\\Delta K='+fm(rec.e1-rec.e0)+'\\,\\mathrm{J}')+'). Momento total conservado: '+M('|\\Delta\\vec p|='+fm(rec.dp))+'.';
 return'Colisão prevista na origem em '+M('t='+fm(TC)+'\\,\\mathrm{s}')+', com '+M('\\theta_1='+fm(su.dUsed)+'^\\circ')+(su.clamp?' (ajustado: o ângulo pedido era impossível)':'')+
  '; a partícula 2 sai a '+M(fm(dir(su.u2))+'^\\circ')+' do eixo '+M('x')+'. Perda prevista de '+M('K')+': '+M(fm(en(su.v1,su.v2)-en(su.u1,su.u2))+'\\,\\mathrm{J}')+'.'+
  (su.two?' Há uma 2ª solução para este '+M('\\theta_1')+' (caixa “Outra solução”).':'');
}

// ---- Desenho ----
// Mundo em metros (y para cima), com a origem no ponto da colisão; X() e Y() convertem para pixels.
// A janela é calculada a partir das posições em t = 0, TC e no fim. Partículas pontuais: desenhadas
// como pontos de tamanho fixo (a massa não altera o desenho).
function draw(){
 const C=css,W=fit.w,H=fit.h,vs=9;
 const pos=(i,tt)=>tt<=TC?[(i?su.p2:su.p1)[0]+(i?su.v2:su.v1)[0]*tt,(i?su.p2:su.p1)[1]+(i?su.v2:su.v1)[1]*tt]:[(i?su.u2:su.u1)[0]*(tt-TC),(i?su.u2:su.u1)[1]*(tt-TC)];
 let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
 [0,TC,su.tEnd].forEach(tt=>[0,1].forEach(i=>{const p=pos(i,tt);x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])}));
 const pad=1.5,bw=Math.max(x1-x0+2*pad,8),bh=Math.max(y1-y0+2*pad,5),cx=(x0+x1)/2,cy=(y0+y1)/2;
 const sc=Math.min((W-30)/bw,(H-30)/bh),X=x=>W/2+(x-cx)*sc,Y=y=>H/2-(y-cy)*sc,ox=X(0),oy=Y(0);
 ctx.clearRect(0,0,W,H);
 const lab=(s,x,y,col,al)=>{ctx.fillStyle=col;ctx.font=C('--normalfont');ctx.textAlign=al||'left';ctx.fillText(s,x,y)};
 const arr=(x,y,vx,vy,col,w,dash,tx)=>{ctx.setLineDash(dash?[5,4]:[]);arrow(ctx,X(x),Y(y),vx*vs,-vy*vs,col,w);ctx.setLineDash([]);
  if(tx&&Math.hypot(vx,vy)*vs>6)lab(tx,X(x)+vx*vs+(vx>=0?6:-6),Y(y)-vy*vs+4,col,vx>=0?'left':'right')};
 // grade e eixos x–y (origem no ponto da colisão), com marcas em metros
 const st=Sim.nice(Math.max(bw,bh)/9),gx0=cx-W/2/sc,gx1=cx+W/2/sc,gy0=cy-H/2/sc,gy1=cy+H/2/sc;
 ctx.lineWidth=1;ctx.strokeStyle=C('--grid');
 for(let g=Math.ceil(gx0/st)*st;g<=gx1;g+=st){ctx.beginPath();ctx.moveTo(X(g),0);ctx.lineTo(X(g),H);ctx.stroke()}
 for(let g=Math.ceil(gy0/st)*st;g<=gy1;g+=st){ctx.beginPath();ctx.moveTo(0,Y(g));ctx.lineTo(W,Y(g));ctx.stroke()}
 ctx.strokeStyle=C('--ink');ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(0,oy);ctx.lineTo(W,oy);ctx.moveTo(ox,0);ctx.lineTo(ox,H);ctx.stroke();
 ctx.font=C('--normalfont');ctx.fillStyle=C('--mut');
 for(let g=Math.ceil(gx0/st)*st;g<=gx1;g+=st)if(Math.abs(g)>1e-9){ctx.textAlign='center';ctx.fillText(+g.toFixed(6),X(g),oy+14)}
 for(let g=Math.ceil(gy0/st)*st;g<=gy1;g+=st)if(Math.abs(g)>1e-9){ctx.textAlign='right';ctx.fillText(+g.toFixed(6),ox-5,Y(g)+4)}
 lab('x (m)',W-8,oy-8,C('--ink'),'right');lab('y (m)',ox+8,14,C('--ink'));lab('O',ox+6,oy+14,C('--ink'));
 // ângulos de desvio na origem: semirreta da direção inicial (tracejada) e arco até a direção final
 const a1=P.ang1*R,a2=P.ang2*R,ph1=a1+su.dUsed*R,ph2=Math.atan2(su.u2[1],su.u2[0]);
 // fantasmas: velocidades previstas depois do choque, saindo da origem (somem após a colisão)
 if(su.hit&&!rec&&$('c_v').checked){arr(0,0,su.u1[0],su.u1[1],C('--vy'),2,true);arr(0,0,su.u2[0],su.u2[1],C('--vx'),2,true)}
 // rastros
 if($('c_tr').checked&&tr.length>1)[[1,2,C('--vy')],[3,4,C('--vx')]].forEach(([ix,iy,col])=>{
  ctx.strokeStyle=col;ctx.lineWidth=2;ctx.globalAlpha=.6;ctx.beginPath();
  tr.forEach((r,j)=>j?ctx.lineTo(X(r[ix]),Y(r[iy])):ctx.moveTo(X(r[ix]),Y(r[iy])));ctx.stroke();ctx.globalAlpha=1;

   if($('c_ang').checked&&su.hit)[[0,ph1,C('--vy'),'θ₁',P.v1>0.05],[0,ph2,C('--vx'),'θ₂',P.v2>0.05]].forEach(([ai,af,col,nm,on],j)=>{
//   if(!on)return;
  const d=wrap(af-ai),rr=44+j*14;
  ctx.setLineDash([5,4]);ctx.strokeStyle=col;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ox+Math.cos(ai)*(rr+26),oy-Math.sin(ai)*(rr+26));ctx.stroke();ctx.setLineDash([]);
  ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(ox,oy,rr,-ai,-ai-d,d>0);ctx.stroke();
  lab(nm+' = '+f2(d/R)+'°',ox+Math.cos(ai+d/2)*(rr+10),oy-Math.sin(ai+d/2)*(rr+10)+4,col,Math.cos(ai+d/2)>=0?'left':'right');
 });

 });
 // centro de massa: está na origem em t = TC e se move com a velocidade c
 const cmx=su.c[0]*(t-TC),cmy=su.c[1]*(t-TC);
 if($('c_cm').checked){
  ctx.strokeStyle=C('--ink');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(X(cmx)-6,Y(cmy));ctx.lineTo(X(cmx)+6,Y(cmy));ctx.moveTo(X(cmx),Y(cmy)-6);ctx.lineTo(X(cmx),Y(cmy)+6);ctx.stroke();
  lab('CM',X(cmx)+8,Y(cmy)-8,C('--ink'));arr(cmx,cmy,su.c[0],su.c[1],C('--ink'),3.2,false,'v_cm');
 }
 // partículas (pontos) e velocidades
 [[A,C('--vy'),'1','v₁'],[B,C('--vx'),'2','v₂']].forEach(([p,col,nm,vl])=>{
  ctx.fillStyle=col;ctx.beginPath();ctx.arc(X(p.x),Y(p.y),12.0,0,7);ctx.fill();
  if($('c_v').checked)arr(p.x,p.y,p.vx,p.vy,col,2.8,false,vl);
  lab(nm,X(p.x),Y(p.y)+4,C('--sky'),'center');
 });
 // leituras, texto e gráficos
 const r0=row(),e00=en(su.v1,su.v2);
 out('t',t);out('p',r0[5]);out('ec',r0[8]);out('dec',r0[8]-e00);out('v1',r0[1]);out('v2',r0[2]);out('a1',dir([A.vx,A.vy]));out('a2',dir([B.vx,B.vy]));
 {const st=status();if(st!==lastSt){lastSt=st;$('cmp').textContent=st;Sim.math($('cmp'))}}   // só re-renderiza quando o texto muda
 plots.forEach(p=>p.draw(rows,null,su.tEnd));
}
Sim.urlLoad();
reset();
Sim.urlButton(cv);
Sim.loop(dt=>{step(dt);draw()});
})();
