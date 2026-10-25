/* =====================================================================
   catalogo.js: lista de simulações exibida por simulacoes.html (o menu das simulações).

   PARA ADICIONAR UMA SIMULAÇÃO: acrescente um objeto em `simulacoes` (basta copiar um existente).
     id          identificador único (sem espaços)
     titulo      título do cartão (aceita HTML e LaTeX \( ... \), escrito aqui como '\\( ... \\)')
     descricao   frase curta (aceita HTML e LaTeX)
     topico      id de um dos `topicos` abaixo (o cartão aparece nesse grupo)
     tags        lista de palavras-chave (aparecem no cartão e entram na busca)
     arquivo     caminho ou URL da página (ex.: 'atwood.html')
     disponivel  false = cartão "em breve", sem link (padrão: true)
     icone       SVG em texto (viewBox 0 0 48 48, cor = currentColor); sem ele, usa um ícone genérico
   PARA ADICIONAR UM TÓPICO: acrescente {id, nome} em `topicos` (a ordem define a ordem dos grupos).
   OPÇÕES (todas opcionais):
     voltar                 {rotulo, url}: mostra "← rotulo" no topo, apontando para o portal do projeto (index.html)
     titulo, subtitulo      textos do topo da página
     agruparPorTopico       true = um bloco por tópico; false = uma grade única
     mostrarBusca           caixa de busca (título, descrição e tags)
     mostrarFiltros         botões de filtro por tópico
     mostrarEmBreve         exibe (ou esconde) as simulações com disponivel:false
     mostrarTema            botão que alterna tema automático / claro / escuro (vale para todas as páginas)
     abrirEmNovaAba         abre as simulações em outra aba
   ===================================================================== */
