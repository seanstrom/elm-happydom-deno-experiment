import { Window } from "happy-dom";
import { Application, send } from "oak/mod.ts";
import { html as h, renderer } from "renderers/htm.js";
import { createCustomElement } from "ficus/custom-element.js";
import { Database, DataTypes, Model, SQLite3Connector } from "denodb/mod.ts";

import Elm from "@src/server.elm.js";


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


function patchWindow(window) {
    /**
     * Patch `insertBefore` function to default reference node to null when passed undefined.
     * This is technically only needed for an Elm issue in version 1.0.2 of the VirtualDom
     * More context here: https://github.com/elm/virtual-dom/issues/161
     * And here: https://github.com/elm/virtual-dom/blob/1.0.2/src/Elm/Kernel/VirtualDom.js#L1409
     */

    const insertBefore = window.Node.prototype.insertBefore;
    window.Node.prototype.insertBefore = function (...args) {
        const [newNode, refNode] = args;
        const hasRefNode = args.length > 1;
        const isRefNodeDefined = typeof refNode !== "undefined";

        if (hasRefNode && !isRefNodeDefined) {
            return insertBefore.call(this, newNode, null);
        }

        return insertBefore.call(this, ...args);
    };

    return window;
}


export function initElements(params) {
    const platform = params.platform;
    platform.utils.Element.create("x-app", {
        renderer: platform.utils.Element.renderer,
        async created() {
            const app = new platform.utils.Application();

            setTimeout(() => {
                this.emit("app-init", ({ payload }) => {
                    this.emit("app-db-payload", payload);
                });
            }, 0);

            app.use(async (ctx, next) => {
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
                        this.emit(
                            "app-request",
                            ({ payload, responseType }) => {
                                resolve({ payload, responseType });
                            },
                        );
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

            await app.listen({ port: 8000 });
        },
        render() {
            return platform.utils.Element.html``;
        },
    });
}


export function initApp({ window, platform }) {
    const app = Elm(window).Server.init({
        node: window.document.getElementById("root"),
    });

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
                            payload: {
                                payload,
                                context: message.context,
                            },
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
}


function main() {
    const window = patchWindow(new Window());

    global.document = window.document;
    global.globalThis = window.globalThis;
    // global.CustomEvent = window.CustomEvent
    // global.XMLHttpRequest = window.XMLHttpRequest

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
            Element: {
                html: h,
                renderer,
                create: createCustomElement,
            },
        },
    };

    const html = `
        <html>
            <head>
                <title>App</title>
            </head>
            <body>
                <div id='root'>
                    <!–– Content will be added here -->
                </div>
            </body>
        </html>
    `;

    window.document.write(html);
    (function () {
        initElements({ window, platform });
        initApp({ window, platform });
    }).call(window);
}


main();
