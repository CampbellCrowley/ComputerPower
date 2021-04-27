// Campbell Crowley (web@campbellcrowley.com)
// March 2021
const AuthServer = require('./src/AuthServer.js');
const Authenticator = require('./src/Authenticator.js');

if (require.main === module) {
  console.log('Starting Authentication Server via CLI, booting up...');
  const args = process.argv.slice(2);
  const port = args[0];
  const address = args[1];
  const server = new AuthServer(port, address);

  const sigintHandler = () => {
    server.shutdown();
    process.off('SIGINT', sigintHandler);
  };

  process.on('SIGINT', sigintHandler);

  server.start();
}
module.exports = {
  AuthServer,
  Authenticator,
};
