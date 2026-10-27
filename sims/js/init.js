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
        script.async = true; // Garante execução na ordem em que terminar de baixar
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
        await carregarJS('https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js');

        // -> ADICIONE OUTROS PLUGINS (ex: jQuery, Axios) AQUI:

        console.log("Todos os scripts e plugins foram carregados com sucesso!");

    } catch (error) {
        console.error("Erro ao carregar dependências automáticas:", error);
    }
}

// Executa a função assim que o init.js for lido
inicializarPagina();

