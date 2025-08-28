exports.id = 171;
exports.ids = [171];
exports.modules = {

  /***/ 546:
  /***/ (module, __unused_webpack_exports, __webpack_require__) => {
    'use strict';

    let cp = __webpack_require__(5317);
    let parse = __webpack_require__(7877);
    let enoent = __webpack_require__(6469);

    function spawn(command, args, options) {
    // Parse the arguments
      let parsed = parse(command, args, options);

      // Spawn the child process
      let spawned = cp.spawn(parsed.command, parsed.args, parsed.options);

      // Hook into child process "exit" event to emit an error if the command
      // does not exists, see: https://github.com/IndigoUnited/node-cross-spawn/issues/16
      enoent.hookChildProcess(spawned, parsed);

      return spawned;
    }

    function spawnSync(command, args, options) {
    // Parse the arguments
      let parsed = parse(command, args, options);

      // Spawn the child process
      let result = cp.spawnSync(parsed.command, parsed.args, parsed.options);

      // Analyze if the command does not exist, see: https://github.com/IndigoUnited/node-cross-spawn/issues/16
      result.error = result.error || enoent.verifyENOENTSync(result.status, parsed);

      return result;
    }

    module.exports = spawn;
    module.exports.spawn = spawn;
    module.exports.sync = spawnSync;

    module.exports._parse = parse;
    module.exports._enoent = enoent;
    /***/ },

  /***/ 6469:
  /***/ (module) => {
    'use strict';

    let isWin = process.platform === 'win32';

    function notFoundError(original, syscall) {
      return Object.assign(new Error(`${syscall} ${original.command} ENOENT`), {
        code: 'ENOENT',
        errno: 'ENOENT',
        syscall: `${syscall} ${original.command}`,
        path: original.command,
        spawnargs: original.args,
      });
    }

    function hookChildProcess(cp, parsed) {
      if (!isWin) {
        return;
      }

      let originalEmit = cp.emit;

      cp.emit = function(name, arg1) {
        // If emitting "exit" event and exit code is 1, we need to check if
        // the command exists and emit an "error" instead
        // See https://github.com/IndigoUnited/node-cross-spawn/issues/16
        if (name === 'exit') {
          let err = verifyENOENT(arg1, parsed);

          if (err) {
            return originalEmit.call(cp, 'error', err);
          }
        }

        return originalEmit.apply(cp, arguments);
      };
    }

    function verifyENOENT(status, parsed) {
      if (isWin && status === 1 && !parsed.file) {
        return notFoundError(parsed.original, 'spawn');
      }

      return null;
    }

    function verifyENOENTSync(status, parsed) {
      if (isWin && status === 1 && !parsed.file) {
        return notFoundError(parsed.original, 'spawnSync');
      }

      return null;
    }

    module.exports = {
      hookChildProcess,
      verifyENOENT,
      verifyENOENTSync,
      notFoundError,
    };
    /***/ },

  /***/ 7877:
  /***/ (module, __unused_webpack_exports, __webpack_require__) => {
    'use strict';

    let path = __webpack_require__(6928);
    let resolveCommand = __webpack_require__(4866);
    let escape = __webpack_require__(2164);
    let readShebang = __webpack_require__(599);

    let isWin = process.platform === 'win32';
    let isExecutableRegExp = /\.(?:com|exe)$/i;
    let isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;

    function detectShebang(parsed) {
      parsed.file = resolveCommand(parsed);

      let shebang = parsed.file && readShebang(parsed.file);

      if (shebang) {
        parsed.args.unshift(parsed.file);
        parsed.command = shebang;

        return resolveCommand(parsed);
      }

      return parsed.file;
    }

    function parseNonShell(parsed) {
      if (!isWin) {
        return parsed;
      }

      // Detect & add support for shebangs
      let commandFile = detectShebang(parsed);

      // We don't need a shell if the command filename is an executable
      let needsShell = !isExecutableRegExp.test(commandFile);

      // If a shell is required, use cmd.exe and take care of escaping everything correctly
      // Note that `forceShell` is an hidden option used only in tests
      if (parsed.options.forceShell || needsShell) {
        // Need to double escape meta chars if the command is a cmd-shim located in `node_modules/.bin/`
        // The cmd-shim simply calls execute the package bin file with NodeJS, proxying any argument
        // Because the escape of metachars with ^ gets interpreted when the cmd.exe is first called,
        // we need to double escape them
        let needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile);

        // Normalize posix paths into OS compatible paths (e.g.: foo/bar -> foo\bar)
        // This is necessary otherwise it will always fail with ENOENT in those cases
        parsed.command = path.normalize(parsed.command);

        // Escape command & arguments
        parsed.command = escape.command(parsed.command);
        parsed.args = parsed.args.map((arg) => escape.argument(arg, needsDoubleEscapeMetaChars));

        let shellCommand = [parsed.command].concat(parsed.args).join(' ');

        parsed.args = ['/d', '/s', '/c', `"${shellCommand}"`];
        parsed.command = process.env.comspec || 'cmd.exe';
        parsed.options.windowsVerbatimArguments = true; // Tell node's spawn that the arguments are already escaped
      }

      return parsed;
    }

    function parse(command, args, options) {
    // Normalize arguments, similar to nodejs
      if (args && !Array.isArray(args)) {
        options = args;
        args = null;
      }

      args = args ? args.slice(0) : []; // Clone array to avoid changing the original
      options = Object.assign({}, options); // Clone object to avoid changing the original

      // Build our parsed object
      let parsed = {
        command,
        args,
        options,
        file: undefined,
        original: {
          command,
          args,
        },
      };

      // Delegate further parsing to shell or non-shell
      return options.shell ? parsed : parseNonShell(parsed);
    }

    module.exports = parse;
    /***/ },

  /***/ 2164:
  /***/ (module) => {
    'use strict';

    // See http://www.robvanderwoude.com/escapechars.php
    let metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;

    function escapeCommand(arg) {
    // Escape meta chars
      arg = arg.replace(metaCharsRegExp, '^$1');

      return arg;
    }

    function escapeArgument(arg, doubleEscapeMetaChars) {
    // Convert to string
      arg = `${arg}`;

      // Algorithm below is based on https://qntm.org/cmd
      // It's slightly altered to disable JS backtracking to avoid hanging on specially crafted input
      // Please see https://github.com/moxystudio/node-cross-spawn/pull/160 for more information

      // Sequence of backslashes followed by a double quote:
      // double up all the backslashes and escape the double quote
      arg = arg.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');

      // Sequence of backslashes followed by the end of the string
      // (which will become a double quote later):
      // double up all the backslashes
      arg = arg.replace(/(?=(\\+?)?)\1$/, '$1$1');

      // All other backslashes occur literally

      // Quote the whole thing:
      arg = `"${arg}"`;

      // Escape meta chars
      arg = arg.replace(metaCharsRegExp, '^$1');

      // Double escape meta chars if necessary
      if (doubleEscapeMetaChars) {
        arg = arg.replace(metaCharsRegExp, '^$1');
      }

      return arg;
    }

    module.exports.command = escapeCommand;
    module.exports.argument = escapeArgument;
    /***/ },

  /***/ 599:
  /***/ (module, __unused_webpack_exports, __webpack_require__) => {
    'use strict';

    let fs = __webpack_require__(9896);
    let shebangCommand = __webpack_require__(9152);

    function readShebang(command) {
    // Read the first 150 bytes from the file
      let size = 150;
      let buffer = Buffer.alloc(size);

      let fd;

      try {
        fd = fs.openSync(command, 'r');
        fs.readSync(fd, buffer, 0, size, 0);
        fs.closeSync(fd);
      } catch (e) { /* Empty */ }

      // Attempt to extract shebang (null is returned if not a shebang)
      return shebangCommand(buffer.toString());
    }

    module.exports = readShebang;
    /***/ },

  /***/ 4866:
  /***/ (module, __unused_webpack_exports, __webpack_require__) => {
    'use strict';

    let path = __webpack_require__(6928);
    let which = __webpack_require__(6848);
    let getPathKey = __webpack_require__(6689);

    function resolveCommandAttempt(parsed, withoutPathExt) {
      let env = parsed.options.env || process.env;
      let cwd = process.cwd();
      let hasCustomCwd = parsed.options.cwd != null;
      // Worker threads do not have process.chdir()
      let shouldSwitchCwd = hasCustomCwd && process.chdir !== undefined && !process.chdir.disabled;

      // If a custom `cwd` was specified, we need to change the process cwd
      // because `which` will do stat calls but does not support a custom cwd
      if (shouldSwitchCwd) {
        try {
          process.chdir(parsed.options.cwd);
        } catch (err) {
          /* Empty */
        }
      }

      let resolved;

      try {
        resolved = which.sync(parsed.command, {
          path: env[getPathKey({ env })],
          pathExt: withoutPathExt ? path.delimiter : undefined,
        });
      } catch (e) {
        /* Empty */
      } finally {
        if (shouldSwitchCwd) {
          process.chdir(cwd);
        }
      }

      // If we successfully resolved, ensure that an absolute path is returned
      // Note that when a custom `cwd` was used, we need to resolve to an absolute path based on it
      if (resolved) {
        resolved = path.resolve(hasCustomCwd ? parsed.options.cwd : '', resolved);
      }

      return resolved;
    }

    function resolveCommand(parsed) {
      return resolveCommandAttempt(parsed) || resolveCommandAttempt(parsed, true);
    }

    module.exports = resolveCommand;
    /***/ },

  /***/ 2940:
  /***/ (module, __unused_webpack_exports, __webpack_require__) => {
    let fs = __webpack_require__(9896);
    let core;
    if (process.platform === 'win32' || global.TESTING_WINDOWS) {
      core = __webpack_require__(9225);
    } else {
      core = __webpack_require__(1025);
    }

    module.exports = isexe;
    isexe.sync = sync;

    function isexe(path, options, cb) {
      if (typeof options === 'function') {
        cb = options;
        options = {};
      }

      if (!cb) {
        if (typeof Promise !== 'function') {
          throw new TypeError('callback not provided');
        }

        return new Promise(function(resolve, reject) {
          isexe(path, options || {}, function(er, is) {
            if (er) {
              reject(er);
            } else {
              resolve(is);
            }
          });
        });
      }

      core(path, options || {}, function(er, is) {
        // ignore EACCES because that just means we aren't allowed to run it
        if (er) {
          if (er.code === 'EACCES' || options && options.ignoreErrors) {
            er = null;
            is = false;
          }
        }
        cb(er, is);
      });
    }

    function sync(path, options) {
      // my kingdom for a filtered catch
      try {
        return core.sync(path, options || {});
      } catch (er) {
        if (options && options.ignoreErrors || er.code === 'EACCES') {
          return false;
        } else {
          throw er;
        }
      }
    }
    /***/ },

  /***/ 1025:
  /***/ (module, __unused_webpack_exports, __webpack_require__) => {
    module.exports = isexe;
    isexe.sync = sync;

    let fs = __webpack_require__(9896);

    function isexe(path, options, cb) {
      fs.stat(path, function(er, stat) {
        cb(er, er ? false : checkStat(stat, options));
      });
    }

    function sync(path, options) {
      return checkStat(fs.statSync(path), options);
    }

    function checkStat(stat, options) {
      return stat.isFile() && checkMode(stat, options);
    }

    function checkMode(stat, options) {
      let mod = stat.mode;
      let uid = stat.uid;
      let gid = stat.gid;

      let myUid = options.uid !== undefined ?
        options.uid : process.getuid && process.getuid();
      let myGid = options.gid !== undefined ?
        options.gid : process.getgid && process.getgid();

      let u = parseInt('100', 8);
      let g = parseInt('010', 8);
      let o = parseInt('001', 8);
      let ug = u | g;

      let ret = mod & o ||
    mod & g && gid === myGid ||
    mod & u && uid === myUid ||
    mod & ug && myUid === 0;

      return ret;
    }
    /***/ },

  /***/ 9225:
  /***/ (module, __unused_webpack_exports, __webpack_require__) => {
    module.exports = isexe;
    isexe.sync = sync;

    let fs = __webpack_require__(9896);

    function checkPathExt(path, options) {
      let pathext = options.pathExt !== undefined ?
        options.pathExt : process.env.PATHEXT;

      if (!pathext) {
        return true;
      }

      pathext = pathext.split(';');
      if (pathext.indexOf('') !== -1) {
        return true;
      }
      for (let i = 0; i < pathext.length; i++) {
        let p = pathext[i].toLowerCase();
        if (p && path.substr(-p.length).toLowerCase() === p) {
          return true;
        }
      }
      return false;
    }

    function checkStat(stat, path, options) {
      if (!stat.isSymbolicLink() && !stat.isFile()) {
        return false;
      }
      return checkPathExt(path, options);
    }

    function isexe(path, options, cb) {
      fs.stat(path, function(er, stat) {
        cb(er, er ? false : checkStat(stat, path, options));
      });
    }

    function sync(path, options) {
      return checkStat(fs.statSync(path), path, options);
    }
    /***/ },

  /***/ 8595:
  /***/ (module, __unused_webpack_exports, __webpack_require__) => {
    'use strict';

    let { PassThrough } = __webpack_require__(2203);

    module.exports = function(/* streams...*/) {
      let sources = [];
      let output  = new PassThrough({ objectMode: true });

      output.setMaxListeners(0);

      output.add = add;
      output.isEmpty = isEmpty;

      output.on('unpipe', remove);

      Array.prototype.slice.call(arguments).forEach(add);

      return output;

      function add(source) {
        if (Array.isArray(source)) {
          source.forEach(add);
          return this;
        }

        sources.push(source);
        source.once('end', remove.bind(null, source));
        source.once('error', output.emit.bind(output, 'error'));
        source.pipe(output, { end: false });
        return this;
      }

      function isEmpty() {
        return sources.length == 0;
      }

      function remove(source) {
        sources = sources.filter(function(it) {
          return it !== source;
        });
        if (!sources.length && output.readable) {
          output.end();
        }
      }
    };
    /***/ },

  /***/ 6689:
  /***/ (module) => {
    'use strict';

    let pathKey = (options = {}) => {
      let environment = options.env || process.env;
      let platform = options.platform || process.platform;

      if (platform !== 'win32') {
        return 'PATH';
      }

      return Object.keys(environment).reverse().find(key => key.toUpperCase() === 'PATH') || 'Path';
    };

    module.exports = pathKey;
    // TODO: Remove this for the next major release
    module.exports['default'] = pathKey;
    /***/ },

  /***/ 9152:
  /***/ (module, __unused_webpack_exports, __webpack_require__) => {
    'use strict';

    let shebangRegex = __webpack_require__(7334);

    module.exports = (string = '') => {
      let match = string.match(shebangRegex);

      if (!match) {
        return null;
      }

      let [path, argument] = match[0].replace(/#! ?/, '').split(' ');
      let binary = path.split('/').pop();

      if (binary === 'env') {
        return argument;
      }

      return argument ? `${binary} ${argument}` : binary;
    };
    /***/ },

  /***/ 7334:
  /***/ (module) => {
    'use strict';

    module.exports = /^#!(.*)/;
    /***/ },

  /***/ 6848:
  /***/ (module, __unused_webpack_exports, __webpack_require__) => {
    let isWindows = process.platform === 'win32' ||
    process.env.OSTYPE === 'cygwin' ||
    process.env.OSTYPE === 'msys';

    let path = __webpack_require__(6928);
    let COLON = isWindows ? ';' : ':';
    let isexe = __webpack_require__(2940);

    let getNotFoundError = (cmd) =>
      Object.assign(new Error(`not found: ${cmd}`), { code: 'ENOENT' });

    let getPathInfo = (cmd, opt) => {
      let colon = opt.colon || COLON;

      // If it has a slash, then we don't bother searching the pathenv.
      // just check the file itself, and that's it.
      let pathEnv = cmd.match(/\//) || isWindows && cmd.match(/\\/) ? ['']
        :
        [
        // windows always checks the cwd first
          ...isWindows ? [process.cwd()] : [],
          ...(opt.path || process.env.PATH ||
          /* istanbul ignore next: very unusual */ '').split(colon),
        ];

      let pathExtExe = isWindows
        ? opt.pathExt || process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM'
        : '';
      let pathExt = isWindows ? pathExtExe.split(colon) : [''];

      if (isWindows) {
        if (cmd.indexOf('.') !== -1 && pathExt[0] !== '') {
          pathExt.unshift('');
        }
      }

      return {
        pathEnv,
        pathExt,
        pathExtExe,
      };
    };

    let which = (cmd, opt, cb) => {
      if (typeof opt === 'function') {
        cb = opt;
        opt = {};
      }
      if (!opt) {
        opt = {};
      }

      let { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
      let found = [];

      let step = i => new Promise((resolve, reject) => {
        if (i === pathEnv.length) {
          return opt.all && found.length ? resolve(found)
            : reject(getNotFoundError(cmd));
        }

        let ppRaw = pathEnv[i];
        let pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;

        let pCmd = path.join(pathPart, cmd);
        let p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd
          : pCmd;

        resolve(subStep(p, i, 0));
      });

      let subStep = (p, i, ii) => new Promise((resolve, reject) => {
        if (ii === pathExt.length) {
          return resolve(step(i + 1));
        }
        let ext = pathExt[ii];
        isexe(p + ext, { pathExt: pathExtExe }, (er, is) => {
          if (!er && is) {
            if (opt.all) {
              found.push(p + ext);
            } else {
              return resolve(p + ext);
            }
          }
          return resolve(subStep(p, i, ii + 1));
        });
      });

      return cb ? step(0).then(res => cb(null, res), cb) : step(0);
    };

    let whichSync = (cmd, opt) => {
      opt = opt || {};

      let { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
      let found = [];

      for (let i = 0; i < pathEnv.length; i++) {
        let ppRaw = pathEnv[i];
        let pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;

        let pCmd = path.join(pathPart, cmd);
        let p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd
          : pCmd;

        for (let j = 0; j < pathExt.length; j++) {
          let cur = p + pathExt[j];
          try {
            let is = isexe.sync(cur, { pathExt: pathExtExe });
            if (is) {
              if (opt.all) {
                found.push(cur);
              } else {
                return cur;
              }
            }
          } catch (ex) {}
        }
      }

      if (opt.all && found.length) {
        return found;
      }

      if (opt.nothrow) {
        return null;
      }

      throw getNotFoundError(cmd);
    };

    module.exports = which;
    which.sync = whichSync;
    /***/ },

  /***/ 7552:
  /***/ (__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {
    'use strict';

    // EXPORTS
    __webpack_require__.d(__webpack_exports__, {
      execa: () => /* binding */ execa,
      execaCommand: () => /* binding */ execaCommand,
    });

    // UNUSED EXPORTS: $, execaCommandSync, execaNode, execaSync

    // EXTERNAL MODULE: external "node:buffer"
    let external_node_buffer_ = __webpack_require__(4573);
    // EXTERNAL MODULE: external "node:path"
    let external_node_path_ = __webpack_require__(6760);
    // EXTERNAL MODULE: external "node:child_process"
    let external_node_child_process_ = __webpack_require__(1421);
    // EXTERNAL MODULE: external "node:process"
    let external_node_process_ = __webpack_require__(1708);
    // EXTERNAL MODULE: ./node_modules/cross-spawn/index.js
    let cross_spawn = __webpack_require__(546);
    // CONCATENATED MODULE: ./node_modules/execa/node_modules/strip-final-newline/index.js
    function stripFinalNewline(input) {
      let LF = typeof input === 'string' ? '\n' : '\n'.charCodeAt();
      let CR = typeof input === 'string' ? '\r' : '\r'.charCodeAt();

      if (input[input.length - 1] === LF) {
        input = input.slice(0, -1);
      }

      if (input[input.length - 1] === CR) {
        input = input.slice(0, -1);
      }

      return input;
    }

    // EXTERNAL MODULE: external "node:url"
    let external_node_url_ = __webpack_require__(3136);
    // CONCATENATED MODULE: ./node_modules/execa/node_modules/path-key/index.js
    function pathKey(options = {}) {
      let {
        env = process.env,
        platform = process.platform,
      } = options;

      if (platform !== 'win32') {
        return 'PATH';
      }

      return Object.keys(env).reverse().find(key => key.toUpperCase() === 'PATH') || 'Path';
    }

    // CONCATENATED MODULE: ./node_modules/execa/node_modules/npm-run-path/index.js

    function npmRunPath(options = {}) {
      let {
        cwd = external_node_process_.cwd(),
        path: path_ = external_node_process_.env[pathKey()],
        execPath = external_node_process_.execPath,
      } = options;

      let previous;
      let cwdString = cwd instanceof URL ? external_node_url_.fileURLToPath(cwd) : cwd;
      let cwdPath = external_node_path_.resolve(cwdString);
      let result = [];

      while (previous !== cwdPath) {
        result.push(external_node_path_.join(cwdPath, 'node_modules/.bin'));
        previous = cwdPath;
        cwdPath = external_node_path_.resolve(cwdPath, '..');
      }

      // Ensure the running `node` binary is used.
      result.push(external_node_path_.resolve(cwdString, execPath, '..'));

      return [...result, path_].join(external_node_path_.delimiter);
    }

    function npmRunPathEnv({ env = external_node_process_.env, ...options } = {}) {
      env = { ...env };

      let path = pathKey({ env });
      options.path = env[path];
      env[path] = npmRunPath(options);

      return env;
    }

    // CONCATENATED MODULE: ./node_modules/execa/node_modules/mimic-fn/index.js
    let copyProperty = (to, from, property, ignoreNonConfigurable) => {
      // `Function#length` should reflect the parameters of `to` not `from` since we keep its body.
      // `Function#prototype` is non-writable and non-configurable so can never be modified.
      if (property === 'length' || property === 'prototype') {
        return;
      }

      // `Function#arguments` and `Function#caller` should not be copied. They were reported to be present in `Reflect.ownKeys` for some devices in React Native (#41), so we explicitly ignore them here.
      if (property === 'arguments' || property === 'caller') {
        return;
      }

      let toDescriptor = Object.getOwnPropertyDescriptor(to, property);
      let fromDescriptor = Object.getOwnPropertyDescriptor(from, property);

      if (!canCopyProperty(toDescriptor, fromDescriptor) && ignoreNonConfigurable) {
        return;
      }

      Object.defineProperty(to, property, fromDescriptor);
    };

    // `Object.defineProperty()` throws if the property exists, is not configurable and either:
    // - one its descriptors is changed
    // - it is non-writable and its value is changed
    let canCopyProperty = function(toDescriptor, fromDescriptor) {
      return toDescriptor === undefined || toDescriptor.configurable ||
		toDescriptor.writable === fromDescriptor.writable &&
		toDescriptor.enumerable === fromDescriptor.enumerable &&
		toDescriptor.configurable === fromDescriptor.configurable &&
		(toDescriptor.writable || toDescriptor.value === fromDescriptor.value)
      ;
    };

    let changePrototype = (to, from) => {
      let fromPrototype = Object.getPrototypeOf(from);
      if (fromPrototype === Object.getPrototypeOf(to)) {
        return;
      }

      Object.setPrototypeOf(to, fromPrototype);
    };

    let wrappedToString = (withName, fromBody) => `/* Wrapped ${withName}*/\n${fromBody}`;

    let toStringDescriptor = Object.getOwnPropertyDescriptor(Function.prototype, 'toString');
    let toStringName = Object.getOwnPropertyDescriptor(Function.prototype.toString, 'name');

    // We call `from.toString()` early (not lazily) to ensure `from` can be garbage collected.
    // We use `bind()` instead of a closure for the same reason.
    // Calling `from.toString()` early also allows caching it in case `to.toString()` is called several times.
    let changeToString = (to, from, name) => {
      let withName = name === '' ? '' : `with ${name.trim()}() `;
      let newToString = wrappedToString.bind(null, withName, from.toString());
      // Ensure `to.toString.toString` is non-enumerable and has the same `same`
      Object.defineProperty(newToString, 'name', toStringName);
      Object.defineProperty(to, 'toString', { ...toStringDescriptor, value: newToString });
    };

    function mimicFunction(to, from, { ignoreNonConfigurable = false } = {}) {
      let { name } = to;

      for (let property of Reflect.ownKeys(from)) {
        copyProperty(to, from, property, ignoreNonConfigurable);
      }

      changePrototype(to, from);
      changeToString(to, from, name);

      return to;
    }

    // CONCATENATED MODULE: ./node_modules/execa/node_modules/onetime/index.js

    let calledFunctions = new WeakMap();

    let onetime = (function_, options = {}) => {
      if (typeof function_ !== 'function') {
        throw new TypeError('Expected a function');
      }

      let returnValue;
      let callCount = 0;
      let functionName = function_.displayName || function_.name || '<anonymous>';

      let onetime = function(...arguments_) {
        calledFunctions.set(onetime, ++callCount);

        if (callCount === 1) {
          returnValue = function_.apply(this, arguments_);
          function_ = null;
        } else if (options.throw === true) {
          throw new Error(`Function \`${functionName}\` can only be called once`);
        }

        return returnValue;
      };

      mimicFunction(onetime, function_);
      calledFunctions.set(onetime, callCount);

      return onetime;
    };

    onetime.callCount = function_ => {
      if (!calledFunctions.has(function_)) {
        throw new Error(`The given function \`${function_.name}\` is not wrapped by the \`onetime\` package`);
      }

      return calledFunctions.get(function_);
    };

    /* harmony default export */ let node_modules_onetime = onetime;

    // EXTERNAL MODULE: external "node:os"
    let external_node_os_ = __webpack_require__(8161);
    // CONCATENATED MODULE: ./node_modules/execa/node_modules/human-signals/build/src/realtime.js

    let getRealtimeSignals = ()=>{
      let length = SIGRTMAX - SIGRTMIN + 1;
      return Array.from({ length }, getRealtimeSignal);
    };

    let getRealtimeSignal = (value, index)=>({
      name: `SIGRT${index + 1}`,
      number: SIGRTMIN + index,
      action: 'terminate',
      description: 'Application-specific signal (realtime)',
      standard: 'posix',
    });

    let SIGRTMIN = 34;
    let SIGRTMAX = 64;
    // CONCATENATED MODULE: ./node_modules/execa/node_modules/human-signals/build/src/core.js

    let SIGNALS = [
      {
        name: 'SIGHUP',
        number: 1,
        action: 'terminate',
        description: 'Terminal closed',
        standard: 'posix',
      },
      {
        name: 'SIGINT',
        number: 2,
        action: 'terminate',
        description: 'User interruption with CTRL-C',
        standard: 'ansi',
      },
      {
        name: 'SIGQUIT',
        number: 3,
        action: 'core',
        description: 'User interruption with CTRL-\\',
        standard: 'posix',
      },
      {
        name: 'SIGILL',
        number: 4,
        action: 'core',
        description: 'Invalid machine instruction',
        standard: 'ansi',
      },
      {
        name: 'SIGTRAP',
        number: 5,
        action: 'core',
        description: 'Debugger breakpoint',
        standard: 'posix',
      },
      {
        name: 'SIGABRT',
        number: 6,
        action: 'core',
        description: 'Aborted',
        standard: 'ansi',
      },
      {
        name: 'SIGIOT',
        number: 6,
        action: 'core',
        description: 'Aborted',
        standard: 'bsd',
      },
      {
        name: 'SIGBUS',
        number: 7,
        action: 'core',
        description:
'Bus error due to misaligned, non-existing address or paging error',
        standard: 'bsd',
      },
      {
        name: 'SIGEMT',
        number: 7,
        action: 'terminate',
        description: 'Command should be emulated but is not implemented',
        standard: 'other',
      },
      {
        name: 'SIGFPE',
        number: 8,
        action: 'core',
        description: 'Floating point arithmetic error',
        standard: 'ansi',
      },
      {
        name: 'SIGKILL',
        number: 9,
        action: 'terminate',
        description: 'Forced termination',
        standard: 'posix',
        forced: true,
      },
      {
        name: 'SIGUSR1',
        number: 10,
        action: 'terminate',
        description: 'Application-specific signal',
        standard: 'posix',
      },
      {
        name: 'SIGSEGV',
        number: 11,
        action: 'core',
        description: 'Segmentation fault',
        standard: 'ansi',
      },
      {
        name: 'SIGUSR2',
        number: 12,
        action: 'terminate',
        description: 'Application-specific signal',
        standard: 'posix',
      },
      {
        name: 'SIGPIPE',
        number: 13,
        action: 'terminate',
        description: 'Broken pipe or socket',
        standard: 'posix',
      },
      {
        name: 'SIGALRM',
        number: 14,
        action: 'terminate',
        description: 'Timeout or timer',
        standard: 'posix',
      },
      {
        name: 'SIGTERM',
        number: 15,
        action: 'terminate',
        description: 'Termination',
        standard: 'ansi',
      },
      {
        name: 'SIGSTKFLT',
        number: 16,
        action: 'terminate',
        description: 'Stack is empty or overflowed',
        standard: 'other',
      },
      {
        name: 'SIGCHLD',
        number: 17,
        action: 'ignore',
        description: 'Child process terminated, paused or unpaused',
        standard: 'posix',
      },
      {
        name: 'SIGCLD',
        number: 17,
        action: 'ignore',
        description: 'Child process terminated, paused or unpaused',
        standard: 'other',
      },
      {
        name: 'SIGCONT',
        number: 18,
        action: 'unpause',
        description: 'Unpaused',
        standard: 'posix',
        forced: true,
      },
      {
        name: 'SIGSTOP',
        number: 19,
        action: 'pause',
        description: 'Paused',
        standard: 'posix',
        forced: true,
      },
      {
        name: 'SIGTSTP',
        number: 20,
        action: 'pause',
        description: 'Paused using CTRL-Z or "suspend"',
        standard: 'posix',
      },
      {
        name: 'SIGTTIN',
        number: 21,
        action: 'pause',
        description: 'Background process cannot read terminal input',
        standard: 'posix',
      },
      {
        name: 'SIGBREAK',
        number: 21,
        action: 'terminate',
        description: 'User interruption with CTRL-BREAK',
        standard: 'other',
      },
      {
        name: 'SIGTTOU',
        number: 22,
        action: 'pause',
        description: 'Background process cannot write to terminal output',
        standard: 'posix',
      },
      {
        name: 'SIGURG',
        number: 23,
        action: 'ignore',
        description: 'Socket received out-of-band data',
        standard: 'bsd',
      },
      {
        name: 'SIGXCPU',
        number: 24,
        action: 'core',
        description: 'Process timed out',
        standard: 'bsd',
      },
      {
        name: 'SIGXFSZ',
        number: 25,
        action: 'core',
        description: 'File too big',
        standard: 'bsd',
      },
      {
        name: 'SIGVTALRM',
        number: 26,
        action: 'terminate',
        description: 'Timeout or timer',
        standard: 'bsd',
      },
      {
        name: 'SIGPROF',
        number: 27,
        action: 'terminate',
        description: 'Timeout or timer',
        standard: 'bsd',
      },
      {
        name: 'SIGWINCH',
        number: 28,
        action: 'ignore',
        description: 'Terminal window size changed',
        standard: 'bsd',
      },
      {
        name: 'SIGIO',
        number: 29,
        action: 'terminate',
        description: 'I/O is available',
        standard: 'other',
      },
      {
        name: 'SIGPOLL',
        number: 29,
        action: 'terminate',
        description: 'Watched event',
        standard: 'other',
      },
      {
        name: 'SIGINFO',
        number: 29,
        action: 'ignore',
        description: 'Request for process information',
        standard: 'other',
      },
      {
        name: 'SIGPWR',
        number: 30,
        action: 'terminate',
        description: 'Device running out of power',
        standard: 'systemv',
      },
      {
        name: 'SIGSYS',
        number: 31,
        action: 'core',
        description: 'Invalid system call',
        standard: 'other',
      },
      {
        name: 'SIGUNUSED',
        number: 31,
        action: 'terminate',
        description: 'Invalid system call',
        standard: 'other',
      }];
    // CONCATENATED MODULE: ./node_modules/execa/node_modules/human-signals/build/src/signals.js

    let getSignals = ()=>{
      let realtimeSignals = getRealtimeSignals();
      let signals = [...SIGNALS, ...realtimeSignals].map(normalizeSignal);
      return signals;
    };

    let normalizeSignal = ({
      name,
      number: defaultNumber,
      description,
      action,
      forced = false,
      standard,
    })=>{
      let {
        signals: { [name]: constantSignal },
      } = external_node_os_.constants;
      let supported = constantSignal !== undefined;
      let number = supported ? constantSignal : defaultNumber;
      return { name, number, description, supported, action, forced, standard };
    };
    // CONCATENATED MODULE: ./node_modules/execa/node_modules/human-signals/build/src/main.js

    let getSignalsByName = ()=>{
      let signals = getSignals();
      return Object.fromEntries(signals.map(getSignalByName));
    };

    let getSignalByName = ({
      name,
      number,
      description,
      supported,
      action,
      forced,
      standard,
    })=>[name, { name, number, description, supported, action, forced, standard }];

    let signalsByName = getSignalsByName();

    let getSignalsByNumber = ()=>{
      let signals = getSignals();
      let length = SIGRTMAX + 1;
      let signalsA = Array.from({ length }, (value, number)=>
        getSignalByNumber(number, signals));
      return Object.assign({}, ...signalsA);
    };

    let getSignalByNumber = (number, signals)=>{
      let signal = findSignalByNumber(number, signals);

      if (signal === undefined) {
        return {};
      }

      let { name, description, supported, action, forced, standard } = signal;
      return {
        [number]: {
          name,
          number,
          description,
          supported,
          action,
          forced,
          standard,
        },
      };
    };

    let findSignalByNumber = (number, signals)=>{
      let signal = signals.find(({ name })=>external_node_os_.constants.signals[name] === number);

      if (signal !== undefined) {
        return signal;
      }

      return signals.find((signalA)=>signalA.number === number);
    };

    let signalsByNumber = getSignalsByNumber();
    // CONCATENATED MODULE: ./node_modules/execa/lib/error.js

    let getErrorPrefix = ({ timedOut, timeout, errorCode, signal, signalDescription, exitCode, isCanceled }) => {
      if (timedOut) {
        return `timed out after ${timeout} milliseconds`;
      }

      if (isCanceled) {
        return 'was canceled';
      }

      if (errorCode !== undefined) {
        return `failed with ${errorCode}`;
      }

      if (signal !== undefined) {
        return `was killed with ${signal} (${signalDescription})`;
      }

      if (exitCode !== undefined) {
        return `failed with exit code ${exitCode}`;
      }

      return 'failed';
    };

    let makeError = ({
      stdout,
      stderr,
      all,
      error,
      signal,
      exitCode,
      command,
      escapedCommand,
      timedOut,
      isCanceled,
      killed,
      parsed: { options: { timeout, cwd = external_node_process_.cwd() } },
    }) => {
      // `signal` and `exitCode` emitted on `spawned.on('exit')` event can be `null`.
      // We normalize them to `undefined`
      exitCode = exitCode === null ? undefined : exitCode;
      signal = signal === null ? undefined : signal;
      let signalDescription = signal === undefined ? undefined : signalsByName[signal].description;

      let errorCode = error && error.code;

      let prefix = getErrorPrefix({ timedOut, timeout, errorCode, signal, signalDescription, exitCode, isCanceled });
      let execaMessage = `Command ${prefix}: ${command}`;
      let isError = Object.prototype.toString.call(error) === '[object Error]';
      let shortMessage = isError ? `${execaMessage}\n${error.message}` : execaMessage;
      let message = [shortMessage, stderr, stdout].filter(Boolean).join('\n');

      if (isError) {
        error.originalMessage = error.message;
        error.message = message;
      } else {
        error = new Error(message);
      }

      error.shortMessage = shortMessage;
      error.command = command;
      error.escapedCommand = escapedCommand;
      error.exitCode = exitCode;
      error.signal = signal;
      error.signalDescription = signalDescription;
      error.stdout = stdout;
      error.stderr = stderr;
      error.cwd = cwd;

      if (all !== undefined) {
        error.all = all;
      }

      if ('bufferedData' in error) {
        delete error.bufferedData;
      }

      error.failed = true;
      error.timedOut = Boolean(timedOut);
      error.isCanceled = isCanceled;
      error.killed = killed && !timedOut;

      return error;
    };

    // CONCATENATED MODULE: ./node_modules/execa/lib/stdio.js
    let aliases = ['stdin', 'stdout', 'stderr'];

    let hasAlias = options => aliases.some(alias => options[alias] !== undefined);

    let normalizeStdio = options => {
      if (!options) {
        return;
      }

      let { stdio } = options;

      if (stdio === undefined) {
        return aliases.map(alias => options[alias]);
      }

      if (hasAlias(options)) {
        throw new Error(`It's not possible to provide \`stdio\` in combination with one of ${aliases.map(alias => `\`${alias}\``).join(', ')}`);
      }

      if (typeof stdio === 'string') {
        return stdio;
      }

      if (!Array.isArray(stdio)) {
        throw new TypeError(`Expected \`stdio\` to be of type \`string\` or \`Array\`, got \`${typeof stdio}\``);
      }

      let length = Math.max(stdio.length, aliases.length);
      return Array.from({ length }, (value, index) => stdio[index]);
    };

    // `ipc` is pushed unless it is already present
    let stdio_normalizeStdioNode = options => {
      let stdio = normalizeStdio(options);

      if (stdio === 'ipc') {
        return 'ipc';
      }

      if (stdio === undefined || typeof stdio === 'string') {
        return [stdio, stdio, stdio, 'ipc'];
      }

      if (stdio.includes('ipc')) {
        return stdio;
      }

      return [...stdio, 'ipc'];
    };

    // CONCATENATED MODULE: ./node_modules/execa/node_modules/signal-exit/dist/mjs/signals.js
    /**
 * This is not the set of all possible signals.
 *
 * It IS, however, the set of all signals that trigger
 * an exit on either Linux or BSD systems.  Linux is a
 * superset of the signal names supported on BSD, and
 * the unknown signals just fail to register, so we can
 * catch that easily enough.
 *
 * Windows signals are a different set, since there are
 * signals that terminate Windows processes, but don't
 * terminate (or don't even exist) on Posix systems.
 *
 * Don't bother with SIGKILL.  It's uncatchable, which
 * means that we can't fire any callbacks anyway.
 *
 * If a user does happen to register a handler on a non-
 * fatal signal like SIGWINCH or something, and then
 * exit, it'll end up firing `process.emit('exit')`, so
 * the handler will be fired anyway.
 *
 * SIGBUS, SIGFPE, SIGSEGV and SIGILL, when not raised
 * artificially, inherently leave the process in a
 * state from which it is not safe to try and enter JS
 * listeners.
 */
    let signals = [];
    signals.push('SIGHUP', 'SIGINT', 'SIGTERM');
    if (process.platform !== 'win32') {
      signals.push('SIGALRM', 'SIGABRT', 'SIGVTALRM', 'SIGXCPU', 'SIGXFSZ', 'SIGUSR2', 'SIGTRAP', 'SIGSYS', 'SIGQUIT', 'SIGIOT',
        // should detect profiler and enable/disable accordingly.
        // see #21
        // 'SIGPROF'
      );
    }
    if (process.platform === 'linux') {
      signals.push('SIGIO', 'SIGPOLL', 'SIGPWR', 'SIGSTKFLT');
    }
    // # sourceMappingURL=signals.js.map
    // CONCATENATED MODULE: ./node_modules/execa/node_modules/signal-exit/dist/mjs/index.js
    // Note: since nyc uses this module to output coverage, any lines
    // that are in the direct sync flow of nyc's outputCoverage are
    // ignored, since we can never get coverage for them.
    // grab a reference to node's real process object right away

    let processOk = (process) => !!process &&
    typeof process === 'object' &&
    typeof process.removeListener === 'function' &&
    typeof process.emit === 'function' &&
    typeof process.reallyExit === 'function' &&
    typeof process.listeners === 'function' &&
    typeof process.kill === 'function' &&
    typeof process.pid === 'number' &&
    typeof process.on === 'function';
    let kExitEmitter = Symbol.for('signal-exit emitter');
    let global = globalThis;
    let ObjectDefineProperty = Object.defineProperty.bind(Object);
    // teeny special purpose ee
    class Emitter {
      emitted = {
        afterExit: false,
        exit: false,
      };
      listeners = {
        afterExit: [],
        exit: [],
      };
      count = 0;
      id = Math.random();
      constructor() {
        if (global[kExitEmitter]) {
          return global[kExitEmitter];
        }
        ObjectDefineProperty(global, kExitEmitter, {
          value: this,
          writable: false,
          enumerable: false,
          configurable: false,
        });
      }
      on(ev, fn) {
        this.listeners[ev].push(fn);
      }
      removeListener(ev, fn) {
        let list = this.listeners[ev];
        let i = list.indexOf(fn);
        /* c8 ignore start */
        if (i === -1) {
          return;
        }
        /* c8 ignore stop */
        if (i === 0 && list.length === 1) {
          list.length = 0;
        } else {
          list.splice(i, 1);
        }
      }
      emit(ev, code, signal) {
        if (this.emitted[ev]) {
          return false;
        }
        this.emitted[ev] = true;
        let ret = false;
        for (let fn of this.listeners[ev]) {
          ret = fn(code, signal) === true || ret;
        }
        if (ev === 'exit') {
          ret = this.emit('afterExit', code, signal) || ret;
        }
        return ret;
      }
    }
    class SignalExitBase {
    }
    let signalExitWrap = (handler) => {
      return {
        onExit(cb, opts) {
          return handler.onExit(cb, opts);
        },
        load() {
          return handler.load();
        },
        unload() {
          return handler.unload();
        },
      };
    };
    class SignalExitFallback extends SignalExitBase {
      onExit() {
        return () => { };
      }
      load() { }
      unload() { }
    }
    class SignalExit extends SignalExitBase {
    // "SIGHUP" throws an `ENOSYS` error on Windows,
    // so use a supported signal instead
    /* c8 ignore start */
      #hupSig = mjs_process.platform === 'win32' ? 'SIGINT' : 'SIGHUP';
      /* c8 ignore stop */
      #emitter = new Emitter();
      #process;
      #originalProcessEmit;
      #originalProcessReallyExit;
      #sigListeners = {};
      #loaded = false;
      constructor(process) {
        super();
        this.#process = process;
        // { <signal>: <listener fn>, ... }
        this.#sigListeners = {};
        for (let sig of signals) {
          this.#sigListeners[sig] = () => {
            // If there are no other listeners, an exit is coming!
            // Simplest way: remove us and then re-send the signal.
            // We know that this will kill the process, so we can
            // safely emit now.
            let listeners = this.#process.listeners(sig);
            let { count } = this.#emitter;
            // This is a workaround for the fact that signal-exit v3 and signal
            // exit v4 are not aware of each other, and each will attempt to let
            // the other handle it, so neither of them do. To correct this, we
            // detect if we're the only handler *except* for previous versions
            // of signal-exit, and increment by the count of listeners it has
            // created.
            /* c8 ignore start */
            let p = process;
            if (typeof p.__signal_exit_emitter__ === 'object' &&
                    typeof p.__signal_exit_emitter__.count === 'number') {
              count += p.__signal_exit_emitter__.count;
            }
            /* c8 ignore stop */
            if (listeners.length === count) {
              this.unload();
              let ret = this.#emitter.emit('exit', null, sig);
              /* c8 ignore start */
              let s = sig === 'SIGHUP' ? this.#hupSig : sig;
              if (!ret) {
                process.kill(process.pid, s);
              }
              /* c8 ignore stop */
            }
          };
        }
        this.#originalProcessReallyExit = process.reallyExit;
        this.#originalProcessEmit = process.emit;
      }
      onExit(cb, opts) {
        /* c8 ignore start */
        if (!processOk(this.#process)) {
          return () => { };
        }
        /* c8 ignore stop */
        if (this.#loaded === false) {
          this.load();
        }
        let ev = opts?.alwaysLast ? 'afterExit' : 'exit';
        this.#emitter.on(ev, cb);
        return () => {
          this.#emitter.removeListener(ev, cb);
          if (this.#emitter.listeners['exit'].length === 0 &&
                this.#emitter.listeners['afterExit'].length === 0) {
            this.unload();
          }
        };
      }
      load() {
        if (this.#loaded) {
          return;
        }
        this.#loaded = true;
        // This is the number of onSignalExit's that are in play.
        // It's important so that we can count the correct number of
        // listeners on signals, and don't wait for the other one to
        // handle it instead of us.
        this.#emitter.count += 1;
        for (let sig of signals) {
          try {
            let fn = this.#sigListeners[sig];
            if (fn) {
              this.#process.on(sig, fn);
            }
          } catch (_) { }
        }
        this.#process.emit = (ev, ...a) => {
          return this.#processEmit(ev, ...a);
        };
        this.#process.reallyExit = (code) => {
          return this.#processReallyExit(code);
        };
      }
      unload() {
        if (!this.#loaded) {
          return;
        }
        this.#loaded = false;
        signals.forEach(sig => {
          let listener = this.#sigListeners[sig];
          /* c8 ignore start */
          if (!listener) {
            throw new Error('Listener not defined for signal: ' + sig);
          }
          /* c8 ignore stop */
          try {
            this.#process.removeListener(sig, listener);
            /* c8 ignore start */
          } catch (_) { }
          /* c8 ignore stop */
        });
        this.#process.emit = this.#originalProcessEmit;
        this.#process.reallyExit = this.#originalProcessReallyExit;
        this.#emitter.count -= 1;
      }
      #processReallyExit(code) {
        /* c8 ignore start */
        if (!processOk(this.#process)) {
          return 0;
        }
        this.#process.exitCode = code || 0;
        /* c8 ignore stop */
        this.#emitter.emit('exit', this.#process.exitCode, null);
        return this.#originalProcessReallyExit.call(this.#process, this.#process.exitCode);
      }
      #processEmit(ev, ...args) {
        let og = this.#originalProcessEmit;
        if (ev === 'exit' && processOk(this.#process)) {
          if (typeof args[0] === 'number') {
            this.#process.exitCode = args[0];
            /* c8 ignore start */
          }
          /* c8 ignore start */
          let ret = og.call(this.#process, ev, ...args);
          /* c8 ignore start */
          this.#emitter.emit('exit', this.#process.exitCode, null);
          /* c8 ignore stop */
          return ret;
        } else {
          return og.call(this.#process, ev, ...args);
        }
      }
    }
    let mjs_process = globalThis.process;
    // wrap so that we call the method on the actual handler, without
    // exporting it directly.
    let {
      /**
 * Called when the process is exiting, whether via signal, explicit
 * exit, or running out of stuff to do.
 *
 * If the global process object is not suitable for instrumentation,
 * then this will be a no-op.
 *
 * Returns a function that may be used to unload signal-exit.
 */
      onExit,
      /**
 * Load the listeners.  Likely you never need to call this, unless
 * doing a rather deep integration with signal-exit functionality.
 * Mostly exposed for the benefit of testing.
 *
 * @internal
 */
      load,
      /**
 * Unload the listeners.  Likely you never need to call this, unless
 * doing a rather deep integration with signal-exit functionality.
 * Mostly exposed for the benefit of testing.
 *
 * @internal
 */
      unload } = signalExitWrap(processOk(mjs_process) ? new SignalExit(mjs_process) : new SignalExitFallback());
    // # sourceMappingURL=index.js.map
    // CONCATENATED MODULE: ./node_modules/execa/lib/kill.js

    let DEFAULT_FORCE_KILL_TIMEOUT = 1000 * 5;

    // Monkey-patches `childProcess.kill()` to add `forceKillAfterTimeout` behavior
    let spawnedKill = (kill, signal = 'SIGTERM', options = {}) => {
      let killResult = kill(signal);
      setKillTimeout(kill, signal, options, killResult);
      return killResult;
    };

    let setKillTimeout = (kill, signal, options, killResult) => {
      if (!shouldForceKill(signal, options, killResult)) {
        return;
      }

      let timeout = getForceKillAfterTimeout(options);
      let t = setTimeout(() => {
        kill('SIGKILL');
      }, timeout);

      // Guarded because there's no `.unref()` when `execa` is used in the renderer
      // process in Electron. This cannot be tested since we don't run tests in
      // Electron.
      // istanbul ignore else
      if (t.unref) {
        t.unref();
      }
    };

    let shouldForceKill = (signal, { forceKillAfterTimeout }, killResult) => isSigterm(signal) && forceKillAfterTimeout !== false && killResult;

    let isSigterm = signal => signal === external_node_os_.constants.signals.SIGTERM
		|| typeof signal === 'string' && signal.toUpperCase() === 'SIGTERM';

    let getForceKillAfterTimeout = ({ forceKillAfterTimeout = true }) => {
      if (forceKillAfterTimeout === true) {
        return DEFAULT_FORCE_KILL_TIMEOUT;
      }

      if (!Number.isFinite(forceKillAfterTimeout) || forceKillAfterTimeout < 0) {
        throw new TypeError(`Expected the \`forceKillAfterTimeout\` option to be a non-negative integer, got \`${forceKillAfterTimeout}\` (${typeof forceKillAfterTimeout})`);
      }

      return forceKillAfterTimeout;
    };

    // `childProcess.cancel()`
    let spawnedCancel = (spawned, context) => {
      let killResult = spawned.kill();

      if (killResult) {
        context.isCanceled = true;
      }
    };

    let timeoutKill = (spawned, signal, reject) => {
      spawned.kill(signal);
      reject(Object.assign(new Error('Timed out'), { timedOut: true, signal }));
    };

    // `timeout` option handling
    let setupTimeout = (spawned, { timeout, killSignal = 'SIGTERM' }, spawnedPromise) => {
      if (timeout === 0 || timeout === undefined) {
        return spawnedPromise;
      }

      let timeoutId;
      let timeoutPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          timeoutKill(spawned, killSignal, reject);
        }, timeout);
      });

      let safeSpawnedPromise = spawnedPromise.finally(() => {
        clearTimeout(timeoutId);
      });

      return Promise.race([timeoutPromise, safeSpawnedPromise]);
    };

    let validateTimeout = ({ timeout }) => {
      if (timeout !== undefined && (!Number.isFinite(timeout) || timeout < 0)) {
        throw new TypeError(`Expected the \`timeout\` option to be a non-negative integer, got \`${timeout}\` (${typeof timeout})`);
      }
    };

    // `cleanup` option handling
    let setExitHandler = async(spawned, { cleanup, detached }, timedPromise) => {
      if (!cleanup || detached) {
        return timedPromise;
      }

      let removeExitHandler = onExit(() => {
        spawned.kill();
      });

      return timedPromise.finally(() => {
        removeExitHandler();
      });
    };

    // EXTERNAL MODULE: external "node:fs"
    let external_node_fs_ = __webpack_require__(3024);
    // CONCATENATED MODULE: ./node_modules/execa/node_modules/is-stream/index.js
    function isStream(stream) {
      return stream !== null
		&& typeof stream === 'object'
		&& typeof stream.pipe === 'function';
    }

    function isWritableStream(stream) {
      return isStream(stream)
		&& stream.writable !== false
		&& typeof stream._write === 'function'
		&& typeof stream._writableState === 'object';
    }

    function isReadableStream(stream) {
      return isStream(stream)
		&& stream.readable !== false
		&& typeof stream._read === 'function'
		&& typeof stream._readableState === 'object';
    }

    function isDuplexStream(stream) {
      return isWritableStream(stream)
		&& isReadableStream(stream);
    }

    function isTransformStream(stream) {
      return isDuplexStream(stream)
		&& typeof stream._transform === 'function';
    }

    // CONCATENATED MODULE: ./node_modules/execa/lib/pipe.js

    let isExecaChildProcess = target => target instanceof external_node_child_process_.ChildProcess && typeof target.then === 'function';

    let pipeToTarget = (spawned, streamName, target) => {
      if (typeof target === 'string') {
        spawned[streamName].pipe((0, external_node_fs_.createWriteStream)(target));
        return spawned;
      }

      if (isWritableStream(target)) {
        spawned[streamName].pipe(target);
        return spawned;
      }

      if (!isExecaChildProcess(target)) {
        throw new TypeError('The second argument must be a string, a stream or an Execa child process.');
      }

      if (!isWritableStream(target.stdin)) {
        throw new TypeError('The target child process\'s stdin must be available.');
      }

      spawned[streamName].pipe(target.stdin);
      return target;
    };

    let addPipeMethods = spawned => {
      if (spawned.stdout !== null) {
        spawned.pipeStdout = pipeToTarget.bind(undefined, spawned, 'stdout');
      }

      if (spawned.stderr !== null) {
        spawned.pipeStderr = pipeToTarget.bind(undefined, spawned, 'stderr');
      }

      if (spawned.all !== undefined) {
        spawned.pipeAll = pipeToTarget.bind(undefined, spawned, 'all');
      }
    };

    // EXTERNAL MODULE: external "node:timers/promises"
    let promises_ = __webpack_require__(8500);
    // CONCATENATED MODULE: ./node_modules/execa/node_modules/get-stream/source/contents.js
    let contents_getStreamContents = async(stream, { init, convertChunk, getSize, truncateChunk, addChunk, getFinalChunk, finalize }, { maxBuffer = Number.POSITIVE_INFINITY } = {}) => {
      if (!isAsyncIterable(stream)) {
        throw new Error('The first argument must be a Readable, a ReadableStream, or an async iterable.');
      }

      let state = init();
      state.length = 0;

      try {
        for await (let chunk of stream) {
          let chunkType = getChunkType(chunk);
          let convertedChunk = convertChunk[chunkType](chunk, state);
          appendChunk({ convertedChunk, state, getSize, truncateChunk, addChunk, maxBuffer });
        }

        appendFinalChunk({ state, convertChunk, getSize, truncateChunk, addChunk, getFinalChunk, maxBuffer });
        return finalize(state);
      } catch (error) {
        error.bufferedData = finalize(state);
        throw error;
      }
    };

    let appendFinalChunk = ({ state, getSize, truncateChunk, addChunk, getFinalChunk, maxBuffer }) => {
      let convertedChunk = getFinalChunk(state);
      if (convertedChunk !== undefined) {
        appendChunk({ convertedChunk, state, getSize, truncateChunk, addChunk, maxBuffer });
      }
    };

    let appendChunk = ({ convertedChunk, state, getSize, truncateChunk, addChunk, maxBuffer }) => {
      let chunkSize = getSize(convertedChunk);
      let newLength = state.length + chunkSize;

      if (newLength <= maxBuffer) {
        addNewChunk(convertedChunk, state, addChunk, newLength);
        return;
      }

      let truncatedChunk = truncateChunk(convertedChunk, maxBuffer - state.length);

      if (truncatedChunk !== undefined) {
        addNewChunk(truncatedChunk, state, addChunk, maxBuffer);
      }

      throw new MaxBufferError();
    };

    let addNewChunk = (convertedChunk, state, addChunk, newLength) => {
      state.contents = addChunk(convertedChunk, state, newLength);
      state.length = newLength;
    };

    let isAsyncIterable = stream => typeof stream === 'object' && stream !== null && typeof stream[Symbol.asyncIterator] === 'function';

    let getChunkType = chunk => {
      let typeOfChunk = typeof chunk;

      if (typeOfChunk === 'string') {
        return 'string';
      }

      if (typeOfChunk !== 'object' || chunk === null) {
        return 'others';
      }

      if (globalThis.Buffer?.isBuffer(chunk)) {
        return 'buffer';
      }

      let prototypeName = objectToString.call(chunk);

      if (prototypeName === '[object ArrayBuffer]') {
        return 'arrayBuffer';
      }

      if (prototypeName === '[object DataView]') {
        return 'dataView';
      }

      if (
        Number.isInteger(chunk.byteLength)
		&& Number.isInteger(chunk.byteOffset)
		&& objectToString.call(chunk.buffer) === '[object ArrayBuffer]'
      ) {
        return 'typedArray';
      }

      return 'others';
    };

    let { toString: objectToString } = Object.prototype;

    class MaxBufferError extends Error {
      name = 'MaxBufferError';

      constructor() {
        super('maxBuffer exceeded');
      }
    }

    // CONCATENATED MODULE: ./node_modules/execa/node_modules/get-stream/source/utils.js
    let identity = value => value;

    let noop = () => undefined;

    let getContentsProp = ({ contents }) => contents;

    let throwObjectStream = chunk => {
      throw new Error(`Streams in object mode are not supported: ${String(chunk)}`);
    };

    let getLengthProp = convertedChunk => convertedChunk.length;

    // CONCATENATED MODULE: ./node_modules/execa/node_modules/get-stream/source/array.js

    async function getStreamAsArray(stream, options) {
      return getStreamContents(stream, arrayMethods, options);
    }

    let initArray = () => ({ contents: [] });

    let increment = () => 1;

    let addArrayChunk = (convertedChunk, { contents }) => {
      contents.push(convertedChunk);
      return contents;
    };

    let arrayMethods = {
      init: initArray,
      convertChunk: {
        string: identity,
        buffer: identity,
        arrayBuffer: identity,
        dataView: identity,
        typedArray: identity,
        others: identity,
      },
      getSize: increment,
      truncateChunk: noop,
      addChunk: addArrayChunk,
      getFinalChunk: noop,
      finalize: getContentsProp,
    };

    // CONCATENATED MODULE: ./node_modules/execa/node_modules/get-stream/source/array-buffer.js

    async function getStreamAsArrayBuffer(stream, options) {
      return contents_getStreamContents(stream, arrayBufferMethods, options);
    }

    let initArrayBuffer = () => ({ contents: new ArrayBuffer(0) });

    let useTextEncoder = chunk => textEncoder.encode(chunk);
    let textEncoder = new TextEncoder();

    let useUint8Array = chunk => new Uint8Array(chunk);

    let useUint8ArrayWithOffset = chunk => new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);

    let truncateArrayBufferChunk = (convertedChunk, chunkSize) => convertedChunk.slice(0, chunkSize);

    // `contents` is an increasingly growing `Uint8Array`.
    let addArrayBufferChunk = (convertedChunk, { contents, length: previousLength }, length) => {
      let newContents = hasArrayBufferResize() ? resizeArrayBuffer(contents, length) : resizeArrayBufferSlow(contents, length);
      new Uint8Array(newContents).set(convertedChunk, previousLength);
      return newContents;
    };

    // Without `ArrayBuffer.resize()`, `contents` size is always a power of 2.
    // This means its last bytes are zeroes (not stream data), which need to be
    // trimmed at the end with `ArrayBuffer.slice()`.
    let resizeArrayBufferSlow = (contents, length) => {
      if (length <= contents.byteLength) {
        return contents;
      }

      let arrayBuffer = new ArrayBuffer(getNewContentsLength(length));
      new Uint8Array(arrayBuffer).set(new Uint8Array(contents), 0);
      return arrayBuffer;
    };

    // With `ArrayBuffer.resize()`, `contents` size matches exactly the size of
    // the stream data. It does not include extraneous zeroes to trim at the end.
    // The underlying `ArrayBuffer` does allocate a number of bytes that is a power
    // of 2, but those bytes are only visible after calling `ArrayBuffer.resize()`.
    let resizeArrayBuffer = (contents, length) => {
      if (length <= contents.maxByteLength) {
        contents.resize(length);
        return contents;
      }

      let arrayBuffer = new ArrayBuffer(length, { maxByteLength: getNewContentsLength(length) });
      new Uint8Array(arrayBuffer).set(new Uint8Array(contents), 0);
      return arrayBuffer;
    };

    // Retrieve the closest `length` that is both >= and a power of 2
    let getNewContentsLength = length => SCALE_FACTOR ** Math.ceil(Math.log(length) / Math.log(SCALE_FACTOR));

    let SCALE_FACTOR = 2;

    let finalizeArrayBuffer = ({ contents, length }) => hasArrayBufferResize() ? contents : contents.slice(0, length);

    // `ArrayBuffer.slice()` is slow. When `ArrayBuffer.resize()` is available
    // (Node >=20.0.0, Safari >=16.4 and Chrome), we can use it instead.

    // TODO: remove after dropping support for Node 20.

    // TODO: use `ArrayBuffer.transferToFixedLength()` instead once it is available
    let hasArrayBufferResize = () => 'resize' in ArrayBuffer.prototype;

    let arrayBufferMethods = {
      init: initArrayBuffer,
      convertChunk: {
        string: useTextEncoder,
        buffer: useUint8Array,
        arrayBuffer: useUint8Array,
        dataView: useUint8ArrayWithOffset,
        typedArray: useUint8ArrayWithOffset,
        others: throwObjectStream,
      },
      getSize: getLengthProp,
      truncateChunk: truncateArrayBufferChunk,
      addChunk: addArrayBufferChunk,
      getFinalChunk: noop,
      finalize: finalizeArrayBuffer,
    };

    // CONCATENATED MODULE: ./node_modules/execa/node_modules/get-stream/source/buffer.js

    async function getStreamAsBuffer(stream, options) {
      if (!('Buffer' in globalThis)) {
        throw new Error('getStreamAsBuffer() is only supported in Node.js');
      }

      try {
        return arrayBufferToNodeBuffer(await getStreamAsArrayBuffer(stream, options));
      } catch (error) {
        if (error.bufferedData !== undefined) {
          error.bufferedData = arrayBufferToNodeBuffer(error.bufferedData);
        }

        throw error;
      }
    }

    let arrayBufferToNodeBuffer = arrayBuffer => globalThis.Buffer.from(arrayBuffer);

    // CONCATENATED MODULE: ./node_modules/execa/node_modules/get-stream/source/string.js

    async function getStreamAsString(stream, options) {
      return contents_getStreamContents(stream, stringMethods, options);
    }

    let initString = () => ({ contents: '', textDecoder: new TextDecoder() });

    let useTextDecoder = (chunk, { textDecoder }) => textDecoder.decode(chunk, { stream: true });

    let addStringChunk = (convertedChunk, { contents }) => contents + convertedChunk;

    let truncateStringChunk = (convertedChunk, chunkSize) => convertedChunk.slice(0, chunkSize);

    let getFinalStringChunk = ({ textDecoder }) => {
      let finalChunk = textDecoder.decode();
      return finalChunk === '' ? undefined : finalChunk;
    };

    let stringMethods = {
      init: initString,
      convertChunk: {
        string: identity,
        buffer: useTextDecoder,
        arrayBuffer: useTextDecoder,
        dataView: useTextDecoder,
        typedArray: useTextDecoder,
        others: throwObjectStream,
      },
      getSize: getLengthProp,
      truncateChunk: truncateStringChunk,
      addChunk: addStringChunk,
      getFinalChunk: getFinalStringChunk,
      finalize: getContentsProp,
    };

    // CONCATENATED MODULE: ./node_modules/execa/node_modules/get-stream/source/index.js

    // EXTERNAL MODULE: ./node_modules/merge-stream/index.js
    let merge_stream = __webpack_require__(8595);
    // CONCATENATED MODULE: ./node_modules/execa/lib/stream.js

    let validateInputOptions = input => {
      if (input !== undefined) {
        throw new TypeError('The `input` and `inputFile` options cannot be both set.');
      }
    };

    let getInputSync = ({ input, inputFile }) => {
      if (typeof inputFile !== 'string') {
        return input;
      }

      validateInputOptions(input);
      return (0, external_node_fs_.readFileSync)(inputFile);
    };

    // `input` and `inputFile` option in sync mode
    let handleInputSync = options => {
      let input = getInputSync(options);

      if (isStream(input)) {
        throw new TypeError('The `input` option cannot be a stream in sync mode');
      }

      return input;
    };

    let getInput = ({ input, inputFile }) => {
      if (typeof inputFile !== 'string') {
        return input;
      }

      validateInputOptions(input);
      return (0, external_node_fs_.createReadStream)(inputFile);
    };

    // `input` and `inputFile` option in async mode
    let handleInput = (spawned, options) => {
      let input = getInput(options);

      if (input === undefined) {
        return;
      }

      if (isStream(input)) {
        input.pipe(spawned.stdin);
      } else {
        spawned.stdin.end(input);
      }
    };

    // `all` interleaves `stdout` and `stderr`
    let makeAllStream = (spawned, { all }) => {
      if (!all || !spawned.stdout && !spawned.stderr) {
        return;
      }

      let mixed = merge_stream();

      if (spawned.stdout) {
        mixed.add(spawned.stdout);
      }

      if (spawned.stderr) {
        mixed.add(spawned.stderr);
      }

      return mixed;
    };

    // On failure, `result.stdout|stderr|all` should contain the currently buffered stream
    let getBufferedData = async(stream, streamPromise) => {
      // When `buffer` is `false`, `streamPromise` is `undefined` and there is no buffered data to retrieve
      if (!stream || streamPromise === undefined) {
        return;
      }

      // Wait for the `all` stream to receive the last chunk before destroying the stream
      await (0, promises_.setTimeout)(0);

      stream.destroy();

      try {
        return await streamPromise;
      } catch (error) {
        return error.bufferedData;
      }
    };

    let getStreamPromise = (stream, { encoding, buffer, maxBuffer }) => {
      if (!stream || !buffer) {
        return;
      }

      // eslint-disable-next-line unicorn/text-encoding-identifier-case
      if (encoding === 'utf8' || encoding === 'utf-8') {
        return getStreamAsString(stream, { maxBuffer });
      }

      if (encoding === null || encoding === 'buffer') {
        return getStreamAsBuffer(stream, { maxBuffer });
      }

      return applyEncoding(stream, maxBuffer, encoding);
    };

    let applyEncoding = async(stream, maxBuffer, encoding) => {
      let buffer = await getStreamAsBuffer(stream, { maxBuffer });
      return buffer.toString(encoding);
    };

    // Retrieve result of child process: exit code, signal, error, streams (stdout/stderr/all)
    let getSpawnedResult = async({ stdout, stderr, all }, { encoding, buffer, maxBuffer }, processDone) => {
      let stdoutPromise = getStreamPromise(stdout, { encoding, buffer, maxBuffer });
      let stderrPromise = getStreamPromise(stderr, { encoding, buffer, maxBuffer });
      let allPromise = getStreamPromise(all, { encoding, buffer, maxBuffer: maxBuffer * 2 });

      try {
        return await Promise.all([processDone, stdoutPromise, stderrPromise, allPromise]);
      } catch (error) {
        return Promise.all([
          { error, signal: error.signal, timedOut: error.timedOut },
          getBufferedData(stdout, stdoutPromise),
          getBufferedData(stderr, stderrPromise),
          getBufferedData(all, allPromise),
        ]);
      }
    };

    // CONCATENATED MODULE: ./node_modules/execa/lib/promise.js
    // eslint-disable-next-line unicorn/prefer-top-level-await
    let nativePromisePrototype = (async() => {})().constructor.prototype;

    let descriptors = ['then', 'catch', 'finally'].map(property => [
      property,
      Reflect.getOwnPropertyDescriptor(nativePromisePrototype, property),
    ]);

    // The return value is a mixin of `childProcess` and `Promise`
    let mergePromise = (spawned, promise) => {
      for (let [property, descriptor] of descriptors) {
        // Starting the main `promise` is deferred to avoid consuming streams
        let value = typeof promise === 'function'
          ? (...args) => Reflect.apply(descriptor.value, promise(), args)
          : descriptor.value.bind(promise);

        Reflect.defineProperty(spawned, property, { ...descriptor, value });
      }
    };

    // Use promises instead of `child_process` events
    let getSpawnedPromise = spawned => new Promise((resolve, reject) => {
      spawned.on('exit', (exitCode, signal) => {
        resolve({ exitCode, signal });
      });

      spawned.on('error', error => {
        reject(error);
      });

      if (spawned.stdin) {
        spawned.stdin.on('error', error => {
          reject(error);
        });
      }
    });

    // CONCATENATED MODULE: ./node_modules/execa/lib/command.js

    let normalizeArgs = (file, args = []) => {
      if (!Array.isArray(args)) {
        return [file];
      }

      return [file, ...args];
    };

    let NO_ESCAPE_REGEXP = /^[\w.-]+$/;

    let escapeArg = arg => {
      if (typeof arg !== 'string' || NO_ESCAPE_REGEXP.test(arg)) {
        return arg;
      }

      return `"${arg.replaceAll('"', '\\"')}"`;
    };

    let joinCommand = (file, args) => normalizeArgs(file, args).join(' ');

    let getEscapedCommand = (file, args) => normalizeArgs(file, args).map(arg => escapeArg(arg)).join(' ');

    let SPACES_REGEXP = / +/g;

    // Handle `execaCommand()`
    let command_parseCommand = command => {
      let tokens = [];
      for (let token of command.trim().split(SPACES_REGEXP)) {
        // Allow spaces to be escaped by a backslash if not meant as a delimiter
        let previousToken = tokens.at(-1);
        if (previousToken && previousToken.endsWith('\\')) {
          // Merge previous token with current one
          tokens[tokens.length - 1] = `${previousToken.slice(0, -1)} ${token}`;
        } else {
          tokens.push(token);
        }
      }

      return tokens;
    };

    let parseExpression = expression => {
      let typeOfExpression = typeof expression;

      if (typeOfExpression === 'string') {
        return expression;
      }

      if (typeOfExpression === 'number') {
        return String(expression);
      }

      if (
        typeOfExpression === 'object'
		&& expression !== null
		&& !(expression instanceof external_node_child_process_.ChildProcess)
		&& 'stdout' in expression
      ) {
        let typeOfStdout = typeof expression.stdout;

        if (typeOfStdout === 'string') {
          return expression.stdout;
        }

        if (external_node_buffer_.Buffer.isBuffer(expression.stdout)) {
          return expression.stdout.toString();
        }

        throw new TypeError(`Unexpected "${typeOfStdout}" stdout in template expression`);
      }

      throw new TypeError(`Unexpected "${typeOfExpression}" in template expression`);
    };

    let concatTokens = (tokens, nextTokens, isNew) => isNew || tokens.length === 0 || nextTokens.length === 0
      ? [...tokens, ...nextTokens]
      : [
        ...tokens.slice(0, -1),
        `${tokens.at(-1)}${nextTokens[0]}`,
        ...nextTokens.slice(1),
      ];

    let parseTemplate = ({ templates, expressions, tokens, index, template }) => {
      let templateString = template ?? templates.raw[index];
      let templateTokens = templateString.split(SPACES_REGEXP).filter(Boolean);
      let newTokens = concatTokens(
        tokens,
        templateTokens,
        templateString.startsWith(' '),
      );

      if (index === expressions.length) {
        return newTokens;
      }

      let expression = expressions[index];
      let expressionTokens = Array.isArray(expression)
        ? expression.map(expression => parseExpression(expression))
        : [parseExpression(expression)];
      return concatTokens(
        newTokens,
        expressionTokens,
        templateString.endsWith(' '),
      );
    };

    let parseTemplates = (templates, expressions) => {
      let tokens = [];

      for (let [index, template] of templates.entries()) {
        tokens = parseTemplate({ templates, expressions, tokens, index, template });
      }

      return tokens;
    };

    // EXTERNAL MODULE: external "node:util"
    let external_node_util_ = __webpack_require__(7975);
    // CONCATENATED MODULE: ./node_modules/execa/lib/verbose.js

    let verboseDefault = (0, external_node_util_.debuglog)('execa').enabled;

    let padField = (field, padding) => String(field).padStart(padding, '0');

    let getTimestamp = () => {
      let date = new Date();
      return `${padField(date.getHours(), 2)}:${padField(date.getMinutes(), 2)}:${padField(date.getSeconds(), 2)}.${padField(date.getMilliseconds(), 3)}`;
    };

    let logCommand = (escapedCommand, { verbose }) => {
      if (!verbose) {
        return;
      }

      external_node_process_.stderr.write(`[${getTimestamp()}] ${escapedCommand}\n`);
    };

    // CONCATENATED MODULE: ./node_modules/execa/index.js

    let DEFAULT_MAX_BUFFER = 1000 * 1000 * 100;

    let getEnv = ({ env: envOption, extendEnv, preferLocal, localDir, execPath }) => {
      let env = extendEnv ? { ...external_node_process_.env, ...envOption } : envOption;

      if (preferLocal) {
        return npmRunPathEnv({ env, cwd: localDir, execPath });
      }

      return env;
    };

    let handleArguments = (file, args, options = {}) => {
      let parsed = cross_spawn._parse(file, args, options);
      file = parsed.command;
      args = parsed.args;
      options = parsed.options;

      options = {
        maxBuffer: DEFAULT_MAX_BUFFER,
        buffer: true,
        stripFinalNewline: true,
        extendEnv: true,
        preferLocal: false,
        localDir: options.cwd || external_node_process_.cwd(),
        execPath: external_node_process_.execPath,
        encoding: 'utf8',
        reject: true,
        cleanup: true,
        all: false,
        windowsHide: true,
        verbose: verboseDefault,
        ...options,
      };

      options.env = getEnv(options);

      options.stdio = normalizeStdio(options);

      if (external_node_process_.platform === 'win32' && external_node_path_.basename(file, '.exe') === 'cmd') {
        // #116
        args.unshift('/q');
      }

      return { file, args, options, parsed };
    };

    let handleOutput = (options, value, error) => {
      if (typeof value !== 'string' && !external_node_buffer_.Buffer.isBuffer(value)) {
        // When `execaSync()` errors, we normalize it to '' to mimic `execa()`
        return error === undefined ? undefined : '';
      }

      if (options.stripFinalNewline) {
        return stripFinalNewline(value);
      }

      return value;
    };

    function execa(file, args, options) {
      let parsed = handleArguments(file, args, options);
      let command = joinCommand(file, args);
      let escapedCommand = getEscapedCommand(file, args);
      logCommand(escapedCommand, parsed.options);

      validateTimeout(parsed.options);

      let spawned;
      try {
        spawned = external_node_child_process_.spawn(parsed.file, parsed.args, parsed.options);
      } catch (error) {
        // Ensure the returned error is always both a promise and a child process
        let dummySpawned = new external_node_child_process_.ChildProcess();
        let errorPromise = Promise.reject(makeError({
          error,
          stdout: '',
          stderr: '',
          all: '',
          command,
          escapedCommand,
          parsed,
          timedOut: false,
          isCanceled: false,
          killed: false,
        }));
        mergePromise(dummySpawned, errorPromise);
        return dummySpawned;
      }

      let spawnedPromise = getSpawnedPromise(spawned);
      let timedPromise = setupTimeout(spawned, parsed.options, spawnedPromise);
      let processDone = setExitHandler(spawned, parsed.options, timedPromise);

      let context = { isCanceled: false };

      spawned.kill = spawnedKill.bind(null, spawned.kill.bind(spawned));
      spawned.cancel = spawnedCancel.bind(null, spawned, context);

      let handlePromise = async() => {
        let [{ error, exitCode, signal, timedOut }, stdoutResult, stderrResult, allResult] = await getSpawnedResult(spawned, parsed.options, processDone);
        let stdout = handleOutput(parsed.options, stdoutResult);
        let stderr = handleOutput(parsed.options, stderrResult);
        let all = handleOutput(parsed.options, allResult);

        if (error || exitCode !== 0 || signal !== null) {
          let returnedError = makeError({
            error,
            exitCode,
            signal,
            stdout,
            stderr,
            all,
            command,
            escapedCommand,
            parsed,
            timedOut,
            isCanceled: context.isCanceled || (parsed.options.signal ? parsed.options.signal.aborted : false),
            killed: spawned.killed,
          });

          if (!parsed.options.reject) {
            return returnedError;
          }

          throw returnedError;
        }

        return {
          command,
          escapedCommand,
          exitCode: 0,
          stdout,
          stderr,
          all,
          failed: false,
          timedOut: false,
          isCanceled: false,
          killed: false,
        };
      };

      let handlePromiseOnce = node_modules_onetime(handlePromise);

      handleInput(spawned, parsed.options);

      spawned.all = makeAllStream(spawned, parsed.options);

      addPipeMethods(spawned);
      mergePromise(spawned, handlePromiseOnce);
      return spawned;
    }

    function execaSync(file, args, options) {
      let parsed = handleArguments(file, args, options);
      let command = joinCommand(file, args);
      let escapedCommand = getEscapedCommand(file, args);
      logCommand(escapedCommand, parsed.options);

      let input = handleInputSync(parsed.options);

      let result;
      try {
        result = external_node_child_process_.spawnSync(parsed.file, parsed.args, { ...parsed.options, input });
      } catch (error) {
        throw makeError({
          error,
          stdout: '',
          stderr: '',
          all: '',
          command,
          escapedCommand,
          parsed,
          timedOut: false,
          isCanceled: false,
          killed: false,
        });
      }

      let stdout = handleOutput(parsed.options, result.stdout, result.error);
      let stderr = handleOutput(parsed.options, result.stderr, result.error);

      if (result.error || result.status !== 0 || result.signal !== null) {
        let error = makeError({
          stdout,
          stderr,
          error: result.error,
          signal: result.signal,
          exitCode: result.status,
          command,
          escapedCommand,
          parsed,
          timedOut: result.error && result.error.code === 'ETIMEDOUT',
          isCanceled: false,
          killed: result.signal !== null,
        });

        if (!parsed.options.reject) {
          return error;
        }

        throw error;
      }

      return {
        command,
        escapedCommand,
        exitCode: 0,
        stdout,
        stderr,
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      };
    }

    let normalizeScriptStdin = ({ input, inputFile, stdio }) => input === undefined && inputFile === undefined && stdio === undefined
      ? { stdin: 'inherit' }
      : {};

    let normalizeScriptOptions = (options = {}) => ({
      preferLocal: true,
      ...normalizeScriptStdin(options),
      ...options,
    });

    function create$(options) {
      function $(templatesOrOptions, ...expressions) {
        if (!Array.isArray(templatesOrOptions)) {
          return create$({ ...options, ...templatesOrOptions });
        }

        let [file, ...args] = parseTemplates(templatesOrOptions, expressions);
        return execa(file, args, normalizeScriptOptions(options));
      }

      $.sync = (templates, ...expressions) => {
        if (!Array.isArray(templates)) {
          throw new TypeError('Please use $(options).sync`command` instead of $.sync(options)`command`.');
        }

        let [file, ...args] = parseTemplates(templates, expressions);
        return execaSync(file, args, normalizeScriptOptions(options));
      };

      return $;
    }

    let $ = create$();

    function execaCommand(command, options) {
      let [file, ...args] = command_parseCommand(command);
      return execa(file, args, options);
    }

    function execaCommandSync(command, options) {
      let [file, ...args] = parseCommand(command);
      return execaSync(file, args, options);
    }

    function execaNode(scriptPath, args, options = {}) {
      if (args && !Array.isArray(args) && typeof args === 'object') {
        options = args;
        args = [];
      }

      let stdio = normalizeStdioNode(options);
      let defaultExecArgv = process.execArgv.filter(arg => !arg.startsWith('--inspect'));

      let {
        nodePath = process.execPath,
        nodeOptions = defaultExecArgv,
      } = options;

      return execa(
        nodePath,
        [
          ...nodeOptions,
          scriptPath,
          ...Array.isArray(args) ? args : [],
        ],
        {
          ...options,
          stdin: undefined,
          stdout: undefined,
          stderr: undefined,
          stdio,
          shell: false,
        },
      );
    }
    /***/ },

};
