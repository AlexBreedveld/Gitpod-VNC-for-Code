const {exec} = require('child_process');
const homedir = require('os').homedir();
const { writeFileSync } = require('fs');
const openvncscript = "#!/bin/bash\nif [ $(gp ports list | grep $1 | cut -d \"|\" -f 3 | grep \"open\" -c) == 1 ];then\n\texport GITPOD_URL_PROTOLESS=$(echo $GITPOD_WORKSPACE_URL | cut -d \"/\" -f 3)\n\texport VNC_URL=\"https://\"$1\"-\"$GITPOD_URL_PROTOLESS\"/vnc.html?autoconnect=true&reconnect=true&resize=remote\"\n\tif [ $2 == 0 ];then\n\t\tgp preview $VNC_URL\n\tfi\n\tif [ $2 == 1 ];then\n\t\tsensible-browser $VNC_URL\n\tfi\nelse\n\techo \"The VNC server is not running on port $1 or the Docker image wasn't initialized.\"\nfi";
console.log(openvncscript);
console.log(homedir);

writeFileSync(`${homedir}/.local/bin/open-vnc`, openvncscript);
exec(`chmod +x ${homedir}/.local/bin/open-vnc`);