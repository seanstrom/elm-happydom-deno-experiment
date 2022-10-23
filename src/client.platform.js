import Elm from './client.elm.js';

export function initApp({ window, preload }) {
    console.log(preload);
    const _app = Elm(window).Client.init({
        flags: preload,
        node: window.document.getElementById("root"),
    });

    // const dispatch = async message => {};
    // app.ports.outbox.subscribe(dispatch);
}

export function main(preload) {
    initApp({ window, preload });
}
