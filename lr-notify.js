var tinylr = require('tiny-lr');
var request = require('request');
var LIVERELOAD_PORT = 35729;

var livereloadIsStarted = false;

module.exports.startServer = startLivereload;
module.exports.notify = function (filenames) {
    if (!Array.isArray(filenames)) { filenames = [filenames]; }
    startLivereload(function (err) {
        if (err) { throw err; }

        var url = 'http://localhost:' + LIVERELOAD_PORT + '/changed?files=' + filenames.join(',');
        console.log('Notifying', url);
        request.get(url);
    });
};


function startLivereload(done) {
    if (livereloadIsStarted) return done();

    var livereload = tinylr();

    try {
        livereload.listen(LIVERELOAD_PORT, function (err) {
            if (err) {
                console.log(err);
                return done(err);
            }
            livereloadIsStarted = true;
            done();
        });
    } catch (err) {
        done(err);
    }
}
