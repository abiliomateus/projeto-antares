// init.js

// 1. Função utilitária para carregar arquivos CSS dinamicamente
function carregarCSS(url) {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = resolve;
        link.onerror = reject;
        document.head.appendChild(link);
    });
}

// 2. Função utilitária para carregar arquivos JS dinamicamente
function carregarJS(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = false; // Garante execução na ordem em que terminar de baixar
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// 3. Orquestrador de carregamento das dependências
async function inicializarPagina() {
    try {
        console.log("Carregando estilos e plugins...");

        await Promise.all([
            carregarCSS('/css/core.css'),
       ]);

        await carregarJS('/js/mathjax-config.js');
        await carregarJS('/js/mathjax/tex-svg.js');

        // -> ADICIONE OUTROS PLUGINS (ex: jQuery, Axios) AQUI:

        console.log("Todos os scripts e plugins foram carregados com sucesso!");

    } catch (error) {
        console.error("Erro ao carregar dependências automáticas:", error);
    }
}
// Executa a função assim que o init.js for lido
inicializarPagina();


document.addEventListener("DOMContentLoaded", function () {
    const header = document.querySelector("header");

    if (header) {
        header.insertAdjacentHTML("afterbegin", `
            <h1 class="header">
                <img src="/img/icons/antares-512.png"
                     height="45em"
                     alt=""
                     style="vertical-align: middle; margin-right: 10px;">
                Projeto Antαres
            </h1>
            <p class="header">
                Recursos Educacionais em Física e Astronomia
            </p>
        `);
    }
    const footer = document.querySelector("footer");

    if (footer) {
        footer.insertAdjacentHTML("afterbegin", `
            <div  class="licenca">
              <p>
    Projeto Antαres · Criado por
    <a href="https://antares.ufsc.br">Prof. Abílio Mateus (antares.ufsc.br)</a>
  </p>
  <p>
    <span id="versao"></span>
    · Conteúdo sob licença
    <a href="https://creativecommons.org/licenses/by-nc/4.0/deed.pt_BR"
       target="_blank" rel="license noopener">
      CC BY-NC 4.0
    </a>
  </p>
  </div>
        `);
    }
    carregarJS('/js/version.js');

    const description = document.getElementById("sim-description");

    if (description) {
        description.insertAdjacentHTML('beforeend','<p class="note" style="margin: 0 0 1em">&#8680; Dica: use o botão de configuração (&#9881) para ajustar os valores das variáveis.</p>');
        description.insertAdjacentHTML('beforeend', `
        <p class="dica-orientacao">
          ↻ Dica: use o celular na horizontal para aproveitar melhor a simulação!
        </p>
        `);
    }
});


