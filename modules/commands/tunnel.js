var _ = require('lodash');
var utils = require('../utils');
var filters = require('../filters');

var commands = {};
exports.commands = commands;

commands.tunnel = {
  name: 'tunnel',
  usage: 'overcast tunnel [instance] [local-port((:hostname):remote-port)...]',
  description: [
    'Opens an SSH tunnel to the port(s) specified.',
    'If only one port is specified, assume the same port for local/remote.',
    'If no remote host is specified, assume the remote host itself (127.0.0.1).',
    'Multiple tunnels can be opened over a single connection.'
  ],
  examples: [
    '# Tunnel local 5984 to remote 5984',
    '$ overcast tunnel app-01 5984',
    '',
    '# Tunnel local 8000 to remote 5984, local 8001 to remote 3000',
    '$ overcast tunnel app-01 8000:5984 8001:3000',
    '',
    '# Tunnel local 3000 to otherhost.com:4000',
    '$ overcast tunnel app-01 3000:otherhost.com:4000'
  ],
  required: [
    { name: 'instance', varName: 'name', filters: filters.findFirstMatchingInstance },
    { name: 'local-port((:hostname):remote-port)...', varName: 'firstPort', raw: true }
  ],
  options: [
    { usage: '--user NAME' },
    { usage: '--ssh-key PATH' }
  ],
  run: function (args) {
    args._.unshift(args.firstPort);
    delete args.firstPort;

    connect(args.instance, args);
  }
};

function connect(instance, args) {
  var sshArgs = [
    'ssh',
    '-i',
    utils.normalizeKeyPath(args['ssh-key'] || instance.ssh_key || 'overcast.key'),
    '-p',
    (instance.ssh_port || '22'),
    '-o StrictHostKeyChecking=no'
  ];

  var ports = exports.normalizePorts(args._);
  _.each(ports, function (port) {
    sshArgs.push('-L ' + port.localPort + ':' + port.remoteHost + ':' + port.remotePort);
  });

  sshArgs.push((args.user || instance.user || 'root') + '@' + instance.ip);
  sshArgs.push('-N'); // Don't run a command.

  var ssh = utils.spawn(sshArgs);

  utils.grey(sshArgs.join(' '));

  _.each(ports, function (port) {
    utils.cyan('Tunneling from ' + port.localPort + ' to ' + port.remoteHost + ':' + port.remotePort + '.');
  });

  ssh.stdout.on('data', function (data) {
    utils.grey(data.toString());
  });

  ssh.stderr.on('data', function (data) {
    utils.grey(data.toString());
  });

  ssh.on('exit', function (code) {
    if (code !== 0) {
      utils.die('SSH connection exited with a non-zero code (' + code + '). Stopping execution...');
    }
    console.log('');
  });
}

exports.normalizePorts = function (arr) {
  var ports = [];

  _.each(arr, function (str) {
    str = (str + '').split(':');
    ports.push({
      localPort: str[0],
      remoteHost: str.length === 3 ? str[1] : '127.0.0.1',
      remotePort: str.length >= 2 ? _.last(str) : str[0]
    });
  });

  return ports;
};
