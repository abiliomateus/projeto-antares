/**
 * core.js — núcleo compartilhado das simulações de Física.
 *
 * O objeto global `Sim` reúne os utilitários usados pelas simulações.
 * Não usamos módulos ES para permitir abrir as páginas HTML diretamente
 * do disco. Este arquivo deve ser carregado antes do script da simulação.
 *
 * Convenções:
 * - Unidades físicas no SI (m, s, kg).
 * - Ângulos em graus apenas na interface; os cálculos usam a convenção
 *   adotada por cada simulação.
 * - Cores de desenho obtidas das variáveis CSS do tema.
 *
 * API pública:
 *   Sim.$, Sim.css, Sim.f2, Sim.fm, Sim.math, Sim.nice
 *   Sim.rk4, Sim.fit, Sim.loop, Sim.controls, Sim.setRange, Sim.setLabel
 *   Sim.readouts, Sim.arrow, Sim.Plot
 */

(function (global) {
    'use strict';

    const Sim = global.Sim = {};

    // ---------------------------------------------------------------------
    // Utilitários gerais
    // ---------------------------------------------------------------------

    /** Retorna um elemento pelo seu ID. */
    Sim.$ = (id) => document.getElementById(id);

    /**
     * Lê o valor resolvido de uma variável CSS do tema atual.
     * Exemplo: Sim.css('--acc').
     */
    Sim.css = (propertyName) =>
        getComputedStyle(document.documentElement)
            .getPropertyValue(propertyName)
            .trim();

    /** Formata um número com duas casas decimais e vírgula decimal. */
    Sim.f2 = (value) => value.toFixed(2).replace('.', ',');

    /**
     * Formata um número para uso em uma expressão LaTeX.
     * As chaves em torno da vírgula evitam o espaço tipográfico do LaTeX.
     */
    Sim.fm = (value) => Sim.f2(value).replace(',', '{,}');

    /**
     * Atualiza a renderização MathJax de um elemento cujo HTML foi alterado.
     * Se MathJax não estiver disponível, a função simplesmente não faz nada.
     */
    Sim.math = (element) => {
        const mathJax = global.MathJax;

        if (
            !mathJax ||
            !mathJax.startup ||
            !mathJax.startup.promise ||
            !mathJax.typesetPromise
        ) {
            return;
        }

        mathJax.startup.promise = mathJax.startup.promise
            .then(() => {
                if (mathJax.typesetClear) {
                    mathJax.typesetClear([element]);
                }

                return mathJax.typesetPromise([element]);
            })
            .catch(() => {
                // Evita que uma falha de renderização interrompa a simulação.
            });
    };

    /**
     * Arredonda um valor para 1, 2, 5 ou 10 vezes uma potência de dez.
     * É útil para escolher intervalos legíveis em grades e eixos.
     */
    Sim.nice = (value) => {
        const exponent = Math.floor(Math.log10(value));
        const powerOfTen = Math.pow(10, exponent);
        const normalizedValue = value / powerOfTen;

        const factor =
            normalizedValue < 1.5 ? 1 :
            normalizedValue < 3.5 ? 2 :
            normalizedValue < 7.5 ? 5 : 10;

        return factor * powerOfTen;
    };

    // ---------------------------------------------------------------------
    // Integração numérica
    // ---------------------------------------------------------------------

    /**
     * Executa um passo do método de Runge–Kutta de quarta ordem (RK4).
     *
     * @param {Function} derivative Função que recebe o estado atual e
     *                              retorna suas derivadas temporais.
     * @param {number[]} state      Estado atual, por exemplo [x, y, vx, vy].
     * @param {number} step         Intervalo de integração, em segundos.
     * @returns {number[]}          Estado após um passo de integração.
     *
     * Para outro sistema físico, basta fornecer outra função derivative.
     */
    Sim.rk4 = (derivative, state, step) => {
        const k1 = derivative(state);

        const k2 = derivative(
            state.map((value, index) => value + step / 2 * k1[index])
        );

        const k3 = derivative(
            state.map((value, index) => value + step / 2 * k2[index])
        );

        const k4 = derivative(
            state.map((value, index) => value + step * k3[index])
        );

        return state.map((value, index) =>
            value + step / 6 * (
                k1[index] +
                2 * k2[index] +
                2 * k3[index] +
                k4[index]
            )
        );
    };

    // ---------------------------------------------------------------------
    // Canvas responsivo e animação
    // ---------------------------------------------------------------------

    /**
     * Ajusta o canvas à largura do elemento pai e mantém o desenho nítido
     * em telas de alta densidade de pixels.
     *
     * O elemento pai não deve ter padding. A proporção pode ser um número
     * (altura/largura) ou uma função que calcule essa proporção.
     *
     * @param {HTMLCanvasElement} canvas
     * @param {number|Function} aspectRatio  Proporção altura/largura.
     * @param {number} minHeight             Altura mínima, em pixels CSS.
     * @param {number} maxHeight             Altura máxima, em pixels CSS.
     * @returns {{w: number, h: number}}     Dimensões em pixels CSS.
     */
    Sim.fit = (canvas, aspectRatio, minHeight, maxHeight) => {
        const size = { w: 300, h: 200 };
        const parent = canvas.parentElement;

        const resize = () => {
            const pixelRatio = global.devicePixelRatio || 1;
            const ratio = typeof aspectRatio === 'function'
                ? aspectRatio()
                : aspectRatio;

            size.w = parent.clientWidth;
            size.h = Math.round(
                Math.max(minHeight, Math.min(size.w * ratio, maxHeight))
            );

            canvas.style.height = `${size.h}px`;
            canvas.width = size.w * pixelRatio;
            canvas.height = size.h * pixelRatio;

            // Desenhos posteriores usam pixels CSS, não pixels físicos.
            canvas.getContext('2d').setTransform(
                pixelRatio, 0, 0, pixelRatio, 0, 0
            );
        };

        new ResizeObserver(resize).observe(parent);
        resize();

        return size;
    };

    /** Zoom e deslocamento (pan) do canvas principal de uma simulação, sem mudar o código de desenho.
    Chame uma vez, logo depois de Sim.fit: Sim.interactive(cv, fit).
    Como funciona: o desenho continua usando as coordenadas de sempre; a cada quadro, o ctx.clearRect do canvas (chamado no
    início do desenho) também aplica a transformação de zoom/pan com ctx.setTransform. O desenho é refeito em vetor a cada
    quadro, então fica nítido em qualquer ampliação, e a simulação continua rodando normalmente.
    Controles: botões + / − / ⟲ (na lateral direita do canvas); Ctrl + roda do mouse (ou pinça no touchpad), em torno do
    cursor; pinça no celular; arrastar para mover (com zoom > 1); duplo clique para restaurar. O zoom vai de 1× a `max`
    (opção, padrão 8×) e nunca mostra além da área original. Textos e traços ampliam junto; o que deve ficar fixo na tela
    (barras de energia) é desenhado depois de Sim.hud(ctx). Devolve {z, x, y, reset()}. */
    Sim.interactive=(cv,fit,o)=>{
    const ctx=cv.getContext('2d'),S={z:1,x:0,y:0,reset(){S.z=1;S.x=0;S.y=0;cursor()}},zmax=(o&&o.max)||8,wrap=cv.parentElement,ptr=new Map(),orig=ctx.clearRect.bind(ctx);
    let dist0=0;
    const clamp=()=>{S.x=Math.min(0,Math.max(fit.w*(1-S.z),S.x));S.y=Math.min(0,Math.max(fit.h*(1-S.z),S.y))};
    const cursor=()=>{cv.style.cursor=S.z>1?'grab':'';cv.style.touchAction=S.z>1?'none':'pan-y'};   // com zoom, o dedo move o desenho em vez de rolar a página
    const zoomAt=(f,px,py)=>{const z=Math.min(zmax,Math.max(1,S.z*f)),k=z/S.z;S.x=px-(px-S.x)*k;S.y=py-(py-S.y)*k;S.z=z;clamp();cursor()};
    const pos=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*(fit.w/(r.width||fit.w)),(e.clientY-r.top)*(fit.h/(r.height||fit.h))]};
    ctx.clearRect=()=>{const d=devicePixelRatio||1;clamp();ctx.setTransform(1,0,0,1,0,0);orig(0,0,cv.width,cv.height);ctx.setTransform(d*S.z,0,0,d*S.z,d*S.x,d*S.y)};
    cv.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();const p=pos(e);zoomAt(Math.exp(-e.deltaY*.0025),p[0],p[1])},{passive:false});
    cv.addEventListener('dblclick',()=>S.reset());
    cv.addEventListener('pointerdown',e=>{ptr.set(e.pointerId,[e.clientX,e.clientY]);try{cv.setPointerCapture(e.pointerId)}catch(_){}if(S.z>1)cv.style.cursor='grabbing';dist0=0});
    cv.addEventListener('pointermove',e=>{
    if(!ptr.has(e.pointerId))return;
    const old=ptr.get(e.pointerId);ptr.set(e.pointerId,[e.clientX,e.clientY]);
    if(ptr.size===2){                                                  // pinça: zoom em torno do ponto médio
    const v=[...ptr.values()],dist=Math.hypot(v[0][0]-v[1][0],v[0][1]-v[1][1]);
    if(dist0>0){const m=pos({clientX:(v[0][0]+v[1][0])/2,clientY:(v[0][1]+v[1][1])/2});zoomAt(dist/dist0,m[0],m[1])}
    dist0=dist;
    }else if(ptr.size===1&&S.z>1){S.x+=e.clientX-old[0];S.y+=e.clientY-old[1];clamp()}
    });
    const up=e=>{ptr.delete(e.pointerId);dist0=0;cursor()};
    cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
    if(wrap&&wrap.style){
    const bar=document.createElement('div');bar.className='zbar';
    [['+','Ampliar (Ctrl + roda do mouse)',()=>zoomAt(1.4,fit.w/2,fit.h/2)],['−','Reduzir',()=>zoomAt(1/1.4,fit.w/2,fit.h/2)],['⟲','Restaurar (duplo clique)',()=>S.reset()]].forEach(([t,tt,f])=>{
    const b=document.createElement('button');b.type='button';b.textContent=t;b.title=tt;b.setAttribute('aria-label',tt);b.onclick=f;bar.appendChild(b)});
    wrap.style.position='relative';wrap.appendChild(bar);
    }
    cursor();return S;
    };
    /** Desenho fixo na tela (sem zoom/pan): chame logo depois de ctx.save() e restaure com ctx.restore(). */
    Sim.hud=ctx=>{const d=devicePixelRatio||1;ctx.setTransform(d,0,0,d,0,0)};

    /**
     * Inicia um loop de animação e chama callback(deltaTime) a cada quadro.
     * deltaTime é expresso em segundos e limitado a 50 ms para evitar saltos
     * grandes quando a aba fica em segundo plano.
     *
     * Para manter a integração física estável, avance a simulação em passos
     * fixos dentro do callback, em vez de usar deltaTime diretamente.
     */
    Sim.loop = (callback) => {
        let previousFrameTime = performance.now();

        const animate = (currentFrameTime) => {
            const elapsedTime = Math.min(
                (currentFrameTime - previousFrameTime) / 1000,
                0.05
            );

            previousFrameTime = currentFrameTime;
            callback(elapsedTime);
            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    };

    // ---------------------------------------------------------------------
    // Controles da interface
    // ---------------------------------------------------------------------

    /** Registro interno dos sliders criados por Sim.controls. */
    Sim.ctl = {};

    /**
     * Cria sliders a partir de uma lista de definições.
     *
     * Cada definição contém id, label, unit, min, max, step e val.
     * O ID também é usado como chave no objeto de parâmetros.
     *
     * onChange recebe o ID do controle alterado.
     */
    Sim.controls = (container, definitions, parameters, onChange) => {
        definitions.forEach((definition) => {
            const {
                id,
                label,
                unit,
                min,
                max,
                step,
                val: initialValue
            } = definition;

            parameters[id] = initialValue;

            const row = document.createElement('label');
            row.className = 'row';
            row.innerHTML =
                '<span>' + label + '</span>' +
                '<output></output>' +
                '<input type="range" id="' + id + '"' +
                ' min="' + min + '"' +
                ' max="' + max + '"' +
                ' step="' + step + '"' +
                ' value="' + initialValue + '">';

            container.appendChild(row);

            const input = row.querySelector('input');
            const output = row.querySelector('output');
            const decimalPlaces = (String(step).split('.')[1] || '').length;

            const updateValue = () => {
                parameters[id] = Number(input.value);

                output.textContent =
                    Number(input.value).toFixed(decimalPlaces).replace('.', ',') +
                    ' ' + unit;
            };

            input.addEventListener('input', () => {
                updateValue();
                onChange(id);
            });

            updateValue();

            Sim.ctl[id] = {
                inp: input,
                upd: updateValue,
                span: row.querySelector('span'),
                lab: null
            };
        });
    };

    /**
     * Atualiza os limites de um slider já criado.
     * Retorna true se o valor atual tiver sido alterado pelo navegador.
     * Não chama onChange; quem usa a função deve atualizar a simulação.
     */
    Sim.setRange = (id, min, max) => {
        const control = Sim.ctl[id];
        const previousValue = control.inp.value;

        control.inp.min = min;
        control.inp.max = max;
        control.upd();

        return control.inp.value !== previousValue;
    };

    /** Atualiza o rótulo de um slider, aceitando HTML ou expressões LaTeX. */
    Sim.setLabel = (id, html) => {
        const control = Sim.ctl[id];

        if (control.lab === html) {
            return;
        }

        control.lab = html;
        control.span.innerHTML = html;
        Sim.math(control.span);
    };

    // ---------------------------------------------------------------------
    // Painel de valores numéricos
    // ---------------------------------------------------------------------

    /**
     * Cria um painel de leituras numéricas.
     *
     * @param {HTMLElement} container Elemento que receberá as leituras.
     * @param {Array<[string, string]>} items Pares [chave, rótulo].
     * @returns {Function} Função setValue(chave, valor).
     */
    Sim.readouts = (container, items) => {
        items.forEach(([key, label]) => {
            const item = document.createElement('div');

            item.innerHTML =
                '<small>' + label + '</small>' +
                '<b id="r_' + key + '">–</b>';

            container.appendChild(item);
        });

        return (key, value) => {
            const output = Sim.$('r_' + key);

            output.textContent = typeof value === 'number'
                ? Sim.f2(value)
                : value;
        };
    };

    // ---------------------------------------------------------------------
    // Desenho de vetores
    // ---------------------------------------------------------------------

    /**
     * Desenha uma seta no canvas, da posição (x, y) até (x + dx, y + dy).
     * As coordenadas são pixels do canvas; portanto, o eixo y cresce para
     * baixo. Setas com menos de 3 pixels de comprimento são omitidas.
     */
    Sim.arrow = (context, x, y, dx, dy, color, lineWidth) => {
        const length = Math.hypot(dx, dy);

        if (length < 3) {
            return;
        }

        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = lineWidth || 2;

        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + dx, y + dy);
        context.stroke();

        const angle = Math.atan2(dy, dx);
        const headLength = Math.min(10, length * 0.8);
        const tipX = x + 1.075*dx;
        const tipY = y + 1.075*dy;

        context.beginPath();
        context.moveTo(tipX, tipY);
        context.lineTo(
            tipX - headLength * Math.cos(angle - 0.4),
            tipY - headLength * Math.sin(angle - 0.4)
        );
        context.lineTo(
            tipX - headLength * Math.cos(angle + 0.4),
            tipY - headLength * Math.sin(angle + 0.4)
        );
        context.closePath();
        context.fill();
    };

    // ---------------------------------------------------------------------
    // Gráficos de séries temporais
    // ---------------------------------------------------------------------

    /**
     * Cria um gráfico para séries temporais.
     *
     * Opções:
     *   title   título desenhado no canvas (sem LaTeX);
     *   mt      margem superior em pixels (padrão: 24);
     *   series  lista de { col, name, color }, em que color é uma variável
     *           CSS, por exemplo '--acc'.
     *
     * plot.draw(rows, ideal, finalTime):
     *   rows      linhas [t, v1, v2, ...], em ordem crescente de tempo;
     *   ideal     função opcional t => [t, v1, v2, ...], desenhada tracejada;
     *   finalTime duração prevista, usada para definir o fim do eixo temporal.
     */
    Sim.Plot = function (canvas, options) {
        const size = Sim.fit(canvas, 0.72, 150, 260);
        const context = canvas.getContext('2d');

        this.draw = (rows, ideal, finalTime) => {
            const width = size.w;
            const height = size.h;

            const marginLeft = 42;
            const marginRight = 8;
            const marginTop = options.mt == null ? 24 : options.mt;
            const marginBottom = 22;
            const cssColor = Sim.css;

            context.clearRect(0, 0, width, height);

            finalTime = finalTime > 1e-3 ? finalTime : 1;

            // Amostra a solução de referência para determinar limites e desenhá-la.
            const idealRows = [];

            if (ideal) {
                for (let index = 0; index <= 60; index++) {
                    idealRows.push(ideal(finalTime * index / 60));
                }
            }

            const lastRowTime = rows.length ? rows[rows.length - 1][0] : 0;
            const maxTime = Math.max(finalTime, lastRowTime);

            let minValue = 0;
            let maxValue = 0;

            options.series.forEach((series) => {
                idealRows.concat(rows).forEach((row) => {
                    minValue = Math.min(minValue, row[series.col]);
                    maxValue = Math.max(maxValue, row[series.col]);
                });
            });

            if (maxValue - minValue < 1e-9) {
                maxValue = minValue + 1;
            }

            const padding = (maxValue - minValue) * 0.06;
            maxValue += padding;

            if (minValue < 0) {
                minValue -= padding;
            }

            const xPixel = (time) =>
                marginLeft + time / maxTime * (width - marginLeft - marginRight);

            const yPixel = (value) =>
                height - marginBottom -
                (value - minValue) / (maxValue - minValue) *
                (height - marginTop - marginBottom);

            context.font = '11px';
            context.lineWidth = 1;

            const timeStep = Sim.nice(maxTime / 4);
            const valueStep = Sim.nice((maxValue - minValue) / 4);

            // Grade vertical e marcas do eixo do tempo.
            for (let time = 0; time <= maxTime + 1e-9; time += timeStep) {
                const x = xPixel(time);

                context.strokeStyle = cssColor('--grid');
                context.beginPath();
                context.moveTo(x, marginTop);
                context.lineTo(x, height - marginBottom);
                context.stroke();

                context.fillStyle = cssColor('--mut');
                context.textAlign = 'center';
                context.fillText(
                    Number(time.toFixed(4)),
                    x,
                    height - marginBottom + 14
                );
            }

            // Grade horizontal e marcas do eixo vertical.
            for (
                let value = Math.ceil(minValue / valueStep) * valueStep;
                value <= maxValue;
                value += valueStep
            ) {
                const y = yPixel(value);

                context.strokeStyle = Math.abs(value) < 1e-9
                    ? cssColor('--ghost')
                    : cssColor('--grid');

                context.beginPath();
                context.moveTo(marginLeft, y);
                context.lineTo(width - marginRight, y);
                context.stroke();

                context.fillStyle = cssColor('--mut');
                context.textAlign = 'right';
                context.fillText(
                    Number(value.toFixed(4)),
                    marginLeft - 5,
                    y + 4
                );
            }

            // Título e legenda.
            context.fillStyle = cssColor('--ink');
            context.textAlign = 'left';
            context.font = cssColor('--plotfont');
            context.fillText(options.title, marginLeft, 14);

            let legendX = width - marginRight;
            context.font = '11px';
            context.textAlign = 'right';

            options.series.slice().reverse().forEach((series) => {
                context.fillStyle = cssColor(series.color);
                context.fillText(series.name, legendX, 14);
                legendX -= context.measureText(series.name).width + 10;
            });

            // Curvas de referência e curvas produzidas pela simulação.
            options.series.forEach((series) => {
                if (ideal) {
                    context.setLineDash([5, 4]);
                    context.strokeStyle = cssColor('--ghost');
                    context.lineWidth = 1.3;
                    context.beginPath();

                    idealRows.forEach((row, index) => {
                        if (index === 0) {
                            context.moveTo(xPixel(row[0]), yPixel(row[series.col]));
                        } else {
                            context.lineTo(xPixel(row[0]), yPixel(row[series.col]));
                        }
                    });

                    context.stroke();
                    context.setLineDash([]);
                }

                context.strokeStyle = cssColor(series.color);
                context.lineWidth = 2.2;
                context.beginPath();

                rows.forEach((row, index) => {
                    if (index === 0) {
                        context.moveTo(xPixel(row[0]), yPixel(row[series.col]));
                    } else {
                        context.lineTo(xPixel(row[0]), yPixel(row[series.col]));
                    }
                });

                context.stroke();
            });
        };
    };
})(window);
