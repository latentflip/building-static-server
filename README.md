# Building Static Server

* A static server that serves files in the current directory at a given port.
* That knows that you also have to build files, with maybe, Make.
* That will automatically just watch files for changes and rerun, Make/build step.
* That knows that when you refresh the browser, you'd rather wait for the current build to finish (if you change a file and quickly refresh) than be served old files.
* That knows that you like to use livereload.
* That doesn't care _how_ you build files\*, and doesn't take too much effort to setup.

\* Though you should probably just use make ;)

## Usage

```bash
building-static-server -p 3001 -s 'make'
```

* `-p` - port to start the server on
* `-s` - script to run, defaults to `npm run build` but you can use `make` or whatever

I typically do it like this:

```js
//package.json
{
    //...
    "devDependencies": {
        "building-static-server": "*"
    },
    "scripts": {
        "build": "make build",
        "start": "building-static-server -p 3001"
    }
    //...
}
```

Then I can just do `npm start` and things will start. It will watch all your files for changes and rebuild on them. (So you should make sure make is configured nicely to prevent excessive rebuilds).

Add the [chrome livereload extension](https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei?hl=en) for extra fun.
