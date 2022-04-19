/**
 * Script for cleaning the project from temporary files and building a new bundle
 * 1- Deleting some directories and files
 * 2- Installing dependencies
 * 3- Build a new bundle
 */

const util = require('util');
const childProcess = require('child_process');
const exec = util.promisify(childProcess.exec);
const { exit } = require('process');
 
async function execute(command) {
    console.log(command);
    const response = await exec(command);
    if (response.error != null) {
        throw new Error(response.error);
    }
    if (response.stderr != null && response.stderr !== '') {
        console.error(response.stderr);
    }
    if (response.stdout != null && response.stdout !== '') {
        console.log(response.stdout);
    }
    return response;
}

async function cleaningProject(settings) {
    console.log('==>>> Cleaning project...');
    await execute(`rm -f ${settings.packageLockPath}`);
    await execute(`rm -f -R ${settings.nodeModulesPath}`);
    await execute(`rm -f -R ${settings.distPath}`);
}

async function buildingBundle(_settings) {
    console.log('==>>> Installing Dependencies...');
    await execute('npm install');

    await execute('npm run build');
}

async function init() {
    console.log('Welcome.');
    let settings = {
        distPath: './dist',
        nodeModulesPath: './node_modules',
        packageLockPath: './package-lock.json',
    };

    try {
        await cleaningProject(settings);
        await buildingBundle(settings);
        console.info('Finished cleaning and installed dependencies');
    } catch (err) {
        console.error('Error: ', err);
    } finally {
        console.log('Execution finished');
        exit();
    }
}
 
init();
