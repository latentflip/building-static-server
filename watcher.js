var watch = require('node-watch');
var fs = require('fs');
var events = require('events');
var async = require('async');
var colors = require('colors');

var ignoreFiles = [
    /npm\-debug\.log/
];

module.exports = function (dir) {
    var emitter = new events.EventEmitter();
    var emitChange = function (f) {
        for (var i in ignoreFiles) {
            if (f.match(ignoreFiles[i])) { return; }
        }
        emitter.emit('log', 'changed: ' + f);
        emitter.emit('change', f);
    };

    emitter.emit('log', 'watching: ' + dir);
    watch(dir, { recursive: false }, emitChange);

    fs.readdir(dir, function (err, files) {
        if (err) { return emitter.emit('error', err); }

        async.each(files, function (f, done) {
            if (f.match(/node_modules/) || f.match(/.git/)) { return done(); }

            fs.stat(f, function (err, stat) {
                if (err) { return emitter.emit('error', err); }

                if (stat.isDirectory()) {
                    emitter.emit('log', 'debug', "watching: " + f.bold + " recursively");
                    watch(f, { recursive: true }, emitChange);
                }

                done();
            });
        }, function (err) {
            if (err) { return emitter.emit('error', err); }
            emitter.emit('ready');
        });
    });

    return emitter;
};
