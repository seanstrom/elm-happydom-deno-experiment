import Elm from './Client.elm';


export function initApp({ window, preload }) {
    console.log(preload)
    const app = Elm(window).Client.init({
        flags: preload,
        node: window.document.getElementById('root')
    });

    // const dispatch = async message => {};

    // app.ports.outbox.subscribe(dispatch);
}


export function main(preload) {
    initApp({ window, preload });
}
