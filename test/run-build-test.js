var async = require('async');
var test = require('tape');
var Runner = require('../runner');

test('it will not rerun if already running', function (t) {
    var runCount = 0;

    var runner = new Runner({
        cmd: function (done) {
            runCount++;
            setTimeout(done, 500);
        }
    });

    async.parallel([
        runner.queue.bind(runner),
        runner.queue.bind(runner)
    ], function (done) {
        t.equal(runCount, 1);
        t.end();
    });
});

test('it will rerun if complete running', function (t) {
    var runCount = 0;

    var runner = new Runner({
        cmd: function (done) {
            runCount++;
            setTimeout(done, 500);
        }
    });

    async.series([
        runner.queue.bind(runner),
        runner.queue.bind(runner)
    ], function (done) {
        t.equal(runCount, 2);
        t.end();
    });
});

test('it will debounce', function (t) {
    var runCount = 0;

    var runner = new Runner({
        cmd: function (done) {
            runCount++;
            setTimeout(done, 500);
        }
    });

    async.parallel([
        runner.queue.bind(runner),
        runner.queue.bind(runner)
    ], function (done) {
        t.equal(runCount, 1);
        t.end();
    });
});

test('it will wait until the end of debouncing', function (t) {
    var runCount = 0;

    var runner = new Runner({
        cmd: function (done) {
            runCount++;
            setTimeout(done, 500);
        }
    });

    var start = Date.now();
    setTimeout(runner.queue.bind(runner), 0);
    setTimeout(runner.queue.bind(runner), 100);
    setTimeout(runner.queue.bind(runner), 200);
    setTimeout(runner.queue.bind(runner, function () {
        var end = Date.now();
        t.equal(runCount, 1);
        t.ok(end - start > 790);
        t.end();
    }), 300);
});

test('just runs the callback if not running', function (t) {
    t.plan(4);
    var runCount = 0;
    var runner = new Runner({
        cmd: function (done) {
            runCount++;
            setTimeout(done, 500);
        }
    });

    runner.delayIfRunning(function () {
        t.equal(runCount, 0);
        t.notOk(runner._running);

        runner.queue(function () {
            t.ok(true);
        });

        runner.delayIfRunning(function () {
            t.equal(runCount, 1);
        });
    });
});
