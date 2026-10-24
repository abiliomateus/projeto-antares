# Simulações de física: guia de modificação

Pacote em HTML, CSS e JavaScript puro. Não precisa de instalação nem de internet: abra `projeteis.html` com duplo clique. Os quatro arquivos devem ficar na mesma pasta.

## Arquivos

| Arquivo | Papel | Edite quando quiser... |
|---|---|---|
| `core.js` | Núcleo reutilizável (`Sim`): integrador, loop, sliders, leituras, setas, gráficos | mudar comportamento comum a todas as simulações |
| `index.html` + `catalogo.js` | Menu com um cartão por simulação | adicionar simulações e tópicos, mudar opções (em `catalogo.js`) |
| `core.css` | Cores e layout compartilhados | trocar paleta, espaçamentos, pontos de quebra |
| `projeteis.js` | Física e desenho do lançamento | mudar equações, parâmetros, o que é desenhado |
| `projeteis.html` | Esqueleto da página e textos | mudar títulos, ordem dos blocos, opções de planeta |
| `inclinado.js` / `inclinado.html` | Plano inclinado com e sem atrito | mudar o modelo de forças e atrito, em `phys()` |
| `blocos.js` / `blocos.html` | Blocos conectados por polia, em dois planos | mudar o modelo de forças, atrito e tensão, em `phys()` |
| `massamola.js` / `massamola.html` | Massa-mola com e sem atrito de Coulomb | mudar o tipo de atrito e as forças em `fricF()` e `step()` |
| `pendulo.js` / `pendulo.html` | Pêndulo de Galileu (fio com pino): energia, tensão, fio frouxo | mudar o pino e o modelo do fio em `setup()` e `trackStep()` |
| `loop.js` / `loop.html` | Partícula num loop: conservação de energia, normal, atrito | mudar a pista em `geom()` e o atrito em `fricF()` |
| `colisao.js` / `colisao.html` | Colisão de partículas pontuais em 2D, com ângulo de desvio | mudar o modelo de choque e a escolha da solução em `setup()` |

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
| `Sim.fm(v)`, `Sim.math(elemento)` | Número para usar dentro de fórmulas LaTeX; re-renderiza as fórmulas (MathJax) de um elemento cujo texto mudou. |
| `Sim.setRange(id, min, max)`, `Sim.setLabel(id, html)` | Mudam os limites e o rótulo de um slider já criado. |
| `Sim.css('--var')` | Lê uma cor do tema atual. Use no canvas em vez de cores fixas. |
| `Sim.f2(v)`, `Sim.nice(x)`, `Sim.$(id)` | Formatação, espaçamento de eixos, atalho do DOM. |

## Menu (`index.html` + `catalogo.js`)

O menu é desenhado a partir de `catalogo.js`; não é preciso editar o `index.html`.

- **Adicionar uma simulação:** copie um objeto de `simulacoes` e mude `id`, `titulo`, `descricao`, `topico`, `tags` e `arquivo`. Título e descrição aceitam HTML e LaTeX (`'\\(\\theta_1\\)'`). O campo `icone` recebe um SVG em texto (`viewBox="0 0 48 48"`, cor `currentColor`); sem ele, entra um ícone genérico.
- **Simulação planejada:** use `disponivel:false` (sem `arquivo`) para aparecer como cartão "em breve", sem link.
- **Novo tópico:** acrescente `{id, nome}` em `topicos`. A ordem da lista é a ordem dos grupos. Simulações com tópico desconhecido vão para "Outros".
- **Opções** (em `opcoes`): `titulo`, `subtitulo`, `agruparPorTopico`, `mostrarBusca`, `mostrarFiltros`, `mostrarEmBreve`, `mostrarTema`, `abrirEmNovaAba`. A busca ignora acentos e procura em título, descrição e tags.
- **Filtro por link:** `index.html#newton` abre já filtrado pelo tópico `newton`.
- **Visual:** as regras do menu estão no fim de `core.css` (`.menu`, `.sim`, `.chip`, `.tag`) e usam as mesmas variáveis de cor das simulações.
- **Tema:** o botão "Tema" alterna automático, claro e escuro e guarda a escolha em `localStorage`; o `core.js` aplica o tema salvo em todas as páginas. Em alguns navegadores, páginas abertas direto do disco não compartilham o `localStorage`.
- **Volta ao menu:** cada simulação tem o link "← Todas as simulações" no cabeçalho. Para remover, apague o `<p class="back">` do HTML.

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

## Conservação de energia no loop (`loop.html`)