(function(){
const S='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">';
const IC={
 generico:S+'<circle cx="24" cy="24" r="14"/><path d="M24 14v10l7 5"/></svg>',
 projetil:S+'<path d="M5 40Q24-12 43 40" stroke-dasharray="4 4"/><circle cx="24" cy="14" r="4" fill="currentColor" stroke="none"/><path d="M3 42h42"/></svg>',
 inclinado:S+'<path d="M5 41H43L5 13Z"/><rect x="11" y="15" width="9" height="9" transform="rotate(36 15.5 19.5)" fill="currentColor" stroke="none"/></svg>',
 blocos:S+'<path d="M4 41L24 14L44 41"/><circle cx="24" cy="11" r="3.5"/><rect x="9" y="25" width="8" height="8" transform="rotate(-54 13 29)" fill="currentColor" stroke="none"/><rect x="31" y="26" width="8" height="8" transform="rotate(54 35 30)" fill="currentColor" stroke="none"/></svg>',
 colisao:S+'<circle cx="14" cy="26" r="4.5" fill="currentColor" stroke="none"/><circle cx="30" cy="26" r="4.5" fill="currentColor" stroke="none"/><path d="M2 26h4M36 21l8-9M36 31l8 9"/></svg>',
 atwood:S+'<circle cx="24" cy="12" r="6"/><path d="M18 12v20M30 12v12"/><rect x="14" y="32" width="8" height="8" fill="currentColor" stroke="none"/><rect x="26" y="24" width="8" height="8" fill="currentColor" stroke="none"/></svg>',
 oscilador:S+'<path d="M4 24h8l3-9 6 18 6-18 3 9h14"/></svg>',
 rolamento:S+'<path d="M4 14L44 40"/><circle cx="21" cy="21" r="7"/></svg>',
 giro:S+'<path d="M38 24a14 14 0 1 1-6-11.5"/><path d="M32 7v6h6"/></svg>',
 loop:S+'<path d="M3 8L12 38Q14 41 17 41H44"/><circle cx="30" cy="26" r="11" stroke-dasharray="3 3"/><circle cx="8" cy="20" r="3.5" fill="currentColor" stroke="none"/></svg>',
 pendulo:S+'<path d="M12 6h24"/><path d="M24 6V22" stroke-dasharray="2 3"/><circle cx="24" cy="22" r="2.5" fill="currentColor" stroke="none"/><path d="M24 6L10 38"/><circle cx="10" cy="38" r="4.5" fill="currentColor" stroke="none"/><path d="M24 22L38 38" stroke-dasharray="3 3"/><circle cx="38" cy="38" r="4.5" stroke-dasharray="3 3"/></svg>',
 orbita:S+'<ellipse cx="24" cy="24" rx="19" ry="11"/><circle cx="24" cy="24" r="3.5" fill="currentColor" stroke="none"/><circle cx="41" cy="20" r="2.5" fill="currentColor" stroke="none"/></svg>'
};
window.CATALOGO={
 opcoes:{
  titulo:'Simulações de física',
  subtitulo:'Mecânica básica: cinemática, leis de Newton, momento, rotação e gravitação. Cada simulação roda direto no navegador.',
  agruparPorTopico:true,mostrarBusca:true,mostrarFiltros:true,mostrarEmBreve:true,mostrarTema:true,abrirEmNovaAba:false,
  voltar:{rotulo:'Projeto Antares',url:'index.html'}
 },
 topicos:[
  {id:'cinematica',nome:'Cinemática'},
  {id:'newton',nome:'Leis de Newton'},
  {id:'energia',nome:'Energia'},
  {id:'momento',nome:'Momento e colisões'},
  {id:'oscilacoes',nome:'Oscilações'},
  {id:'rotacao',nome:'Rotação'},
  {id:'gravitacao',nome:'Gravitação'}
 ],
 simulacoes:[
  {id:'projeteis',titulo:'Lançamento de projéteis',descricao:'Trajetória com e sem resistência do ar, vetores de velocidade e gráficos de \\(x(t)\\), \\(y(t)\\) e \\(v(t)\\).',topico:'cinematica',tags:['RK4','arrasto','gráficos'],arquivo:'projeteis.html',icone:IC.projetil},
  {id:'inclinado',titulo:'Plano inclinado',descricao:'Bloco com e sem atrito, com todas as forças (\\(\\vec P\\), \\(\\vec N\\), \\(\\vec f\\)) e balanço de energia.',topico:'newton',tags:['atrito','forças','energia'],arquivo:'inclinado.html',icone:IC.inclinado},
  {id:'blocos',titulo:'Blocos conectados por polia',descricao:'Dois planos de mesma altura \\(H\\) e ângulos \\(\\alpha\\) e \\(\\beta\\); tensão \\(T\\), atrito e energia.',topico:'newton',tags:['polia','tensão','atrito'],arquivo:'blocos.html',icone:IC.blocos},
  {id:'loop',titulo:'Conservação de energia no loop',descricao:'Partícula solta de uma altura \\(h\\) percorre um loop de raio \\(R\\): \\(E_c\\), \\(E_p\\), normal \\(N\\), atrito e perda de contato.',topico:'energia',tags:['energia','loop','normal'],arquivo:'loop.html',icone:IC.loop},
  {id:'colisao',titulo:'Colisão em 2D',descricao:'Partículas pontuais com restituição \\(e\\) e ângulo de desvio \\(\\theta_1\\); conservação do momento linear.',topico:'momento',tags:['momento','restituição','2D'],arquivo:'colisao.html',icone:IC.colisao},
  // ---- em breve (sem arquivo: aparecem como cartão desativado) ----
  {id:'atwood',titulo:'Máquina de Atwood',descricao:'Duas massas ligadas por uma polia: aceleração e tensão.',topico:'newton',tags:['polia'],disponivel:false,icone:IC.atwood},
  {id:'pendulo',titulo:'Pêndulo de Galileu',descricao:'Um pino prende o fio, mas a partícula sobe de novo até a altura \\(h\\): conservação de energia, tensão \\(T\\) e força gravitacional \\(\\vec F_g\\).',topico:'oscilacoes',tags:['pêndulo','energia','pino'],arquivo:'pendulo.html',icone:IC.pendulo},
  {id:'massamola',titulo:'Massa-mola com e sem arrasto',descricao:'Oscilador amortecido com arrasto \\(F_d=-bv\\): regimes sub, crítico e superamortecido, \\(\\zeta\\), retrato de fase e energia dissipada.',topico:'oscilacoes',tags:['oscilador','amortecimento','energia'],arquivo:'massamola.html',icone:IC.oscilador},
  {id:'rolamento',titulo:'Rolamento em plano inclinado',descricao:'Disco, anel e esfera: quem chega primeiro? Momento de inércia \\(I\\).',topico:'rotacao',tags:['inércia'],disponivel:false,icone:IC.rolamento},
  {id:'momang',titulo:'Conservação do momento angular',descricao:'Patinadora que encolhe os braços: \\(L = I\\omega\\) constante.',topico:'rotacao',tags:['momento angular'],disponivel:false,icone:IC.giro},
  {id:'kepler',titulo:'Órbitas e leis de Kepler',descricao:'Áreas iguais em tempos iguais, elipses e velocidade de escape.',topico:'gravitacao',tags:['órbitas'],disponivel:false,icone:IC.orbita}
 ]
};
})();
