var request = require('request'),
    Firebase = require('firebase'),
    Marathon = require('marathon.node');

// TODO read config from consul
var MARATHON_API = process.env.MARATHON_API || 'http://10.141.141.10:8080';
var CONSUL_NODE = process.env.CONSUL_NODE || '81.45.22.27:8500';
var DEFAULT_BRANCH = 'develop'; // TODO get branch from the commit information

// XXX using firebase only because it is a simple pubsub mechanism already integrated with github
var FIREBASE_ENDPOINT = process.env.FIREBASE_ENDPOINT || 'https://flock-demo.firebaseio.com/'

var root = new Firebase(FIREBASE_ENDPOINT);
root.limitToLast(1).on('child_added', function onchange(child) {
    /**
    {
        'author': {...},
        'committer': {...},
        'distinct': true,
        'id': '1fb4bd6bd0967856c5260c34bc7ccb36482829db',
        'message': '...',
        'modified': [...],
        'timestamp': '2014-12-15T19:06:13+01:00',
        'url': 'https://github.com/palmerabollo/flock-demo/commit/1fb4bd6bd0967856c5260c34bc7ccb36482829db'
    }
    */
    var commit = child.val();
    console.log('new commit %j', commit);

    getPackage(commit, function (err, package) {
        if (err) {
            return console.error('Not able to get the package.json file');
        }

        var app = buildApp(package);
        console.log('creating marathon app %j', app);

        var client = new Marathon({base_url: MARATHON_API});
        client.apps.create(app).then(function(res) {
            console.log(res);
        });
    });
});

function getPackage(commit, callback) {
    var parts = commit.url.split('/');
    var login = parts[3];
    var repository = parts[4];

    var packageUrl = 'https://raw.githubusercontent.com/' + login + '/' + repository + '/' + DEFAULT_BRANCH + '/package.json';
    console.log('download package.json from %s', packageUrl)

    request.get({url:packageUrl, json:true}, function onPackage(err, response, package) {
        // TODO handle error
        callback(err, package);
    })
}

function buildApp(package) {
    var moduleUrl = package.repository.url.replace(/git@(.*):/, 'git://$1/') + '#' + DEFAULT_BRANCH;

    // TODO move to a custom docker image (see flock-docker)
    var INSTALL_ENVCONSUL = 'cd /tmp && wget https://github.com/hashicorp/envconsul/releases/download/v0.3.0/envconsul_0.3.0_linux_amd64.tar.gz && tar xfz envconsul_0.3.0_linux_amd64.tar.gz && mv /tmp/envconsul_0.3.0_linux_amd64/envconsul /usr/local/bin && chmod +x /usr/local/bin/envconsul && rm -rf /tmp/envconsul*';
    var RUN_APP = 'npm install ' + moduleUrl + ' && cd node_modules && cd ' + package.name + ' && envconsul -consul=' + CONSUL_NODE + ' service/' + package.name + ' node server';

    var app = {
        'container': {
            'type': 'DOCKER',
            'docker': {
                'image': 'dockerfile/nodejs'
            }
        },
        'healthChecks': package.checks,
        'id': package.name + '-' + package.version,
        'instances': package.flock.instances,
        'cpus': package.flock.cpus,
        'mem': package.flock.mem,
        'uris': [],
        'cmd': INSTALL_ENVCONSUL + ' && ' + RUN_APP,
        'ports': [ 0 ]
    };

    return app;
}
