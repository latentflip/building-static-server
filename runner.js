var util = require('util');
var EventEmitter = require('events').EventEmitter;
var debounce = require('lodash.debounce');

var Runner = function (options) {
    this.cmd = options.cmd;
    this._running = false;
    this.callbacks = [];
    throttleTime = options.throttleTime || 300;
    this._run = debounce(this._run.bind(this), throttleTime);
    EventEmitter.call(this);
};

util.inherits(Runner, EventEmitter);

Runner.prototype.runCallbacks = function () {
    var cbs = this.callbacks;
    this.callbacks = [];
    cbs.forEach(function (cb) { cb(); });
};

Runner.prototype.queue = function (done) {
    if (done) {
        this.callbacks.push(done);
    }

    if (!this._running) {
        this.emit('run:queued');
        this._running = true;
        this._run();
    }
};

Runner.prototype._run = function () {
    var self = this;
    this.emit('run:start');
    this.cmd(function () {
        self.emit('run:end');
        self._running = false;
        self.runCallbacks();
    });
};

Runner.prototype.delayIfRunning = function (done) {
    if (this._running) {
        this.callbacks.push(done.continue.bind(done));
    } else {
        done.continue();
    }
};

module.exports = Runner;
