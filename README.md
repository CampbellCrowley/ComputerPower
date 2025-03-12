# Updates for RPi 5

Install NodeJS from https://nodejs.org/en/download
Last tested v22.14.0

Install gpiod dependencies
`sudo apt install gpiod libgpiod2 libgpiod-dev libnode-dev`

Example start script:
```sh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
nvm use 22

killall autossh
# Start a reverse tunnel to the server with remote port 3141 to local port 8080
autossh -M 0 -f -N -R 3141:localhost:8080 \
  -o "ServerAliveInterval 60" \
  -o "ServerAliveCountMax 3" \
  -o "ExitOnForwardFailure=yes" \
  -o "StrictHostKeyChecking=no" \
  -o "UserKnownHostsFile=/dev/null" \
  -o "PasswordAuthentication=no" \
  -o "PubkeyAuthentication=yes" \
  -o "IdentityFile=/home/campbell/.ssh/id_rsa_nopass" \
  campbell@kamino1.campbellcrowley.com &

cd ~/ComputerPower
node index.js 8080 127.0.0.1
```
