var _ = require('lodash');
var utils = require('../utils');
var filters = require('../filters');

var commands = {};
exports.commands = commands;

commands.get = {
  name: 'get',
  usage: 'overcast instance get [instance|cluster|all] [attr...]',
  description: 'Returns the attribute(s) for the instance or cluster, one per line.',
  examples: [
    '$ overcast instance get app-01 ssh-port',
    '22',
    '',
    '$ overcast instance get app-cluster ip',
    '127.0.0.1',
    '127.0.0.2',
    '127.0.0.3'
  ],
  required: [
    { name: 'instance|cluster|all', varName: 'name', filters: filters.findMatchingInstances },
    { name: 'attr...', varName: 'attr', greedy: true }
  ],
  run: function (args) {
    args.attr = args.attr.split(' ');

    _.each(args.instances, function (instance) {
      _.each(args.attr, function (attr) {
        attr = attr.replace(/-/g, '_');
        if (instance[attr]) {
          console.log(instance[attr]);
        }
      });
    });
  }
};

commands.import = {
  name: 'import',
  usage: 'overcast instance import [name] [ip] [options...]',
  description: 'Imports an existing instance to a cluster.',
  examples: [
    '$ overcast instance import app.01 127.0.0.1 --cluster app \\',
    '    --ssh-port 22222 --ssh-key $HOME/.ssh/id_rsa'
  ],
  required: [
    { name: 'name', filters: filters.shouldBeNewInstance },
    { name: 'ip' }
  ],
  options: [
    { usage: '--cluster CLUSTER', default: 'default' },
    { usage: '--ssh-port PORT', default: '22' },
    { usage: '--ssh-key PATH', default: 'overcast.key' },
    { usage: '--user USERNAME', default: 'root' },
  ],
  run: function (args) {
    var clusters = utils.getClusters();

    clusters[args.cluster].instances[args.name] = {
      ip: args.ip,
      name: args.name,
      ssh_port: args['ssh-port'] || '22',
      ssh_key: args['ssh-key'] || 'overcast.key',
      user: args.user || 'root'
    };

    utils.saveClusters(clusters, function () {
      utils.success('Instance "' + args.name + '" (' + args.ip +
        ') has been imported to the "' + args.cluster + '" cluster.');
    });
  }
};

commands.list = {
  name: 'list',
  usage: 'overcast instance list [cluster...]',
  description: [
    'Returns all instance names, one per line.',
    'Optionally limit to one or more clusters.'
  ],
  examples: [
    '$ overcast instance list',
    '$ overcast instance list app-cluster db-cluster'
  ],
  run: function (args) {
    var clusters = utils.getClusters();
    var scope = (args._ && args._.length > 0) ? args._ : _.keys(clusters);

    _.each(clusters, function (cluster, clusterName) {
      if (_.indexOf(scope, clusterName) !== -1) {
        _.each(cluster.instances, function (instance) {
          console.log(instance.name);
        });
      }
    });
  }
};

commands.remove = {
  name: 'remove',
  usage: 'overcast instance remove [name]',
  description: [
    'Removes an instance from the index.',
    'The server itself is not affected by this action.'
  ],
  examples: [
    '$ overcast instance remove app-01'
  ],
  required: [{ name: 'name', filters: filters.findFirstMatchingInstance }],
  run: function (args) {
    utils.success('Instance "' + args.instance.name + '" removed.');
    utils.deleteInstance(args.instance);
  }
};

commands.update = {
  name: 'update',
  usage: 'overcast instance update [name] [options...]',
  description: [
    'Update any instance property. Specifying --cluster will move the instance',
    'to that cluster. Specifying --name will rename the instance.'
  ],
  examples: [
    '$ overcast instance update app.01 --user myuser --ssh-key /path/to/key'
  ],
  required: ['oldName'],
  options: [
    { usage: '--name NAME' },
    { usage: '--cluster CLUSTER' },
    { usage: '--ip IP' },
    { usage: '--ssh-port PORT' },
    { usage: '--ssh-key PATH' },
    { usage: '--user USERNAME' }
  ],
  run: function (args) {
    var clusters = utils.getClusters();

    if (!args.name) {
      args.name = args.oldName;
      args.oldName = null;
    }

    var instance = utils.findFirstMatchingInstance(args.oldName || args.name);
    var parentClusterName = utils.findClusterNameForInstance(instance);
    var messages = [];

    if (args.cluster) {
      if (!clusters[args.cluster]) {
        return utils.die('No "' + args.cluster + '" cluster found. Known clusters are: ' +
          _.keys(clusters).join(', ') + '.');
      }
      if (clusters[args.cluster].instances[instance.name]) {
        return utils.die('An instance named "' + instance.name + '" already exists in the "' + args.cluster + '" cluster.');
      }

      delete clusters[parentClusterName].instances[instance.name];
      clusters[args.cluster].instances[instance.name] = instance;
      parentClusterName = args.cluster;
      messages.push('Instance "' + instance.name + '" has been moved to the "' + args.cluster + '" cluster.');
    }

    if (args.oldName) {
      if (clusters[parentClusterName].instances[args.name]) {
        return utils.die('An instance named "' + args.name + '" already exists in the "' + parentClusterName + '" cluster.');
      }

      instance.name = args.name;
      delete clusters[parentClusterName].instances[args.oldName];
      clusters[parentClusterName].instances[args.name] = instance;
      messages.push('Instance "' + args.oldName + '" has been renamed to "' + args.name + '".');
    }

    _.each(['ip', 'ssh-key', 'ssh-port', 'user'], function (prop) {
      if (args[prop]) {
        clusters[parentClusterName].instances[instance.name][prop.replace('-', '_')] = args[prop];
        messages.push('Instance "' + prop + '" has been updated to "' + args[prop] + '".');
      }
    });

    utils.saveClusters(clusters, function () {
      _.each(messages, utils.success);
    });
  }
};
