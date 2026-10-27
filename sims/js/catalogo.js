/* =====================================================================
   catalogo.js: lista de simulações exibida por index.html (o menu).

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
     titulo, subtitulo      textos do topo da página
     agruparPorTopico       true = um bloco por tópico; false = uma grade única
     mostrarBusca           caixa de busca (título, descrição e tags)
     mostrarFiltros         botões de filtro por tópico
     mostrarEmBreve         exibe (ou esconde) as simulações com disponivel:false
     mostrarTema            botão que alterna tema automático / claro / escuro (vale para todas as páginas)
     abrirEmNovaAba         abre as simulações em outra aba
   ===================================================================== */
(function(){
const S='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
const IC={
 generico:S+'<circle cx="24" cy="24" r="14"/><path d="M24 14v10l7 5"/></svg>',
 projetil:S+'<path d="M5 40Q24-12 43 40" stroke-dasharray="4 4"/><circle cx="24" cy="14" r="4" fill="currentColor" stroke="none"/><path d="M3 42h42"/></svg>',
 inclinado:S+'<path d="M5 41H43L5 13Z"/><rect x="10" y="13" width="9" height="9" transform="rotate(36 15.5 19.5)" fill="currentColor" stroke="none"/> </svg>',
 blocos:S+'<path d="M8.12 25.52 21.18 12.66M38.7 24.42 25.41 11.91M3.49 38.39l19.63-19.6M44.22 38.59 24.59 18.99"/><circle cx="23.72" cy="15.2" r="3.58"/><g fill="currentColor" stroke="none"><rect width="9" height="9" x="-18.5" y="20.7" transform="rotate(-44.23)"/><rect width="9" height="9" x="45.49" y="4" transform="matrix(.7166 .69748 .69748 -.7166 0 0)"/></g></svg>',
 blocosplano:S+'<path d="M9 12.0 21 12.0M38.7 24.42 25.41 11.91M0 19l23-0M44.22 38.59 24.59 18.99"/><circle cx="23.72" cy="15.2" r="3.58"/><g fill="currentColor" stroke="none"><rect width="9" height="9" x="3" y="8.7"/><rect width="9" height="9" x="45.49" y="4" transform="matrix(.7166 .69748 .69748 -.7166 0 0)"/></g></svg>',
 colisao:S+'<circle cx="14" cy="26" r="4.0" fill="currentColor" stroke="none"/><circle cx="30" cy="26" r="5.0" fill="currentColor" stroke="none"/><path d="M0 26h8M36 21l8-9M36 31l8 9"/></svg>',
 colisao1d:S+'<path d="M0 26H8 M37 26H48"/><circle cx="14" cy="26" r="4" fill="currentColor" stroke="none"/><circle cx="30" cy="26" r="5" fill="currentColor" stroke="none"/></svg>',
 atwood:S+'<circle cx="24" cy="12" r="6"/><path d="M18 12v20M30 12v12"/><rect x="14" y="32" width="8" height="8" fill="currentColor" stroke="none"/><rect x="26" y="24" width="8" height="8" fill="currentColor" stroke="none"/></svg>',
 oscilador:S+'<path d="M5 24 C7 24 7 16 9 16 S11 32 13 32 S15 16 17 16 S19 32 21 32 S23 16 25 16 S27 32 29 32 S31 16 33 16 S35 32 37 32 S39 24 43 24"/></svg>',
 rolamento:S+'<path d="M4 14L44 40"/><circle cx="30" cy="21" r="7"/></svg>',
 giro:S+'<path d="M38 24a14 14 0 1 1-6-11.5"/><path d="M32 7v6h6"/></svg>',
 loop:S+'<path d="M2 11 C5 20 10 32 20 37 H46"/><circle cx="32" cy="28" r="9"/><circle cx="8" cy="16" r="3.5" fill="currentColor" stroke="none"/></svg>',
 orbita:S+'<ellipse cx="24" cy="24" rx="19" ry="11"/><circle cx="24" cy="24" r="4.5" fill="currentColor" stroke="none"/><circle cx="42" cy="20" r="3" fill="currentColor" stroke="none"/></svg>',
 pendulo:S+'<path d="M12 6h24"/><path d="M24 6V22" stroke-dasharray="2 3"/><circle cx="24" cy="22" r="2.5" fill="currentColor" stroke="none"/><path d="M24 6L10 38"/><circle cx="10" cy="38" r="4.5" fill="currentColor" stroke="none"/><path d="M24 22L38 38" stroke-dasharray="2 3"/><circle cx="38" cy="38" r="4.5" stroke-dasharray="2 4" fill=var(--card) /></svg>',
};
window.CATALOGO={
 opcoes:{
  titulo:'Simulações de Física e Astronomia',
  subtitulo:'Mecânica básica: cinemática, leis de Newton, momento, rotação e gravitação. Cada simulação roda direto no navegador.',
  agruparPorTopico:true,mostrarBusca:true,mostrarFiltros:true,mostrarEmBreve:false,mostrarTema:false,abrirEmNovaAba:false
 },
 topicos:[
  {id:'cinematica',nome:'Cinemática',descricao:'Movimento em uma e duas dimensões'},
  {id:'newton',nome:'Dinâmica', descricao:'Aplicações das leis de Newton'},
  {id:'momento',nome:'Momento e colisões',descricao:'Conservação do momento linear'},
  {id:'energia',nome:'Energia',descricao:''},
  {id:'rotacao',nome:'Rotação',descricao:''},
  {id:'gravitacao',nome:'Gravitação',descricao:''},
  {id:'fluidos',nome:'Mecânica dos fluidos',descricao:''},
  {id:'oscilacoes',nome:'Oscilações',descricao:''},
  {id:'ondas',nome:'Ondas',descricao:''},
  {id:'termodinamica',nome:'Termodinâmica',descricao:''},
  {id:'eletromagnetismo',nome:'Eletromagnetismo',descricao:''},
 ],
 simulacoes:[
  {id:'projeteis',titulo:'Movimento de projéteis',descricao:'Trajetória com e sem resistência do ar, vetores de velocidade e gráficos de \\(x(t)\\), \\(y(t)\\) e \\(\\vec v(t)\\).',topico:'cinematica',tags:['aceleração constante','arrasto','gráficos'],arquivo:'projeteis.html',icone:IC.projetil},
  {id:'inclinado',titulo:'Plano inclinado',descricao:'Bloco em um plano inclinado, com e sem atrito, com todas as forças que atuam sobre ele \\((\\vec F_g, \\vec N, \\vec f)\\).',topico:'newton',tags:['atrito','forças'],arquivo:'inclinado.html',icone:IC.inclinado},
  {id:'atwood',titulo:'Máquina de Atwood',descricao:'Duas massas ligadas por uma polia: aceleração e tração.',topico:'newton',tags:['polia'],arquivo:'atwood.html',disponivel:true,icone:IC.atwood},
  {id:'blocos-plano',titulo:'Blocos conectados',descricao:'Um bloco em um plano horizontal está conectado a outro sobre um plano inclinado. A corda ideal que os conecta passa por uma polia também ideal.',topico:'newton',tags:['polia','tração','atrito'],arquivo:'blocos-plano.html',icone:IC.blocosplano},
  {id:'blocos',titulo:'Blocos conectados',descricao:'Blocos em planos inclinados por diferentes ângulos estão conectados por uma corda ideal que passa por uma polia também ideal.',topico:'newton',tags:['polia','tração','atrito'],arquivo:'blocos.html',icone:IC.blocos},
  {id:'loop',titulo:'Conservação de energia no loop',descricao:'Conservação de energia para uma partícula solta de uma altura \\(h\\) que percorre um loop de raio \\(R\\).',topico:'energia',tags:['energia','loop','normal'],arquivo:'loop.html',icone:IC.loop},
  {id:'colisao1d',titulo:'Colisão em 1D',descricao:'Aplicação da conservação do momento linear na colisão em uma dimensão.',topico:'momento',tags:['momento','restituição','1D'],arquivo:'colisao1d.html',icone:IC.colisao1d},
  {id:'colisao',titulo:'Colisão em 2D',descricao:'Aplicação da conservação do momento linear na colisão de partículas pontuais.',topico:'momento',tags:['momento','restituição','2D'],arquivo:'colisao.html',icone:IC.colisao},
  {id:'pendulo',titulo:'Pêndulo de Galileu',descricao:'Um pino prende o fio, mas a partícula sobe de novo até a altura \\(h\\): conservação de energia, tração \\(T\\) e força gravitacional \\(\\vec F_g\\).',topico:'energia',tags:['pêndulo','energia','pino'],arquivo:'pendulo.html',icone:IC.pendulo},
  {id:'doiscorpos',titulo:'Problema de dois corpos',descricao:'Dois corpos em órbita em torno de um centro de massa comum.',topico:'gravitacao',tags:['órbitas'],disponivel:true,arquivo:'doiscorpos.html',icone:IC.orbita},
  {id:'massamola',titulo:'Massa-mola com e sem arrasto',descricao:'Oscilador harmônico clássico com ou sem amortecimento.',topico:'oscilacoes',tags:['oscilador','atrito','energia'],arquivo:'massamola.html',icone:IC.oscilador},
  // ---- em breve (sem arquivo: aparecem como cartão desativado) ----
  {id:'rolamento',titulo:'Rolamento em plano inclinado',descricao:'Disco, anel e esfera: quem chega primeiro? Momento de inércia \\(I\\).',topico:'rotacao',tags:['inércia'],disponivel:false,icone:IC.rolamento},
  {id:'momang',titulo:'Conservação do momento angular',descricao:'Patinadora que encolhe os braços: \\(L = I\\omega\\) constante.',topico:'rotacao',tags:['momento angular'],disponivel:false,icone:IC.giro},
 ]
};
})();
