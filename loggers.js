var colors = require('colors');
var logger = {
    info: require('debug')('bss:info'),
    warn: require('debug')('bss:warn'),
    error: require('debug')('bss:error'),
    debug: require('debug')('bss:debug')
};

logger.warn.log = console.warn.bind(console);
logger.error.log = console.error.bind(console);

var _warn = logger.warn;
logger.warn = function () {
    var args = [].map.call(arguments, function (a) {
        if (a.toString()) { a = a.toString(); }

        if (typeof a === 'string') { a = a.magenta; }

        return a;
    });

    _warn.apply(logger, args);
};

module.exports = logger;