- **Pista:** rampa reta de inclinação `α`, arco de concordância de raio `R`, loop circular (anti-horário) e trecho plano de saída. Ela é descrita pelo comprimento de arco `s` em `geom(s)`, que devolve posição, ângulo da tangente `θ` e curvatura `κ`. Para outra pista (um vale, uma lombada, outro formato), troque só `geom()` e o `setup()`.
- **Modelo:** estado `q = [s, v]` e `dv/dt = −g·sen θ + f/m`. A normal é `N = m·(κ·v² + g·cos θ)`. Atrito cinético `μ·N`, com atrito estático quando a partícula está parada (`fricF()`). A energia dissipada é `Q = ∫ μ·N·|v| dt`, e `E + Q = E0` em todo instante.
- **Perda de contato:** se `N < 0` (só no loop), a pista não consegue empurrar a partícula, que segue em voo livre até tocar a pista de novo. Sem atrito, o loop é completado se `h ≥ 2,5·R`. Abaixo disso, a partícula se solta no ângulo `cos φ = −2(h − R)/(3R)`; se `h ≤ R`, volta pela mesma pista.
- **Início na rampa ou no arco:** se `h` for menor que a altura do início do arco (`R·(1 − cos α)`), a partícula já parte do arco.
- **Fim da simulação:** ao sair pelo trecho plano, ao tocar a pista depois do voo, quando o atrito a segura ou após 20 s (`TMAX`). No início da rampa há um "batente" elástico.
- **Gráficos:** energias (`Ec, Ep, E, Q`), velocidade e `N/(m·g)`. Colunas: `[t, Ec, Ep, E, Q, v, N/(m·g)]`.
- **Teste:** rodei a lógica no Node: sem atrito, `E` se conserva com erro relativo de cerca de `10⁻⁶`; o ângulo de perda de contato simulado (132,0°) bate com o teórico (131,8°).

## Pêndulo de Galileu (`pendulo.html`)

- **Montagem:** o pino fica na vertical do ponto de suspensão, a uma distância `d = f·L` abaixo dele (`f` é o slider "Posição do pino"). O fio gira em torno do suporte (raio `L`) à esquerda da vertical e em torno do pino (raio `r = L − d`) à direita. `setup()` guarda o centro e o raio de cada lado em `S.L` e `S.R`. A caixa "Com pino" desliga o pino (`d = 0`).
- **Modelo:** `θ'' = −(g/ℓ)·sen θ − γ·θ'`. Ao cruzar a vertical, a velocidade linear é contínua e a velocidade angular muda de escala (`trackStep()`). A tensão é `T = F_g·cos θ + m·ℓ·ω²`, com `F_g = m·g`. A resistência do ar é linear e opcional; a energia dissipada vem de `Q = ∫ m·γ·v² dt`.
- **Resultado de Galileu:** com `h0 ≤ r`, a partícula volta exatamente à altura `h0` do outro lado, com o pino em qualquer posição. O gráfico de altura tem uma linha tracejada em `h0` para mostrar isso.
- **Fio frouxo:** se `T < 0` (só acima da altura do pino), a partícula segue em voo livre (`flightStep()`). Quando a distância ao centro volta a ser `ℓ`, o fio estica num puxão inelástico: a componente radial da velocidade se perde e a energia `½·m·v_r²` vai para `Q`. A energia dissipada nos puxões aparece no texto sob o canvas.
- **Enrolar no pino:** se a partícula dá a volta no pino (`|θ| ≥ π`), o fio se enrola e a simulação termina (`fim = 'enrola'`).
- **Limite de tempo:** `TMAX = 30` s.
- **Gráficos:** energia (`Ec, Ep, E, Q`), altura `h` com a linha de `h0`, e tensão `T/F_g`. Colunas: `[t, Ec, Ep, E, Q, h, T/F_g]`.
- **Testes (Node):** sem atrito, a energia se conserva com erro relativo de cerca de `10⁻¹¹`, e os picos de altura dos dois lados valem `h0`. O período para pequenos ângulos (2,100 s) bate com a fórmula `π·√(L/g) + π·√(r/g)` (2,098 s). Com puxões, `E + Q = E0` com erro de cerca de `10⁻³`.
- **Notação:** nesta simulação a força gravitacional é `F_g` (não "peso"), com componentes `F_g∥` e `F_g⊥`.

## Massa-mola com e sem atrito (`massamola.html`)

