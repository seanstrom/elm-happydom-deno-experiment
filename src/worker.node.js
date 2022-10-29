import http from "node:http";
import { URL } from 'node:url';
import { default as serve } from "micro";
import staticFiles from "serve-handler";
import { Sequelize, DataTypes, Model } from "sequelize";

import Elm from "../dist/worker.elm.js";


class Todo extends Model { }
const makeTodo = ({ sequelize }) =>
    Todo.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: DataTypes.STRING,
    }, { sequelize, modelName: 'Todo' });


export function initServer({ app }) {
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

    const handler = async (request, response) => {
        const pathname = request.url;
        if (pathname.indexOf("/dist/") === 0) {
            // const filepath = decodeURIComponent(url.pathname);

            return staticFiles(request, response, {
                public: './',
            });
        } else {
            const data = await new Promise((resolve, _reject) => {
                const handle = ({ payload, responseType }) =>
                    resolve({ payload, responseType });

                app.ports.inbox.send({
                    context: handle,
                    content: {
                        type: 'server-request'
                    }
                });
            });

            const body = (() => {
                switch (data.responseType) {
                    case "html": {
                        return `
                            <html>
                                <head>
                                    <title>Todo App</title>
                                </head>
                                <body>
                                    <main id="root"></main>
                                </body>
                                <script>
                                    window['PRELOAD'] = ${JSON.stringify(data.payload)};
                                </script>
                                <script type="module" src="/dist/client.platform.js"></script>
                            </html>
                        `;
                    }
                    case "json": {
                        return data.payload;
                    }
                    default: {
                        return data.payload;
                    }
                }
            })();

            const headers = (() => {
                switch (data.responseType) {
                    case 'html':
                        return { 'Content-Type': 'text/html' };
                    case 'json':
                        return { 'Content-Type': 'application/json' }
                }
            })();

            for (const header in headers) {
                response.setHeader(header, headers[header]);
            }

            response.end(body);
        }
    };

    return serve(handler);
}


export function initApp({ platform }) {
    const app = Elm({}).Worker.init({});

    const dispatch = async (message) => {
        switch (message.content.type) {
            case "query": {
                const payload = await (async () => {
                    switch (message.content.entity) {
                        case "todo": {
                            switch (message.content.operation) {
                                case "all": {
                                    const payload = await platform.models.Todo.findAll();
                                    return payload.map(model => ({ id: model.id, name: model.name }));
                                }
                                case "new": {
                                    return await platform.models.Todo.create({
                                        name: message.content.params.name
                                    });
                                }
                                default:
                                    return null;
                            }
                        }
                        default:
                            return null;
                    }
                })();

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
    const connector = new Sequelize({
        dialect: 'sqlite',
        storage: './Mochi.db',
        logging: false,
    });

    makeTodo({ sequelize: connector });

    // await connector.sync({ force: true });

    const platform = {
        models: { Todo },
        utils: {},
    };

    const app = initApp({ platform });
    const server = initServer({ app, platform });

    await server.listen(8000);
}


main();
