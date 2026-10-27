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
    const footer = document.querySelector("footer");

    if (footer) {
        footer.insertAdjacentHTML("afterbegin", `
            <div  class="licenca">
              <p>
    Este trabalho está licenciado sob uma Licença
    <a href="https://creativecommons.org/licenses/by-nc/4.0/deed.pt-br"
       rel="license">
      <em>Creative Commons Atribuição-NãoComercial 4.0 Internacional</em>
    </a>.
  </p>
  </div>
        `);
    }
});