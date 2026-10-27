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
});

carregarJS('/js/version.js');
