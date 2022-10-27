import alias from '@rollup/plugin-alias';
import elm from './utils/elm-rollup-plugin.js';


const optimize = false;


const elmClientConfig = {
    input: 'src/client.elm.js',
    output: {
        sourcemap: true,
        file: 'dist/client.elm.js',
        format: 'es',
        exports: 'auto',
    },
    plugins: [
        elm({ compiler: { optimize: false }}),
    ],
};


const elmServerConfig = {
    input: 'src/server.elm.js',
    output: {
        sourcemap: true,
        file: 'dist/server.elm.js',
        format: 'es',
        exports: 'auto',
    },
    plugins: [
        elm({ compiler: { optimize: optimize }}),
    ],
};

const elmTestServerConfig = {
    input: 'src/worker.elm.js',
    output: {
        sourcemap: true,
        file: 'dist/worker.elm.js',
        format: 'es',
        exports: 'auto',
    },
    plugins: [
        elm({ compiler: { optimize: optimize }}),
    ],
};


const clientPlatformConfig = {
    input: 'src/client.platform.js',
    output: {
        sourcemap: true,
        file: 'dist/client.platform.js',
        format: 'es',
        exports: 'auto',
    },
    plugins: [
        elm({ compiler: { optimize: optimize }}),
        alias({
            entries: [
                { find: '@src/client.elm.js', replacement: './src/client.elm.js' }
            ]
        }),
    ],
};


export default [
    elmServerConfig,
    elmTestServerConfig,
    elmClientConfig,
    clientPlatformConfig,
];