- **Modelo:** bloco de massa `m` numa superfície horizontal, preso a uma mola de constante `k`; `x` é o deslocamento em relação ao equilíbrio e o estado é `q = [x, v]`. Forças: elástica `F_el = −k·x`, gravitacional `F_g = m·g` e normal `N = F_g`. Sem atrito, `x(t) = x0·cos(ω·t)` (curva tracejada no primeiro gráfico) e `E = ½·k·x0²`.
- **Atrito de Coulomb** (caixa "Com atrito"): em movimento, `f = −sinal(v)·μc·N`. Em repouso, o bloco só se move se `|k·x| > μe·N` (atrito estático, com `f = −F_el`). `μc` é limitado a `μe`. Tudo está em `fricF()` e no passo `step()`.
- **O que esperar:** a amplitude diminui `2·μc·N/k` a cada meia oscilação (o meio período continua `T/2`), e o bloco para no primeiro ponto de retorno com `|x| ≤ μe·N/k`. O texto sob o canvas prevê o número de meias oscilações e o tempo até a parada.
- **Pontos de retorno:** com atrito, quando `v` cruza zero o passo é interrompido no ponto exato (interpolado), o bloco é parado ali e o resto do passo volta ao acumulador de tempo. Sem isso, a energia dissipada teria erro de cerca de `10⁻³`.
- **Fim da simulação:** quando o atrito estático segura o bloco (`fim = 'parou'`) ou após 10 períodos, no máximo 60 s (`tEnd`, em `setup()`).
- **Visual:** a mola tem comprimento natural desenhado `L0 = x0 + 0,8` m (só visual) e o bloco tem tamanho fixo em pixels. O atrito é desenhado no ponto de contato com o chão, para não se sobrepor à força elástica.
- **Gráficos:** posição (com a curva sem atrito tracejada), energias (`Ec, Ep, E, Q`) e forças (`F_el`, `f`). Colunas: `[t, x, v, Ec, Ep, E, Q, F_el, f]`.
- **Testes (Node):** sem atrito, `x(t)` coincide com `x0·cos(ω·t)` com erro de cerca de `10⁻¹⁰` m. Com atrito, as amplitudes nos retornos caem exatamente `2·μc·N/k` (0,196 m) por meia oscilação, a parada ocorre após 5 meias oscilações (t = 4,970 s contra 4,967 s previstos), e `E + Q = E0` com erro de cerca de `10⁻⁷`.
- **Para amortecimento viscoso:** acrescente `−b·v` na derivada de `v` em `step()` e `b·v²` na de `Q`. A amplitude passa a decair de forma exponencial, em vez de linear.

## Fórmulas com MathJax

`colisao.html`, `blocos.html`, `loop.html`, `pendulo.html` e `massamola.html` usam MathJax; `projeteis.html` e `inclinado.html` ainda usam símbolos Unicode.

- **Como ativar numa página:** copie do `colisao.html` as duas tags `<script>` do MathJax (configuração e `tex-svg.js`). Depois escreva `\( ... \)` no texto e `\[ ... \]` para equações em destaque.
- **Textos criados pelo JS** (rótulos de sliders e leituras) já são renderizados no carregamento. Se você trocar o texto de um elemento depois, chame `Sim.math(elemento)`. No JS, as barras se duplicam: `'\\(\\theta_1\\)'`. Use `Sim.fm(valor)` para números dentro de fórmulas (vírgula decimal).
- **Gráficos:** título e legenda ficam em HTML (`<div class="pt">`) acima do canvas, para aceitar LaTeX. No `Sim.Plot`, deixe `title` e `name` vazios e use `mt:8`.
- **O que não dá:** textos desenhados dentro do canvas (nomes dos eixos, rótulos das setas) continuam em Unicode.
- **Sem internet:** o MathJax vem da CDN, então sem conexão as fórmulas aparecem como código LaTeX. Para uso offline, baixe o `tex-svg.js` e aponte o `src` para o arquivo local.

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

## Plano inclinado (`inclinado.html`)

- **Forças:** `phys()` calcula P, N, P∥, P⊥, atrito f, resultante e aceleração. Para incluir uma força nova (por exemplo, uma força aplicada), acrescente-a ali e desenhe a seta em `draw()` com a função local `F(rótulo, valor, x, y, dx, dy, cor)`.
- **Atrito:** a caixa "Com atrito" liga e desliga f. O bloco só desliza se `tg θ > μₑ`. O valor de μc é limitado a μₑ.
- **Escala das setas:** o peso mede sempre 72 px (variável `k` em `draw()`), e as outras forças ficam proporcionais a ele. Os valores em newtons aparecem nos rótulos.
- **Gráficos:** s(t), v(t) e energia (Ec, Ep, E total). A curva tracejada é o caso sem atrito. Colunas dos dados: `[t, s, v, Ec, Ep, E total]`.
- **Fim da simulação:** o bloco para ao chegar à base (`Smax`). Se não se move, a simulação encerra após 6 s.

