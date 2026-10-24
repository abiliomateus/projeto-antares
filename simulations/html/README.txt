# Simulações de física: guia de modificação

Pacote em HTML, CSS e JavaScript puro. Não precisa de instalação nem de internet: abra `projeteis.html` com duplo clique. Os quatro arquivos devem ficar na mesma pasta.

## Arquivos

| Arquivo | Papel | Edite quando quiser... |
|---|---|---|
| `core.js` | Núcleo reutilizável (`Sim`): integrador, loop, sliders, leituras, setas, gráficos | mudar comportamento comum a todas as simulações |
| `core.css` | Cores e layout compartilhados | trocar paleta, espaçamentos, pontos de quebra |
| `projeteis.js` | Física e desenho do lançamento | mudar equações, parâmetros, o que é desenhado |
| `projeteis.html` | Esqueleto da página e textos | mudar títulos, ordem dos blocos, opções de planeta |

Há comentários em cada bloco dos arquivos explicando o que ele faz e onde mexer.

## Como a simulação funciona

1. Os sliders escrevem os valores no objeto `P` (por exemplo `P.v0`, `P.ang`).
2. Qualquer mudança de slider chama `reset()`, que volta ao modo `'idle'` (pré-visualização com a parábola ideal).
3. O botão Lançar chama `launch()` e o modo vira `'fly'`.
4. A cada quadro, `step(dt)` avança a física em **passos fixos de 1/240 s** (o resultado não depende do computador) e `draw()` redesenha.
5. Ao cruzar y = 0, o modo vira `'land'` e o alcance é calculado por interpolação.

O estado do projétil é um array `[x, y, vx, vy]`. Os dados dos gráficos são linhas `[t, x, y, |v|, vx, vy]`.

## API do `core.js`

| Função | O que faz |
|---|---|
| `Sim.rk4(f, q, h)` | Um passo de Runge-Kutta 4. `f(q)` devolve as derivadas de `q`. |
| `Sim.fit(canvas, prop, hMin, hMax)` | Canvas responsivo e nítido. Devolve `{w, h}` sempre atualizado. |
| `Sim.loop(fn)` | Animação; chama `fn(dt)` a cada quadro. |
| `Sim.controls(box, defs, P, onChange)` | Cria sliders. `defs` = `{id, label, unit, min, max, step, val}`. |
| `Sim.readouts(box, itens)` | Painel de valores. Devolve `set(chave, valor)`. |
| `Sim.arrow(ctx, x, y, dx, dy, cor, esp)` | Seta em pixels (y cresce para baixo). |
| `new Sim.Plot(canvas, {title, series})` | Gráfico temporal. `.draw(rows, ideal, tf)`. |
| `Sim.css('--var')` | Lê uma cor do tema atual. Use no canvas em vez de cores fixas. |
| `Sim.f2(v)`, `Sim.nice(x)`, `Sim.$(id)` | Formatação, espaçamento de eixos, atalho do DOM. |

## Adaptações pontuais (receitas)

**Mudar valores iniciais ou limites de um slider.** Em `projeteis.js`, na lista de `Sim.controls`, edite `val`, `min`, `max` ou `step`.

**Adicionar um parâmetro (ex.: velocidade do vento).**
1. Inclua `{id:'vento', label:'Vento', unit:'m/s', min:-20, max:20, step:.5, val:0}` na lista de sliders.
2. Em `deriv()`, use `P.vento`. Por exemplo, calcule o arrasto com a velocidade relativa ao ar: `const rx=q[2]-P.vento, sp=Math.hypot(rx,q[3])` e então `-P.k*sp*rx` na primeira aceleração e `-P.k*sp*q[3]` na segunda.
3. A solução analítica `ideal()` continua valendo como referência sem arrasto e sem vento.

**Mudar a física.** Tudo está em `deriv(q)`. Ela devolve `[dx/dt, dy/dt, dvx/dt, dvy/dt]`. Para um novo efeito (Magnus, gravidade variável), some a aceleração nova nas duas últimas posições.

**Mais precisão numérica.** Diminua `DT` no topo de `projeteis.js` (1/240 s por padrão).

**Mudar a condição de parada.** Em `step()`, altere o teste `n[1]<0` (cruzar o chão). Exemplo: parar ao bater numa parede em `x = 30` usando `n[0]>30`.

**Acrescentar corpos celestes.** Em `projeteis.html`, inclua uma `<option value="g em m/s²">Nome</option>` no `<select id="pl">`.

**Novo gráfico.**
1. No HTML, dentro de `.plots`, crie `<div class="card"><div><canvas id="p4"></canvas></div></div>`.
2. No JS, adicione `new Sim.Plot($('p4'), {title:'...', series:[{col:N, name:'...', color:'--acc'}]})` ao array `plots`.
3. Se a coluna `N` for nova, acrescente o valor em `row()` e em `id()` (dentro de `draw`), na mesma posição.

**Trocar cores ou tema.** Edite só as variáveis no começo de `core.css`. Estão em três lugares: claro, escuro automático e escuro forçado (`data-theme="dark"`).

**Mudar idioma ou formato numérico.** Textos estão no HTML e em strings do JS. A vírgula decimal é definida em `Sim.f2` (e nos sliders em `Sim.controls`).

**Mostrar menos gráficos ou setas.** Apague o `<div class="card">` do canvas no HTML e a linha correspondente em `plots`. Para as setas, remova a caixa de seleção e o bloco `if($('cv_v').checked)` em `draw()`.

## Criar uma nova simulação (ex.: plano inclinado)

1. Copie `projeteis.html` para `inclinado.html`, troque o `<script src="projeteis.js">` por `inclinado.js` e ajuste os textos e ids.
2. Crie `inclinado.js` com este esqueleto:

```js
(function(){
  const {$, rk4, arrow, css} = Sim, DT = 1/240, P = {};
  const cv = $('cv'), ctx = cv.getContext('2d'), fit = Sim.fit(cv, .58, 260, 520);
  let q = [0, 0], t = 0;                       // estado: ajuste ao seu problema

  Sim.controls($('ctl'), [
    {id:'ang', label:'Ângulo', unit:'°', min:0, max:60, step:1, val:30}
  ], P, () => { q = [0, 0]; t = 0; });         // reinicia ao mexer num slider

  const deriv = q => [q[1], 9.8*Math.sin(P.ang*Math.PI/180)];  // dq/dt

  let acc = 0;
  Sim.loop(dt => {
    acc += dt;
    while (acc >= DT) { q = rk4(deriv, q, DT); t += DT; acc -= DT; }
    ctx.clearRect(0, 0, fit.w, fit.h);          // desenhe o estado aqui
  });
})();
```

3. Reaproveite `Sim.Plot`, `Sim.readouts` e `Sim.arrow` conforme precisar.

## Problemas comuns

- **Página em branco ou sem estilo:** confira se `core.js`, `core.css` e `projeteis.js` estão na mesma pasta do HTML.
- **Erro `Sim is not defined`:** o `core.js` precisa ser carregado antes do script da simulação.
- **Canvas com tamanho estranho:** o elemento pai do `<canvas>` não pode ter padding (use o `<div>` extra dentro do card).
- **Gráfico sem curva ideal:** passe uma função como segundo argumento de `draw()` (ou `null` se não houver referência).
