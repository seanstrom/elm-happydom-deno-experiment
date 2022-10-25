import alias from '@rollup/plugin-alias';
import elm from './utils/elm-rollup-plugin.js';


const elmClientConfig = {
    input: 'src/client.elm.js',
    output: {
        sourcemap: true,
        file: 'dist/client.elm.js',
        format: 'es',
        exports: 'auto',
    },
    plugins: [
        elm({ compiler: { optimize: true }}),
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
        elm({ compiler: { optimize: true }}),
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
        elm({ compiler: { optimize: true }}),
        alias({
            entries: [
                { find: '@src/client.elm.js', replacement: './src/client.elm.js' }
            ]
        }),
    ],
};


export default [
    elmServerConfig,
    elmClientConfig,
    clientPlatformConfig,
];
