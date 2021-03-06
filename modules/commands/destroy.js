var utils = require('../utils');

exports.run = function (args) {
  utils.argShift(args, 'name');

  if (!args.name) {
    return utils.missingParameter('[instance]', exports.help);
  }

  var instance = utils.findFirstMatchingInstance(args.name);
  utils.handleInstanceNotFound(instance, args);

  var command;
  if (instance.aws) {
    command = require('./aws.js');
    args.command = 'aws';
  } else if (instance.digitalocean) {
    command = require('./digitalocean.js');
    args.command = 'digitalocean';
  } else if (instance.linode) {
    command = require('./linode.js');
    args.command = 'linode';
  } else {
    return utils.die('This instance doesn\'t belong to a recognized provider.');
  }

  args._.unshift(args.name);
  args._.unshift('destroy');
  command.run(args);
};

exports.signatures = function () {
  return [
    '  overcast destroy [name]'
  ];
};

exports.help = function () {
  utils.printArray([
    'overcast destroy [instance]',
    '  Destroy an instance using the provider API.'.grey,
    '',
    '    Option      | Default'.grey,
    '    --force     | false'.grey,
    '',
    '  Example:'.grey,
    '  $ overcast destroy app-01'.grey
  ]);
};
