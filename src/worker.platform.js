import { Application, send } from "oak/mod.ts";
import { Database, DataTypes, Model, SQLite3Connector } from "denodb/mod.ts";

import Elm from "@src/worker.elm.js";


class Todo extends Model {
    static table = "todos";
    static fields = {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        name: DataTypes.STRING,
    };
}


export function initServer({ app, platform }) {
    const server = new platform.utils.Application();

    setTimeout(() => {
        const handle = ({ context, payload }) =>
            app.ports.inbox.send({
                context: context,
                content: { type: "database-payload", payload }
            });

        app.ports.inbox.send({
            context: handle,
            content: {
                type: "database-init"
            }
        })
    }, 0);

    server.use(async (ctx, next) => {
        console.log(ctx.request.url);

        if (ctx.request.url.pathname.indexOf("/dist/") === 0) {
            try {
                const [_fileDir, fileName] =
                    ctx.request.url.pathname.split("/dist/");

                await send(ctx, fileName, {
                    root: `${Deno.cwd()}/dist`
                });
            } catch {
                await next();
            }
        } else {

            const response = await new Promise((resolve, _reject) => {
                const handle = ({ payload, responseType }) =>
                    resolve({ payload, responseType });

                app.ports.inbox.send({
                    context: handle,
                    content: {
                        type: 'server-request'
                    }
                });
            });

            console.log(response);

            const body = (() => {
                switch (response.responseType) {
                    case "html": {
                        ctx.response.headers.set("Content-Type", "text/html");
                        return `
                            <html>
                                <head>
                                    <title>Todo App</title>
                                </head>
                                <body>
                                    <main id="root"></main>
                                </body>
                                <script>
                                    window['PRELOAD'] = ${JSON.stringify(response.payload)};
                                </script>
                                <script type="module" src="/dist/client.platform.js"></script>
                            </html>
                        `;
                    }
                    case "json": {
                        ctx.response.headers.set("Content-Type", "application/json");
                        return response.payload;
                    }
                    default: {
                        return response.payload;
                    }
                }
            });

            ctx.response.body = body;
            next();
        }
    });

    return server;
}


export function initApp({ window, platform }) {
    const app = Elm(window).Worker.init({});

    const dispatch = async (message) => {
        switch (message.content.type) {
            case "query": {
                const payload = await (async () => {
                    switch (message.content.entity) {
                        case "todo": {
                            switch (message.content.operation) {
                                case "all":
                                    return await platform.models.Todo.all();
                                case "new": {
                                    const newTodo = new platform.models.Todo();
                                    newTodo.name = message.content.params.name;
                                    return await newTodo.save();
                                }
                                default:
                                    return null;
                            }
                        }
                        default:
                            return null;
                    }
                })();

                console.log("Message:", message);
                console.log("Response Payload: ", payload);

                if (payload) {
                    if (message.context.dbHandle) {
                        message.context.dbHandle({
                            payload,
                            context: message.context,
                        });
                    }
                }
                break;
            }
            case "json-response": {
                if (message.context.requestHandle) {
                    message.context.requestHandle({
                        payload: message.content.payload,
                        responseType: "json",
                    });
                }
                break;
            }
            case "html-response": {
                if (message.context.requestHandle) {
                    message.context.requestHandle({
                        payload: message.content.payload,
                        responseType: "html",
                    });
                }
                break;
            }
        }
    };

    app.ports.outbox.subscribe(dispatch);

    return app;
}


async function main() {
    const connector = new SQLite3Connector({
        filepath: "./Mochi.db",
    });

    const database = new Database(connector);
    database.link([Todo]);

    const platform = {
        db: database,
        models: { Todo },
        utils: {
            Application,
        },
    };

    const app = initApp({ window, platform });
    const server = initServer({ app, platform });

    await server.listen({ port: 8000 });
}


main();
