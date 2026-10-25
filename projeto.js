/* =====================================================================
   projeto.js: conteúdo do portal do Projeto Antares (index.html).
   Os textos abaixo são MODELOS: troque pelos reais. Nada precisa ser mudado no index.html.

   COMO EXPANDIR
     Nova seção:  acrescente {id, titulo, descricao, itens:[...]} em `secoes` (a ordem define a ordem na página
                  e na barra de navegação). Seções sem itens não aparecem.
     Novo item:   copie um objeto de `itens` e mude os campos:
        titulo       título do cartão (aceita HTML e LaTeX \( ... \), escrito aqui como '\\( ... \\)')
        descricao    texto curto (aceita HTML e LaTeX)
        arquivo      página ou URL de destino (ex.: 'simulacoes.html', 'https://...', 'material/notas.pdf');
                     vazio = cartão sem link
        botao        texto do link no cartão (padrão: 'Abrir')
        imagem       caminho/URL de uma imagem (ex.: a capa do livro); substitui o ícone
        icone        SVG em texto (viewBox 0 0 48 48, cor = currentColor); sem ele, usa um ícone genérico
        tags         lista de palavras-chave exibidas no cartão
        destaque     true = cartão largo (ocupa duas colunas)
        novaAba      true/false = abre este item em outra aba (sobrepõe a opção geral)
        disponivel   false = cartão desativado, sem link, com a marca "em breve"
   OPÇÕES (todas opcionais):
     nome, subtitulo, logo (imagem ao lado do nome), mostrarNav (chips de navegação por seção),
     mostrarTema (botão de tema automático/claro/escuro, que vale em todas as páginas), abrirEmNovaAba
   OUTROS CAMPOS
     sobre        HTML do bloco de apresentação (opcional)
     rodape       {texto, links:[{rotulo, url}]}
   ===================================================================== */
(function(){
const S='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">';
const IC={
 generico:S+'<circle cx="24" cy="24" r="14"/><path d="M24 14v10l7 5"/></svg>',
 simulacoes:S+'<path d="M5 40Q24-12 43 40" stroke-dasharray="4 4"/><circle cx="24" cy="14" r="4" fill="currentColor" stroke="none"/><path d="M3 42h42"/><path d="M8 8v10M8 8h10" /></svg>',
 livro:S+'<path d="M8 9h13a4 4 0 0 1 3 1.5V40a4 4 0 0 0-3-1.5H8z"/><path d="M40 9H27a4 4 0 0 0-3 1.5V40a4 4 0 0 1 3-1.5h13z"/></svg>',
 material:S+'<path d="M12 6h18l8 8v28H12z"/><path d="M30 6v8h8"/><path d="M18 25h14M18 31h14M18 37h8"/></svg>'
};
window.PROJETO={
 opcoes:{
  nome:'',
  subtitulo:'',
  mostrarNav:true,mostrarTema:false,abrirEmNovaAba:false,mostrarFiltros:true,
 },
 sobre:'<p>Projeto para elaboração e distribuição de material de apoio (livros e notas de aula), nas áreas de Física e Astronomia, seguindo o modelo dos chamados Recursos Educacionais Abertos (do inglês, Open Educational Resources, sigla OER).</p>',
 secoes:[
  {id:'simulacoes',titulo:'Simulações',descricao:'Animações interativas que rodam direto no navegador, sem instalar nada.',itens:[
   {titulo:'Simulações de Física e Astronomia',descricao:'Mecânica básica: cinemática, leis de Newton, energia, momento e oscilações, com gráficos em tempo real, forças e as equações de cada modelo. Rotação e gravitação virão a seguir.',arquivo:'simulations/index.html',botao:'Abrir as simulações',tags:['mecânica','interativo','gráficos'],icone:IC.simulacoes,destaque:true}
  ]},
  {id:'livro',titulo:'Livros',descricao:'Publicações do projeto.',itens:[
   {titulo:'Física - Volume 1',descricao:'Um texto introdutório sobre cinemática, dinâmica e conservação do momento e da energia.',imagem:'img/FISICA1-capa.png',arquivo:'https://doi.org/10.5281/zenodo.16541433',botao:'Ver o livro',tags:['fundamentos', 'vetores', 'forças', 'cinemática', 'dinâmica', 'momento', 'energia', 'inércia'],icone:IC.livro}, {titulo:'Física - Volume 2',descricao:'Um texto introdutório sobre movimentos rotacionais, oscilatórios, ondulatórios, fluidos e termodinâmica.',imagem:'img/FISICA2-capa.png',arquivo:'',botao:'Ver o livro',tags:['rotação', 'gravitação', 'oscilação', 'ondas', 'fluidos', 'temperatura', 'energia térmica', 'entropia'],icone:IC.livro, disponivel: false}, {titulo:'Física - Volume 3',descricao:'Um texto introdutório sobre os princípios fundamentais do eletromagnetismo.',imagem:'img/FISICA3-capa.png',arquivo:'',botao:'Ver o livro',tags:['campo elétrico', 'lei de Gauss', 'potencial elétrico', 'capacitância', 'circuitos', 'campo magnético', 'lei de Faraday'],icone:IC.livro, disponivel: false}, {titulo:'Física - Volume 4',descricao:'Um texto introdutório sobre correntes alternadas, ondas eletromagnéticas e física moderna.',imagem:'img/FISICA4-capa.png',arquivo:'',botao:'Ver o livro',tags:['corrente alternada', 'ondas eletromagnéticas', 'interferência', 'difração', 'relatividade', 'física quântica'],icone:IC.livro, disponivel: false}
  ]},
  {id:'material',titulo:'Outros',descricao:'Textos, listas e outros recursos de apoio.',itens:[
   {titulo:'Título do material',descricao:'Notas de aula, listas de exercícios, roteiros ou outros materiais.',arquivo:'',botao:'Abrir',tags:['material didático'],icone:IC.material}
  ]}
 ],
 rodape:{
  texto:'',
  links:[]
 }
};
})();
