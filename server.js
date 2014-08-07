var hapi = require('hapi');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var hoek = require('hoek');
var watchr = require('watchr');
var Runner = require('./runner');

//On change build, throttled by xms
//If change during build, rebuild
//On request
//  if clean build, and not building, serve
//  if building, wait till built

module.exports = function (options) {
    //TODO these should be in cli not here?
    var config = hoek.applyToDefaults({
        port: 3000,
        script: 'npm run build',
        cwd: process.cwd()
    }, options || {});

    var server = new hapi.Server('localhost', config.port);

    var lastRun;
    var running = false;
    var whenDone = [];
    var isClean = false;

    var runner = new Runner({
        cmd: function (done) {
            var args = config.script.split(' ');
            var cmd = args.shift();
            var ps = spawn(cmd, args, { stdio: 'inherit' });
            ps.on('close', done);
        }
    });

    var queueable = true;

    runner.on('run:start', function () { queueable = false; console.log('OFF'); })
          .on('run:end', function () { queueable = true;  console.log('ON'); });

    var queue = function (f) {
        if (queueable) {
            console.log('Updated', f);
            runner.queue();
        } else {
            console.log('Skipped', f);
        }
    };

    server.ext('onPreHandler', function (request, done) {
        runner.delayIfRunning(done);
    });

    server.route({
        path: '/{path*}',
        method: 'GET',
        handler: {
            directory: {
                path: config.cwd + '/'
            }
        }
    });

    watchr.watch({
        paths: [config.cwd],
        ignoreDotFiles: true,
        listener: queue,
        catchupDelay: 0,
        next: function (err) {
            if (err) throw err;
            server.start(function (err) {
                if (err) throw err;
                console.log('Started server on: ', server.info.uri);
            });
        }
    });
};
