window.MathJax={
    loader: {
    load: ['[tex]/ams', '[tex]/color', '[tex]/physics'] // Packages to pre-load
    },
    Tex:{
        inlineMath:[['\\(','\\)']],
        displayMath:[['\\[','\\]']]},
        svg:{fontCache:'global'},
        options:{enableMenu:false},
        extensions: ["AMSmath.js","AMSsymbols.js"],
        equationNumbers: {
            autoNumber: "AMS", formatNumber: function (n) { return EqnumPrefix() + n }
        },
};
