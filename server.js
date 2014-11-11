var hapi = require('hapi');
var hoek = require('hoek');
var fs = require('fs');
var bucker = require('bucker');
var bssPlugin = require('./plugin');

module.exports = function (options) {
    var config = hoek.applyToDefaults({
        port: 3000,
        script: 'npm run build',
        cwd: process.cwd(),
        verbose: false
    }, options || {});

    var serverConfig = {};

    if (config.tls) {
      serverConfig.tls = {
        key: fs.readFileSync(__dirname + '/certs/server.key'),
        cert: fs.readFileSync(__dirname + '/certs/server.crt'),
        ca: fs.readFileSync(__dirname + '/certs/ca.crt'),
        passphrase: 'gulp'
      };
    }

    var logger = bucker.createLogger({
        name: 'BSS',
        level: config.verbose ? 'debug' : 'info'
    });

    logger.debug("Creating server", 'localhost:' + config.port, serverConfig);
    var server = new hapi.Server('localhost', config.port, serverConfig);

    logger.debug("Registering BSS plugin");
    server.pack.register({
        plugin: bssPlugin,
        options: options
    }, function (err) {
        if (err) {
            logger.error("Error loading plugin:", err);
            throw err;
        }

        logger.debug('Starting server');
        server.start(function (err) {
            if (err) {
                logger.error("Error starting server", err);
                throw err;
            }
            
            logger.info('Started server on: ', server.info.uri);
        });
    });

};
