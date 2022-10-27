import Elm from '@src/worker.elm.js';

const Server = Elm({}).Test;
const app = Server.init();

app.ports.outbox.subscribe(message => {
    console.log('Received message from Elm', message);
})

app.ports.inbox.send("Message to Elm");
