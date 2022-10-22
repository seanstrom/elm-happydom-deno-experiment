import Elm from './Server.elm';


export function initElements({ platform }) {
    platform.utils.Element.create('x-app', {
        renderer: platform.utils.Element.renderer,
        async created() {
            const app = new platform.utils.Application();

            setTimeout(() => {
                this.emit("app-init", ({ payload }) => {
                    this.emit("app-db-payload", payload);
                });
            }, 0);

            app.use(async (ctx) => {
                const response = await new Promise((resolve, reject) => {
                    this.emit("app-request", ({ payload, responseType }) => {
                        resolve({ payload, responseType });
                    });
                });

                const body = await (async () => {
                    switch (response.responseType) {
                        case "html":
                            const script = await Deno.readTextFile("./dist/client.elm.js");
                            ctx.response.headers.set("Content-Type", "text/html");
                            return `
                                <html>
                                    <head>
                                        <title>Todo App</title>
                                    </head>
                                    <body>
                                        <main id="root"></main>
                                    </body>
                                    <script type="module">
                                        ${script}

                                        main(${JSON.stringify(response.payload)});
                                    </script>
                                </html>
                            `;
                        case "json":
                            ctx.response.headers.set("Content-Type", "application/json");
                            return response.payload;
                    }
                });

                ctx.response.body = body;
            });

            await app.listen({ port: 8000 });
        },
        render() {
            return platform.utils.Element.html``;
        }
    })
}


export function initApp({ window, platform }) {
    const app = Elm(window).Server.init({
        node: window.document.getElementById('root')
    });

    const dispatch = async message => {
        switch (message.params.type) {
            case "query": {
                if (message.params.kind === 'todo') {
                    let payload = await platform.models.Todo.all();
                    let response = { context: message.context, payload };
                    if (message.context.dbHandle) {
                        message.context.dbHandle({ payload: response });
                    }
                }
                break;
            }
            case "json-response": {
                if (message.context.requestHandle) {
                    message.context.requestHandle({
                        payload: message.params.payload,
                        responseType: 'json'
                    });
                }
                break;
            }
            case "html-response": {
                if (message.context.requestHandle) {
                    message.context.requestHandle({
                        payload: message.params.payload,
                        responseType: 'html'
                    });
                }
                break;
            }
        }
    };

    app.ports.outbox.subscribe(dispatch);
}
