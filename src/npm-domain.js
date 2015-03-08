(function () {
  'use strict';

  let npm = require('npm');
  let domainName = 'brackets-npm-registry-domain';
  let domainManager = null;
  let Promise = require('bluebird');
  let request = require('request');

  let getExtensions = exports.getExtensions = function (callback) {

    let npmLoad = Promise.promisify(npm.load, npm);
    return npmLoad()
      .then(() => {
        // get all entries tagged 'brackets-extension'
        let npmSearch = Promise.promisify(npm.commands.search, npm.commands);
        return npmSearch(['brackets-extension'], true);
      })
      .then(searchResults => {
        // call view for all potential extensions
        let npmView = Promise.promisify(npm.commands.view, npm.commands);
        return Promise.all(Object.keys(searchResults).map(
          extensionId =>
            npmView([extensionId + '@latest'], true).then(result =>
              result[Object.keys(result)[0]]
            )
        ));
      })
      .then(viewResults => {
        // filter out those, which doesn't have brackets engine specified
        return viewResults.filter(result => result.engines && result.engines.brackets);
      })
      .then(extensionInfos => {
        // get download counts for the extensions
        let extensionIds = extensionInfos.map(i => i.name);
        let from = '2015-01-01';
        let to = new Date().toISOString().substring(0,10);
        return new Promise((resolve, reject) => {
          request(`https://api.npmjs.org/downloads/range/${from}:${to}/${extensionIds.join(',')}`, (error, response, body) => {

            if (error) {
              return reject(error);
            }

            if (response.statusCode !== 200) {
              return reject(body);
            }

            if (typeof body === 'string') {
              try {
                body = JSON.parse(body);
              } catch (err) {
                return reject(err);
              }
            }

            if (extensionIds.length === 1) {
              extensionInfos[0].downloads = body.downloads;
            } else {
              extensionInfos.forEach(extensionInfo => {
                extensionInfo.downloads = body[extensionInfo.name].downloads;
              });
            }

            resolve(extensionInfos);

          });
        });
      })
      .nodeify(callback);

  };

  exports.init = function (_domainManager) {
    domainManager = _domainManager;

    if (!domainManager.hasDomain(domainName)) {
      domainManager.registerDomain(domainName, {major: 0, minor: 1});
    }

    domainManager.registerCommand(
      domainName,
      'getExtensions', // command name
      getExtensions, // handler function
      true, // is async
      'get a list of extensions from npm', // description
      [
        {name: 'extensions', type: 'array'}
      ]
    );
  };

}());