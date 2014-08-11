#!/usr/bin/env node
var server = require('./server');
var path = require('path');

var argv = require('yargs')
            .usage('Usage: $0 -p [port]')
            .alias('p', 'port')
                .default('p', 3000)
                .describe('p', 'Port to serve files at')
            .alias('s', 'script')
                .default('s', 'npm run build')
                .describe('s', 'Build script to run')
            .alias('d', 'cwd')
                .default('d', '.')
                .describe('d', 'Directory to serve')
            .alias('h', 'help')
            .help('h')
            .argv;

server({
    port: argv.p,
    script: argv.s,
    cwd: path.join(process.cwd(), argv.d)
});
