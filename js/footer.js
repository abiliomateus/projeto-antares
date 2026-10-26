document.addEventListener("DOMContentLoaded", function () {
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