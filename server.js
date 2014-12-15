var Firebase = require('firebase');
var marathon = require('marathon-node');

var root = new Firebase('https://flock-demo.firebaseio.com/');
root.on('child_added', function onchange(commit) {
    /**
    {
        "author": {...},
        "committer": {...},
        "distinct": true,
        "id": "1fb4bd6bd0967856c5260c34bc7ccb36482829db",
        "message": "...",
        "modified": [...],
        "timestamp": "2014-12-15T19:06:13+01:00",
        "url": "https://github.com/palmerabollo/flock-demo/commit/1fb4bd6bd0967856c5260c34bc7ccb36482829db"
    }
    */
    console.log('new commit %j', commit.val());

    // TODO deploy
    var app = {
        "container": {
            "type": "DOCKER",
            "docker": {
                "image": "dockerfile/nodejs"
            }
        },
        "id": "http-server",
        "instances": 1,
        "cpus": 0.1,
        "mem": 32,
        "uris": [],
        "cmd": "npm install http-server -g && http-server -p $PORT0",
        "ports": [ 0 ]
    };
    marathon('http://10.141.141.10:8080').apps.create(app, function oncreation(result) {
        console.log('app create %j', result);
    });
});
