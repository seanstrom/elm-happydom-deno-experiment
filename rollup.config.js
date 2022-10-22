import elm from './utils/elm-rollup-plugin'

const clientConfig = {
    input: 'src/client.elm.js',
    output: {
        file: 'dist/client.elm.js',
        format: 'es',
        exports: 'auto',
    },
    plugins: [
        elm({}),
    ]
};

const serverConfig = {
    input: 'src/server.elm.js',
    output: {
        file: 'dist/server.elm.js',
        format: 'es',
        exports: 'auto',
    },
    plugins: [
        elm({}),
    ]
};

export default [
    serverConfig,
    clientConfig
];
