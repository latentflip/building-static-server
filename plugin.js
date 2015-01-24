var spawn = require('child_process').spawn;
var hoek = require('hoek');
var Runner = require('./runner');
var path = require('path');
var uniq = require('lodash.uniq');
var colors = require('colors');
var fileWatcher = require('./watcher');
var fs = require('fs');
var sculpt = require('sculpt');


var timestamps = {};

// If no files have ever been requested
//   then we can't know which ones to livereload, so reload index.html
// If files have been requested
//   then we know that only files which have ever been requested are worth live reloading
//   we can also map changed files -> live reloaded files, so that we can pre-notify itcn tthe future


// Run build once
// When done, start server
// Watch files
//      When a file changes
//          Debounce a little
//          Start the build
//          When build is complete
//              Trigger livereload with the files that changed during the build
//              Store last build complete time
//              Relase lock on file loading
//      When a file changes
//          If it was last changed before the last build ended, trigger a livereload for it
//          Otherwise do the other stuff

var LIVERELOADABLE_REGEX = /(css|html|js)$/;
var EXTRA_LIVERELOAD_MAP = {};
EXTRA_LIVERELOAD_MAP[/jade$/] = 'index.html';

module.exports.register = function (server, options, next) {
    var config = hoek.applyToDefaults({
        script: 'npm run build',
        cwd: process.cwd(),
        verbose: false
    }, options || {});

    if (options.verbose) {
        process.env.DEBUG = "bss:*," + (process.env.DEBUG || "");
    } else {
        process.env.DEBUG = "bss:info,bss:warn,bss:error," + (process.env.DEBUG || "");
    }

    var debugPlugin   = require('debug')('bss:plugin');
    var debugRunner   = require('debug')('bss:runner');
    var debugWatcher  = require('debug')('bss:watch ');
    var debugNotifier = require('debug')('bss:notify');
    var debugReload   = require('debug')('bss:reload');

    var livereload = require('./lr-notify');
    var logger = require('./loggers');

    var filesRequested = {};
    var filesLivereloaded = {};
    var buildLock = false;
    var lastBuildEnd = 0;

    var buildStatus;

    var resetBuildStatus = function () {
        buildStatus = {
            filesReloaded: {
            }
        };
    };
    resetBuildStatus();

    debugRunner("starting");
    var runner = new Runner({
        cmd: function (done) {
            debugRunner("spawning command");
            var args = config.script.split(' ');
            var cmd = args.shift();
            var ps = spawn(cmd, args);
            var err = '';

            ps.stderr.on('data', function (d) {
                d = d.toString();
                err += d;
            });

            ps.stdout.pipe(sculpt.split('\n'))
                     .pipe(sculpt.prepend('    '))
                     .pipe(sculpt.append('\n'))
                     .pipe(process.stdout);

            ps.on('close', function () {

                if (err.length > 0) {
                    debugRunner("command complete with errors");
                    if (err.match(/npm ERR!/)) {
                        err = err.substr(0, err.indexOf("npm ERR!"));
                    }

                    err.split('\n').map(function (line) {
                        if (line.trim().length > 0) {
                           logger.error(line.red);
                        }
                    });
                } else {
                    debugRunner("command complete");
                }
                done();
            });
        }
    });

    var notifyFile = function(file) {
        file = path.basename(file);

        if (Object.keys(filesRequested).length === 0) {
            debugNotifier('No files requested yet, triggering full refresh');
            file = 'index.html';
        }

        if (file.match(/css$/) && !filesRequested[file]) {
            return debugNotifier('File ' + file + ' has never been loaded, skipping');
        }

        if (buildStatus.filesReloaded[file]) {
            return debugNotifier('File ' + file + ' already reloaded');
        }

        if (file.match(LIVERELOADABLE_REGEX)) {
            logger.info('Live reloading: ' + file);
            debugNotifier('Live reloading: ' + file);
            buildStatus.filesReloaded[file] = true;
            filesLivereloaded[file] = true;
            livereload.notify(file);
            return;
        }

        debugNotifier('Checking ' + file + ' against extra livereload config');
        Object.keys(EXTRA_LIVERELOAD_MAP).forEach(function (key) {
            var reloadFile = EXTRA_LIVERELOAD_MAP[key];
            var regex = new RegExp(key.slice(1,-1));
            if (file.match(regex)) {
                debugNotifier(file + ' matches ' + regex + ': reloading ' + reloadFile);
                notifyFile(reloadFile);
            } else {
                debugNotifier(file + ' does not match ' + regex);
            }
        });

    };

    var buildStart;

    runner.on('run:start', function () { buildLock = true; })
          .on('run:end', function () { buildLock = false; })
          //For build timing
          .on('run:queued', function () {
              logger.info('Build queued');
              debugRunner('vvvvvvvvv queued new build vvvvvvvv');
              resetBuildStatus();
              buildStart = Date.now();
          })
          .on('run:start', function () {
              logger.info('Build started');
              debugRunner('---------- started build ---------');

          })
          .on('run:end', function () {
              var runTime = Date.now() - buildStart;
              var runTimeS = (runTime/1000).toString().substr(0,5) + 's';
              logger.info('Built in', runTimeS);
              debugRunner('^^^^^^^^^ build ran in ' + runTimeS + ' ^^^^^^^^');
              lastBuildEnd = Date.now();
          });

    var handleChangedFile = function (changeType, f) {
        debugWatcher(changeType + ': ' + f);
        if (buildLock) {
            debugWatcher('build already running');
        } else {
            isFileOlderThan(f, lastBuildEnd, function (err, older) {
                if (err) { console.error(err); }

                if (older) {
                    debugWatcher(f + ' was from previous build, notifying');
                    notifyFile(f);
                } else {
                    runner.queue();
                    notifyFile(f);
                }
            });
        }
    };

    server.ext('onPreHandler', function (request, done) {
        runner.delayIfRunning(done);
    });

    try {
        debugPlugin("Adding * path to hapi server");
        server.route({
            path: '/{path*}',
            method: 'GET',
            handler: {
                directory: {
                    path: config.cwd + '/'
                }
            }
        });
    } catch (e) {
        logger.warn('Hapi server already has a /{path*}, ignoring');
    }

    server.on('response', function (resp) {
        var basename = path.basename(resp.path);
        if (buildStatus.filesReloaded[basename]) {
            debugReload(basename + " reloaded in " + (Date.now() - buildStart)/1000 + 's since build start');
            logger.info(basename + " reloaded in " + (Date.now() - buildStart)/1000 + 's (since build start)');
        }
        if (basename.match(LIVERELOADABLE_REGEX)) {
            filesRequested[basename] = true;
        }
    });

    var watcher = fileWatcher(process.cwd());

    watcher.on('error', function (err) {
        throw err;
    });

    watcher.on('log', function (msg) {
        debugWatcher(msg);
    });

    watcher.on('ready', function () {
        watcher.on('change', handleChangedFile.bind(handleChangedFile, 'changed'));

        debugReload('Starting livereload server');
        livereload.startServer(function (err) {
            if (err) {
                logger.error('Error starting livereload server.'.red);
                logger.error('This is probably because you are running the livereload mac app.');
                logger.error('Please close it and try again.');
                logger.error("Full error: [" + err.code + "] " + err.message);
                process.exit();
            }

            debugPlugin('Building static server plugin loaded');
            runner.queue();
            runner.once('run:end', next);
        });
    });
};

module.exports.register.attributes = {
    pkg: require('./package.json')
};

function isFileOlderThan(f, timestamp, done) {
    fs.stat(f, function (err, stat) {
        if (err) { return done(err); }
        return done(null, stat.mtime < timestamp);
    });
}
