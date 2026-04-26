const { spawn } = require('child_process');

console.log('Starting all content agents and API...');

const runProcess = (scriptName) => {
    const child = spawn('node', [scriptName], { stdio: 'inherit' });
    
    child.on('error', (err) => {
        console.error(`Failed to start ${scriptName}:`, err);
    });
    
    child.on('exit', (code) => {
        console.log(`${scriptName} exited with code ${code}`);
        if (code !== 0) {
            console.error(`Critical process ${scriptName} failed. Restarting...`);
            setTimeout(() => runProcess(scriptName), 5000);
        }
    });
};

runProcess('api.js');
runProcess('agent_01_content_strategist.js');
runProcess('agent_02_blog_writer.js');
runProcess('agent_03_content_auditor.js');
runProcess('agent_seo.js');
runProcess('agent_internal_linking.js');
runProcess('agent_image.js');
runProcess('agent_publisher.js');
runProcess('agent_social.js');
runProcess('agent_translation.js');
runProcess('agent_repurposing.js');
runProcess('agent_trend.js');
runProcess('agent_fact_checking.js');
runProcess('agent_newsletter.js');
runProcess('agent_analytics.js');
