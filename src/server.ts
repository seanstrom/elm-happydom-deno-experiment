import { Window } from 'happy-dom';
import { initApp, initElements } from '@src/server.elm.js';

import { Application } from "https://deno.land/x/oak/mod.ts";
import { createCustomElement } from 'https://cdn.skypack.dev/ficusjs@5/custom-element';
import { html as h, renderer } from 'https://cdn.skypack.dev/@ficusjs/renderers@5/htm';
import { Database, SQLite3Connector, Model, DataTypes } from 'https://deno.land/x/denodb/mod.ts';



class Todo extends Model {
    static table = "todos"
    static fields = {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        name: DataTypes.STRING,
    }
}


function patchWindow(window) {
    /**
     * Patch `insertBefore` function to default reference node to null when passed undefined.
     * This is technically only needed for an Elm issue in version 1.0.2 of the VirtualDom
     * More context here: https://github.com/elm/virtual-dom/issues/161
     * And here: https://github.com/elm/virtual-dom/blob/1.0.2/src/Elm/Kernel/VirtualDom.js#L1409
    */

    const insertBefore = window.Node.prototype.insertBefore
    window.Node.prototype.insertBefore = function (...args) {
        const [newNode, refNode] = args;
        const hasRefNode = args.length > 1;
        const isRefNodeDefined = typeof refNode !== 'undefined';

        if (hasRefNode && !isRefNodeDefined)
            return insertBefore.call(this, newNode, null);

        return insertBefore.call(this, ...args);
    }

    return window;
}


function main() {
    const window = patchWindow(new Window());

    global.document = window.document;
    global.globalThis = window.globalThis;
    // global.CustomEvent = window.CustomEvent
    // global.XMLHttpRequest = window.XMLHttpRequest

    const connector = new SQLite3Connector({
        filepath: './Mochi.db',
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
            }
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
