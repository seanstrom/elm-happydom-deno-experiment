// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

// deno-lint-ignore-file no-explicit-any

export function notImplemented(msg: string): never {
  const message = msg ? `Not implemented: ${msg}` : "Not implemented";
  throw new Error(message);
}

globalThis.global = globalThis

export class Script {
  code: string;
  constructor(code: string, _options = {}) {
    this.code = `${code}`;
  }

  runInThisContext(_options: any) {
    return eval.call(globalThis, this.code);
  }

  runInContext(_contextifiedObject: any, _options: any) {
    var src = this.code
    // notImplemented("Script.prototype.runInContext");
    var context = _contextifiedObject;
    var code = '';
    
    // before - set local scope vars from each context property
    for (var key in context) {
      if (context.hasOwnProperty(key)) {
        code += 'var ' + key + ' = context[\'' + key + '\'];\n';
      }
    }
    
    typeof src == 'string' || (src = '(' + src.toString() + '())');
    
    code += src + ';\n';
    
    // after - scoop changes back into context
    for (var key in context) {
      if (context.hasOwnProperty(key)) {
        code += 'context[\'' + key + '\'] = ' + key + ';\n';
      }
    }
    
    return sandbox(function () {
      Function('context', code).call(null, context);
      return context;
    });
  }

  runInNewContext(_contextObject: any, _options: any) {
    notImplemented("Script.prototype.runInNewContext");
  }

  createCachedData() {
    notImplemented("Script.prototyp.createCachedData");
  }
}

export function createContext(_contextObject: any, _options: any) {
  notImplemented("createContext");
}

export function createScript(code: string, options: any) {
  return new Script(code, options);
}

export function runInContext(
  _code: string,
  _contextifiedObject: any,
  _options: any,
) {
  var script = new Script(_code, _options);
  return script.runInContext(_contextifiedObject, _options);
}

export function runInNewContext(
  _code: string,
  _contextObject: any,
  _options: any,
) {
  notImplemented("runInNewContext");
}

export function runInThisContext(
  code: string,
  options: any,
) {
  return createScript(code, options).runInThisContext(options);
}

export function isContext(_maybeContext: any) {
  return true;
}

export function compileFunction(_code: string, _params: any, _options: any) {
  notImplemented("compileFunction");
}

export function measureMemory(_options: any) {
  notImplemented("measureMemory");
}

// method sandbox - helper function for scrubbing "accidental" un-var'd globals after 
// eval() and Function() calls. 
// + Inconveniently, eval() and Function() don't take functions as arguments.  
// + eval() leaks un-var'd symbols in browser & node.js.
// + indirect eval() leaks ALL vars globally, i.e., where var e = eval; e('var a = 7'); 
//   'a' becomes global, thus, defeating the purpose.
function sandbox(fn) {

  var keys = {};
  
  for (var k in global) {
    keys[k] = k;
  }
  
  var result = fn();
  
  for (var k in global) {
    if (!(k in keys)) {
      delete global[k];
    }
  }
  
  return result;
}

export default {
  Script,
  createContext,
  createScript,
  runInContext,
  runInNewContext,
  runInThisContext,
  isContext,
  compileFunction,
  measureMemory,
};

