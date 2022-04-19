/**
 * New version for publishing a new version of Qrvey Utils
 * 1- Publish the version with np
 * 2- Update the README.md doc with doxdox
 */

const fs = require('fs');
const util = require('util');
const childProcess = require('child_process');
const exec = util.promisify(childProcess.exec);
const spawn = childProcess.spawn;
const proc = require('process');
const readline = require("readline");
const { exit } = require('process');
const rl = readline.createInterface({
    input: proc.stdin,
    output: proc.stdout
});
const question = util.promisify(rl.question).bind(rl);


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

async function spawning(command, sArguments) {
    let newProcess;
    await new Promise(function (resolve, reject) {
        newProcess = spawn(command, sArguments, { shell: true });
        newProcess.stdout.on("data", data => {
            console.log(`stdout: ${data}`);
        });
        
        newProcess.stderr.on("data", data => {
            console.log(`stderr: ${data}`);
        });
        
        newProcess.on('error', (_error) => {
            newProcess.stdin.pause();
            newProcess.stdin.destroy();
            newProcess.stdout.pause();
            newProcess.stdout.destroy();
            newProcess.kill();
            reject();
        });
        
        newProcess.on("close", code => {
            newProcess.stdin.pause();
            newProcess.stdin.destroy();
            newProcess.stdout.pause();
            newProcess.stdout.destroy();
            newProcess.kill();
            if (code == '1') {
                reject();
            }
            resolve();
        });
    });
}

async function getPackageJson(settings) {
    console.log('==>>> Opening package.json file...');
    const packageJson = await fs.readFileSync(settings.packagePath, 'utf8');
    const packageObject = JSON.parse(packageJson);
    if (packageObject != null) {
        console.log(`**** The current version is ${packageObject.version}`);
        return packageObject.version;
    }
    return '';
}

async function getNewVersion() {
    console.log('==>>> Checking the new version provided...');
    let newVersion;
    const versionIndex = proc.argv.findIndex(function (argv) { return argv.includes('--np-new-version='); });
    if (versionIndex > -1) {
        const versionArg = proc.argv[versionIndex].split('--np-new-version=');
        newVersion = versionArg[1] == null || versionArg[1] === '' ? undefined : versionArg[1];
    }
    if (newVersion == null) {
        newVersion = question('No version provided. Type the new version: ');
    }
    console.log('**** Version to publish: ' + newVersion);
    return newVersion;
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

    console.log('==>>> Generating Build...');
    await execute('npm run build');
}

async function startPublishingVersion(settings) {
    await callingPublisher(settings);
}

async function callingPublisher(settings) {
    console.log('==>>> Calling Publisher');
    let anyBranch = '', tag = '';
    const anyBranchIndex = proc.argv.findIndex(function (argv) { return argv.includes('--np-any-branch='); });
    const tagIndex = proc.argv.findIndex(function (argv) { return argv.includes('--np-tag='); });
    if (anyBranchIndex > -1) {
        const anyBranchArg = proc.argv[anyBranchIndex].split('--np-any-branch=');
        anyBranch = anyBranchArg[1] == null || anyBranchArg[1] === '' ? '' : '--any-branch';
    }
    if (tagIndex > -1) {
        const tagArg = proc.argv[tagIndex].split('--np-tag=');
        tag = tagArg[1] == null || tagArg[1] === '' ? '' : proc.argv[tagIndex].replace('--np-tag=', '--tag=');
    }
    await spawning(`np ${settings.newVersion}`, [anyBranch, tag]);
}

async function startGeneratingDocs(settings) {
    console.log('==>>> Starting the Docs generation');

    await generatingDocument(settings);
    await changingVersion(settings);
    await pushingChanges(settings);
}

async function generatingDocument(settings) {
    console.log('==>>> Generating Document...');
    await execute(`doxdox './dist/**/*.js' --output ${settings.docsFileName} --ignore './dist/cjs/**/*.js' --package ${settings.packagePath} --layout markdown`);
}

async function changingVersion(settings) {
    console.log('==>>> Replacing the old version in the document');
    const doc = await fs.readFileSync(settings.docsPath, 'utf8');
    const replacedDoc = doc.replace(settings.currentVersion, settings.newVersion);
    await fs.writeFileSync(settings.docsPath, replacedDoc, 'utf8');
}

async function pushingChanges(settings) {
    console.log('==>>> Commiting and Pushing Docs changes...');

    const gitStdout = await execute('git rev-parse --abbrev-ref HEAD');
    console.log('gitStdout', gitStdout);
    await execute(`git add ${settings.docsPath}`);
    await execute(`git commit -m "📝 docs: Updated docs${settings.newVersion != null || settings.newVersion !== '' ? ' for ' + settings.newVersion : ''}"`);
    await execute(`git push -u origin ${gitStdout.stdout}`);
}

async function revertChanges(settings) {
    console.log('>>> Checking for modifications...');
    console.warn(`>>> Unstaging posible changes from ${settings.docsFileName} and ${settings.packageFileName} file`);
    await execute(`git restore --staged ${settings.docsPath} ${settings.packagePath}`);
    console.warn(`>>> Discarting posible changes of ${settings.docsFileName} and ${settings.packageFileName} file`);
    await execute(`git checkout -- ${settings.docsPath} ${settings.packagePath}`);
}

async function init() {
    let settings = {
        currentVersion: '',
        distPath: './dist',
        docsPath: './README.md',
        docsFileName: 'README.md',
        newVersion: undefined,
        nodeModulesPath: './node_modules',
        packageFileName: 'package.json',
        packageLockPath: './package-lock.json',
        packagePath: './package.json',
        
    };

    console.log('Welcome. The publishing operationg will begin.');
    try {
        settings["currentVersion"] = await getPackageJson(settings);
        settings["newVersion"] = await getNewVersion();

        await cleaningProject(settings);
        await buildingBundle(settings);
        await startGeneratingDocs(settings);
        await startPublishingVersion(settings);
        console.info('Finished Publishing');
    } catch (err) {
        console.error('Error: ', err);
        await revertChanges(settings);
    } finally {
        console.log('Execution finished');
        exit();
    }
}

init();
