import elm from './utils/elm-rollup-plugin'

export default {
    input: 'src/main.elm.js',
    output: {
        file: 'dist/main.elm.js',
        format: 'es',
        exports: 'auto',
    },
    plugins: [
        elm({}),
    ]
};
