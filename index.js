// Campbell Crowley (web@campbellcrowley.com)
// March 2021
const PowerServer = require('./src/PowerServer.js');
const PowerController = require('./src/PowerController.js');

if (require.main === module) {
  console.log('Starting via CLI, booting up...');
  const args = process.argv.slice(2);
  const port = args[0];
  const address = args[1];
  const controller = new PowerServer(port, address);

  const sigintHandler = () => {
    controller.shutdown();
    process.off('SIGINT', sigintHandler);
  };

  process.on('SIGINT', sigintHandler);

  controller.start();
}
module.exports = {
  PowerServer,
  PowerController
};
