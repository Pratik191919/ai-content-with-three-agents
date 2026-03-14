const { spawn } = require('child_process');

console.log('Starting all content agents and API...');

const runProcess = (scriptName) => {
    const child = spawn('node', [scriptName], { stdio: 'inherit' });
    
    child.on('error', (err) => {
        console.error(`Failed to start ${scriptName}:`, err);
    });
    
    child.on('exit', (code) => {
        console.log(`${scriptName} exited with code ${code}`);
        if (scriptName === 'api.js' && code !== 0) {
            console.error('Critical process api.js failed. Restarting...');
            setTimeout(() => runProcess(scriptName), 5000);
        }
    });
};

runProcess('api.js');
runProcess('agent_01_content_strategist.js');
runProcess('agent_02_blog_writer.js');
runProcess('agent_03_content_auditor.js');
