var spawn = require('child_process').spawn;
var hoek = require('hoek');
var Runner = require('./runner');
var livereload = require('./lr-notify');
var path = require('path');
var uniq = require('lodash.uniq');
var bucker = require('bucker');
var colors = require('colors');
var fileWatcher = require('./watcher');

var LIVERELOADABLE_REGEX = /(css|html|js)$/;


module.exports.register = function (server, options, next) {
    var config = hoek.applyToDefaults({
        script: 'npm run build',
        cwd: process.cwd(),
        verbose: false
    }, options || {});

    var logger = bucker.createLogger({
        name: 'BSS',
        level: config.verbose ? 'debug' : 'info'
    });

    var lastRun;
    var running = false;
    var whenDone = [];
    var isClean = false;

    logger.debug('Initializing task runner');
    var runner = new Runner({
        cmd: function (done) {
            var args = config.script.split(' ');
            var cmd = args.shift();
            var ps = spawn(cmd, args);
            var err = '';
            ps.stderr.on('data', function (d) {
                d = d.toString();
                err += d;
            });
            ps.stdout.pipe(process.stdout);
            ps.on('close', function () {
                if (err.length > 0) {
                    if (err.match(/npm ERR!/)) {
                        err = err.substr(0, err.indexOf("npm ERR!"));
                    }

                    err.split('\n').map(function (line) {
                        if (line.trim().length > 0) {
                           logger.error(line.red);
                        }
                    });
                }
                done();
            });
        }
    });

    var queueable = true;
    var buildStart, toNotify = [];

    runner.on('run:start', function () { queueable = false; })
          .on('run:end', function () { queueable = true; })
          //For build timing
          .on('run:start', function () {
              logger.info('Build started');
              buildStart = Date.now();
          })
          .on('run:end', function () {
              logger.info('Built in', (Date.now() - buildStart)/1000 + 's');
          })
          .on('run:end', function () {
              try {
                  if (toNotify.length > 0) { livereload.notify(uniq(toNotify)); }
                  toNotify = [];
              } catch (e) {
                  logger.error('Error notifying live reload', e);
              }
          });

    var queue = function (changeType, f) {
        console.log("queued", changeType, f);
        var filename = path.basename(f);

        if (queueable) {
            logger.info(changeType, f);
            logger.debug("Got file change, queueing", changeType, f);
            runner.queue();
        } else {
            logger.debug("Got file change, but ignoring as not queueable", changeType, f);
        }
        if (filename.match(LIVERELOADABLE_REGEX)) {
            logger.debug("Adding", filename, "to livereload notify list");
            toNotify.push(filename);
        }
    };

    server.ext('onPreHandler', function (request, done) {
        runner.delayIfRunning(done);
    });

    try {
        logger.debug("Adding * path to hapi server");
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

    logger.debug('Creating file monitor for', config.cwd);

    var watcher = fileWatcher(process.cwd());

    watcher.on('error', function (err) {
        throw err;
    });

    watcher.on('log', function (level, msg) {
        logger[level](msg);
    });

    watcher.on('ready', function () {
        watcher.on('change', queue.bind(queue, 'changed'));

        logger.debug('Starting livereload server');
        livereload.startServer(function (err) {
            if (err) {
                logger.error('Error starting livereload server.'.red);
                logger.error('This is probably because you are running the livereload mac app.');
                logger.error('Please close it and try again.');
                logger.error("Full error: [" + err.code + "] " + err.message);
                process.exit();
            }

            logger.debug('Building static server plugin loaded');
            runner.queue();
            next();
        });
    });
};

module.exports.register.attributes = {
    pkg: require('./package.json')
};
