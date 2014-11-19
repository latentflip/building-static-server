var request = require('request');

var makeError = function (code, msg) {
    var e = new Error(msg);
    e.code = code;
    return e;
};

module.exports = function tinyLrRunning(port, done) {
    request.get('http://localhost:35729', function (err, resp, body) {
        if (err) {
            if (err.code === 'ECONNREFUSED') { return done(null, false); }
            return done(err);
        }

        try {
            body = JSON.parse(body);
            if (body && body.tinylr === 'Welcome') { return done(null, true); }

            return done(makeError('LIVERELOAD_RUNNING', "Livereload is already running, please close it"));
        } catch (e) {
            return done(makeError('LIVERELOAD_RUNNING', "Livereload is already running, please close it"));
        }
    });
};
