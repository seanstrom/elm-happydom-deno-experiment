import Elm from './Main.elm'


export function initElements({ platform }) {
    platform.utils.Element.create('x-app', {
        renderer: platform.utils.Element.renderer,
        async created() {
            const app = new platform.utils.Application();

            setTimeout(() => {
                this.emit("app-init", payload => {
                    this.emit("app-db-payload", payload);
                });
            }, 0);

            app.use(async (ctx) => {
                const body = await new Promise((resolve, reject) => {
                    this.emit("app-request", payload => {
                        resolve(payload);
                    });
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
    const app = Elm(window).Main.init({
        node: window.document.getElementById('root')
    });

    const dispatch = async message => {
        switch (message.params.type) {
            case "query": {
                if (message.params.kind === 'todo') {
                    let payload = await platform.models.Todo.all();
                    let response = { context: message.context, payload };
                    if (message.context.dbHandle) {
                        message.context.dbHandle(response);
                    }
                }
                break;
            }
            case "response": {
                if (message.context.requestHandle) {
                    message.context.requestHandle(message.params.payload);
                }
                break;
            }
        }
    }

    app.ports.outbox.subscribe(dispatch);
}
