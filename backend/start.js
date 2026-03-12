const { spawn } = require('child_process');

console.log('Starting all content agents and API...');

const runProcess = (scriptName) => {
    const child = spawn('node', [scriptName], { stdio: 'inherit' });
    
    child.on('error', (err) => {
        console.error(`Failed to start ${scriptName}:`, err);
    });
    
    child.on('exit', (code) => {
        console.log(`${scriptName} exited with code ${code}`);
    });
};

runProcess('api.js');
runProcess('agent_01_content_strategist.js');
runProcess('agent_02_blog_writer.js');
runProcess('agent_03_content_auditor.js');
