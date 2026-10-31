window.MathJax={
    startup: {
    ready() {
      MathJax.startup.defaultReady();

      MathJax.tex2mml(String.raw`
        \let\oldvec\vec
        \renewcommand{\vec}[1]{\oldvec{\boldsymbol{\mathrm{#1}}}}
        \let\oldhat\hat
        \renewcommand{\hat}[1]{\oldhat{\boldsymbol{\mathrm{#1}}}}
      `);
    }
    },
    loader: {
    load: ['[tex]/ams', '[tex]/color', '[tex]/physics'] // Packages to pre-load
    },
    tex:{
        inlineMath:[['\\(','\\)']],
        displayMath:[['\\[','\\]']]},
        svg:{fontCache:'local'},
        options:{enableMenu:false},
        extensions: ["AMSmath.js","AMSsymbols.js"],
        equationNumbers: {
            autoNumber: "AMS", formatNumber: function (n) { return EqnumPrefix() + n }
        },
};
