var tinylr = require('tiny-lr');
var request = require('request');
var isTinylrRunning = require('./is-tinylr-running');
var LIVERELOAD_PORT = 35729;

var logger = require('./loggers');

var livereloadIsStarted = false;

module.exports.startServer = startLivereload;
module.exports.notify = function (filenames) {
    if (!Array.isArray(filenames)) { filenames = [filenames]; }
    startLivereload(function (err) {
        if (err) { throw err; }

        var url = 'http://localhost:' + LIVERELOAD_PORT + '/changed?files=' + filenames.join(',');
        logger.info("Notifying", url);
        request.get(url, function (err) {
            if (err) { logger.error(err); }
            logger.debug("Notified", url);
        });
    });
};


function startLivereload(done) {
    if (livereloadIsStarted) return done();

    isTinylrRunning(LIVERELOAD_PORT, function (err, running) {
        if (err) { return done(err); }
        if (running) { return done(); }

        var livereload = tinylr({
            liveCSS: true,
            liveJs: false,
            liveImg: true
        });

        try {
            livereload.listen(LIVERELOAD_PORT, function (err) {
                if (err) {
                    console.log(err);
                    return done(err);
                }
                livereloadIsStarted = true;
                logger.info("Livereload ready");
                done();
            });
        } catch (e) {
            done(e);
        }
    });
}