## Blocos conectados (`blocos.html`)

- **Modelo:** corda inextensível, polia ideal. Uma coordenada `x` descreve os dois blocos (positiva quando m₁ desce e m₂ sobe). `phys()` calcula pesos, normais, atritos, aceleração e tensão.
- **Planos de mesma altura:** o parâmetro `H` é a altura dos dois planos, então os comprimentos são `L1 = H/sen α` e `L2 = H/sen β` (função `geo()`). Como `L` cresce sem limite quando o ângulo tende a 0, os ângulos vão de 15° a 75°. Para voltar a planos de mesmo comprimento, troque `geo()` e o cálculo de `sc`, `Ay` e `BL/BR` em `draw()`.
- **Limites do movimento:** os blocos partem do ponto médio de cada plano. Como os planos têm comprimentos diferentes, os limites são diferentes nos dois sentidos: `Xp` (m₁ desce) e `Xm` (m₂ desce), calculados em `upd()`.
- **Atrito estático:** o sistema só se move se `|P₁∥ − P₂∥| > μₑ·(N₁+N₂)`. Em repouso, o atrito estático é indeterminado (duas incógnitas, uma equação); o código o divide entre os blocos na proporção do máximo de cada um. Para outra regra, edite o trecho `if(stuck)` de `phys()`.
- **Polia mais realista:** para incluir a massa da polia, acrescente o momento de inércia ao denominador de `a` em `phys()` (`m₁ + m₂ + I/r²`) e trate as duas tensões separadamente.
- **MathJax:** rótulos, frase de situação, títulos e legendas dos gráficos e equações usam LaTeX (ver a seção "Fórmulas com MathJax"). Os rótulos das setas e dos ângulos, desenhados no canvas, continuam em Unicode.
- **Gráficos:** x(t), v(t) e energia (Ec, ΔEp, ΔE). Colunas dos dados: `[t, x, v, Ec, ΔEp, ΔE]`. A curva tracejada é o caso sem atrito.
- **Geometria da polia:** o centro da polia é deslocado do vértice em `draw()` para que a corda fique paralela aos planos. Se mudar o tamanho dos blocos (`bm` em `geo()`), a corda se ajusta sozinha.

## Colisão de partículas pontuais em 2D (`colisao.html`)

- **Cena:** os eixos x–y têm origem no ponto da colisão. As duas partículas chegam à origem juntas em `t = TC` (constante no topo do arquivo). Uma partícula parada fica na origem desde o início. Sem forças externas não há integrador: o choque é um evento em `step()`, que chama `collide()`.
- **Como o resultado é determinado:** sem raio não há linha dos centros, então o resultado vem de (1) conservação do momento, (2) restituição `e = |v_rel depois| / |v_rel antes|` e (3) o ângulo de desvio θ₁ da partícula 1 no referencial do laboratório. No referencial do CM, a velocidade final de 1 está numa circunferência de centro `c` (velocidade do CM) e raio `ρ = (m₂/M)·e·|v_rel|`. A direção de θ₁ fixa o ponto, e `u₂ = c − (m₁/m₂)(u₁ − c)`. Tudo está em `setup()`.
- **Ângulos impossíveis:** se `|c| > ρ` (partícula mais pesada incidindo na mais leve, ou `e` pequeno), θ₁ tem um intervalo possível (cone de meio-ângulo `asin(ρ/|c|)`). O slider de θ₁ é limitado a esse intervalo (`thetaRange()` e `Sim.setRange()`), que aparece no rótulo, então a animação sempre reproduz o θ₁ mostrado. Dentro do intervalo pode haver duas soluções; a caixa "Outra solução" escolhe a menor.
- **Mudar o ângulo de referência:** θ₁ é medido a partir da direção de v₁ (`ang1`). Para medir a partir do eixo x, troque `phi=a1+P.dfl*R` por `phi=P.dfl*R` em `setup()`.
- **Partículas pontuais:** são desenhadas como pontos de tamanho fixo. A massa só aparece nas leituras e nos gráficos.
- **Gráficos:** velocidades, momento total (pₓ, p_y, |p|) e energia cinética. Colunas: `[t, |v1|, |v2|, px, py, |p|, Ec1, Ec2, Ec]`.
