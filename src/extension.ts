"use strict";

import { exec, spawn } from "child_process";
const homedir = require('os').homedir();
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
// let fs = require("fs");
import { basename, dirname, extname } from "path";
import { fstat, readFileSync, stat, writeFileSync } from 'fs';
const sleep = require('sleep-promise');
import {
  commands,
  Disposable,
  env,
  ExtensionContext,
  extensions,
  ProgressLocation,
  Uri,
  window,
  workspace,
  TextDocument
} from "vscode";

const openvncscript = "#!/bin/bash\nif [ $(gp ports list | grep $1 | cut -d \"|\" -f 3 | grep \"open\" -c) == 1 ];then\n\texport GITPOD_URL_PROTOLESS=$(echo $GITPOD_WORKSPACE_URL | cut -d \"/\" -f 3)\n\texport VNC_URL=\"https://\"$1\"-\"$GITPOD_URL_PROTOLESS\"/vnc.html?autoconnect=true&reconnect=true&resize=remote\"\n\tif [ $2 == 0 ];then\n\t\tgp preview $VNC_URL\n\tfi\n\tif [ $2 == 1 ];then\n\t\tsensible-browser $VNC_URL\n\tfi\nelse\n\techo \"The VNC server is not running on port $1 or the Docker container wasn't initialized.\"\nfi";

var init = false;

const extensionId = "al3xdev.gitpod-vnc";

/*
export class Container {
  private static _extContext: ExtensionContext;
  
  public static get context(): ExtensionContext {
    return this._extContext;
  }

  public static set context(ec: ExtensionContext) {
    this._extContext = ec;
  }
}
*/

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  if (!init) {
    init = true;
  }
  
  //Container.context = context;

  writeFileSync(`${homedir}/.local/bin/open-vnc`, openvncscript);

  exec(`chmod +x ${homedir}/.local/bin/open-vnc`);
  exec(`mkdir -p ${homedir}/.config/gitpod-vnc/`);

  // rest of code
  // Step: If simple commands then add to this array

  let disposableCommandsArray: Disposable[] = [];
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json

  let disposableVNC = commands.registerCommand(
    "GitpodVNC.openVNC",
    () => {
      const config = workspace.getConfiguration("GitpodVNC");
      const port = config.get<Number>("vncPort");
      const newWindow = config.get<Boolean>("newWindow");

      if(port === null || port === undefined){
        window.showErrorMessage("The port configured in VS Code is invalid.");
      } else {
        if(newWindow === true){
          exec(`open-vnc ${port} 1`, (error, stdout, stderr) => {
            if (error) {
                window.showErrorMessage(`${error.message}`);
                return;
            }
            if (stderr) {
                window.showErrorMessage(`${stderr}`);
                return;
            }
            if (stdout === null || stdout === null || stdout.trimEnd() === ""){
              window.showInformationMessage(`Opening noVNC on port ${port}`);
            } else {
              window.showErrorMessage(`${stdout}`);
            }
        });
        } else {
          exec(`open-vnc ${port} 0`, (error, stdout, stderr) => {
            if (error) {
                window.showErrorMessage(`${error.message}`);
                return;
            }
            if (stderr) {
                window.showErrorMessage(`${stderr}`);
                return;
            }
            if (stdout === null || stdout === null || stdout.trimEnd() === ""){
              window.showInformationMessage(`Opening noVNC on port ${port}`);
            } else {
              window.showErrorMessage(`${stdout}`);
            }
        });
        }
      }
    }
  );

  let disposableStartVNC = commands.registerCommand(
    "GitpodVNC.startVNC",
    () => {
      window.withProgress({
        location: ProgressLocation.Notification,
        cancellable: false,
        title: 'Initializing Desktop'
    }, async (progress) => {
        
        progress.report({  message: `Starting session and VNC server` });
    
        await exec("gp-vncsession");
        await Promise.resolve();
    
        progress.report({ increment: 100 });
        window.showInformationMessage("Started Desktop Environment.");
    });
    }
  );

  let disposableStopVNC = commands.registerCommand(
    "GitpodVNC.stopVNC",
    () => {
      window.withProgress({
        location: ProgressLocation.Notification,
        cancellable: false,
        title: 'Stopping Desktop'
    }, async (progress) => {
        
        progress.report({  message: `Stopping session and VNC server` });
    
        await exec("vncserver -kill");
        await exec("ps -A -o pid,cmd | grep \"novnc_proxy\" | grep -v grep | head -n 1 | awk '{print $1}' | xargs kill");
        await Promise.resolve();
    
        progress.report({ increment: 100 });
        window.showInformationMessage("Stopped Desktop Environment.");
    });
    }
  );

  // Adding 1) to a list of disposables which are disposed when this extension is deactivated

  disposableCommandsArray.forEach((i) => {
    context.subscriptions.push(i);
  });

  checkVnc();

  // Adding 2) to a list of disposables which are disposed when this extension is deactivated

  context.subscriptions.push(disposableVNC);
  context.subscriptions.push(disposableStartVNC);
  context.subscriptions.push(disposableStopVNC);

  //also update userButton in package.json.. see "Adding new userButtons" in help.md file
}

async function recursevnc() {
  await sleep('2000');
  checkVnc();
}

async function checkVnc() {
  const config = workspace.getConfiguration("GitpodVNC");
  const port = config.get<Number>("vncPort");
  const workspacedir = String(workspace.getWorkspaceFolder);
  await exec(`gp ports list | grep ${port} | cut -d "|" -f 3 | grep "open" -c > ${homedir}/.config/gitpod-vnc/.port`);
  await exec(`cat $GITPOD_REPO_ROOT/.gitpod.Dockerfile | grep "gitpod/workspace-full-vnc" -c > ${homedir}/.config/gitpod-vnc/.docker`);
  await exec(`cat $GITPOD_REPO_ROOT/.gitpod.yml | grep ".gitpod.Dockerfile" -c > ${homedir}/.config/gitpod-vnc/.gitpodyml`);
  var isdocker = Number(readFileSync(`${homedir}/.config/gitpod-vnc/.docker`, 'utf-8'));
  var isgitpodtsk = Number(readFileSync(`${homedir}/.config/gitpod-vnc/.gitpodyml`, 'utf-8'));
  var isport = Number(readFileSync(`${homedir}/.config/gitpod-vnc/.port`, 'utf-8'));

  if(isdocker === 1 && isgitpodtsk === 1){
    if(isport === 0){
      config.update("openVNC", false);
      config.update("startVNC", true);
      config.update("stopVNC", false);
    } else {
      config.update("openVNC", true);
      config.update("startVNC", false);
      config.update("stopVNC", true);
    }
  } else {
    config.update("openVNC", false);
    config.update("startVNC", false);
    config.update("stopVNC", false);
  }
  recursevnc();
} 

// this method is called when your extension is deactivated
export function deactivate() {}