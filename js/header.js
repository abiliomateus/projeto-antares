document.addEventListener("DOMContentLoaded", function () {
    const header = document.querySelector("header");

    if (header) {
        header.insertAdjacentHTML("afterbegin", `
            <h1 class="header">
                <img src="/img/icons/antares-512.png"
                     height="40em"
                     alt=""
                     style="vertical-align: middle; margin-right: 10px;">
                projeto antαres
            </h1>
            <p class="header">
                Acessibilidade de Recursos Educacionais em Física e Astronomia
            </p>
        `);
    }
});