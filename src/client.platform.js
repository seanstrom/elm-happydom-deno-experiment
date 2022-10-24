import Elm from '@src/client.elm.js';


export function initApp({ window, preload }) {
    Elm(window).Client.init({
        flags: preload,
        node: window.document.getElementById("root"),
    });
}


export function main() {
    initApp({ window, preload: window['PRELOAD'] });
}


main();
