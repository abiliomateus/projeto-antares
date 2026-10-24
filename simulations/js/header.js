document.addEventListener("DOMContentLoaded", function () {
    const header = document.querySelector("header");

    if (header) {
        header.insertAdjacentHTML("afterbegin", `
            <a href="index.html"><h1 class="header">
                <img src="img/antares-circle.png"
                     height="48"
                     alt=""
                     style="vertical-align: middle; margin-right: 10px;">
                Projeto Antαres
            </h1></a>
            <p class="header">
                Acessibilidade de Recursos Educacionais em Física e Astronomia (
                <a href="https://antares.ufsc.br">
                    antares.ufsc.br
                </a>)
            </p>
        `);
    }
});