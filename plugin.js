var hapi = require('hapi');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var hoek = require('hoek');
var watchr = require('watchr');
var Runner = require('./runner');
var livereload = require('./lr-notify');
var path = require('path');
var uniq = require('lodash.uniq');

//On change build, throttled by xms
//If change during build, rebuild
//On request
//  if clean build, and not building, serve
//  if building, wait till built
var LIVERELOADABLE_REGEX = /(css|html|js)$/;

module.exports.register = function (plugin, options, next) {
    console.log('Requiring');
    var server = plugin;

    //TODO these should be in cli not here?
    var config = hoek.applyToDefaults({
        port: 3000,
        script: 'npm run build',
        cwd: process.cwd()
    }, options || {});


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
    var buildStart, toNotify = [];

    runner.on('run:start', function () { queueable = false; })
          .on('run:end', function () { queueable = true; })
          //For build timing
          .on('run:start', function () {
              console.log('Build started');
              buildStart = Date.now();
          })
          .on('run:end', function () {
              console.log('Built in', (Date.now() - buildStart)/1000 + 's');
          })
          //For build timing
          .on('run:start', function () { })
          .on('run:end', function () {
              try {
                  if (toNotify.length > 0) { livereload.notify(uniq(toNotify)); }
                  toNotify = [];
              } catch (e) {
                  console.log(e);
              }
          });

    var queue = function (changeType, f) {
        var filename = path.basename(f);

        if (queueable) {
            console.log(changeType, f);
            runner.queue();
        }
        if (filename.match(LIVERELOADABLE_REGEX)) {
            toNotify.push(filename);
        }
    };

    server.ext('onPreHandler', function (request, done) {
        runner.delayIfRunning(done);
    });

    try {
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
        console.log('Already /{path*}');
    }

    watchr.watch({
        paths: [config.cwd],
        ignoreDotFiles: true,
        listener: queue,
        catchupDelay: 0,
        next: function (err) {
            if (err) {
                console.log(err);
                throw err;
            }
            //server.start(function (err) {
            //    if (err) throw err;
            //    console.log('Started server on: ', server.info.uri);
            //});

            livereload.startServer(function (err) {
                if (err) {
                    console.log(err);
                    throw err;
                }
                next();
            });
        }
    });
};

module.exports.register.attributes = {
    pkg: require('./package.json')
};

//var server = new hapi.Server('localhost', 3000);
//
//server.route({
//    method: 'get',
//    path: '/foo',
//    handler: function (req, rep) {
//        rep('<!doctype html><link href="foo.css" rel="stylesheet"/>Hi!');
//    }
//});
//
//server.pack.register([module.exports], function (err) {
//    if (err) throw err;
//
//    console.log('Required plugins');
//
//    server.start(function (err) {
//        if (err) throw err;
//        console.log("Started server at", server.info.uri);
//    });
//});
