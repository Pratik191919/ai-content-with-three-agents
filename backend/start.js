console.log('Starting all content agents and API in a single process (Memory Optimized)...');

// By requiring them directly, they all share a single Node.js instance and V8 engine.
// This reduces memory usage from ~700MB down to ~80MB, fitting perfectly in the Free Tier!

require('./api.js');
require('./agent_01_content_strategist.js');
require('./agent_02_blog_writer.js');
require('./agent_03_content_auditor.js');
require('./agent_seo.js');
require('./agent_internal_linking.js');
require('./agent_image.js');
require('./agent_publisher.js');
require('./agent_social.js');
require('./agent_translation.js');
require('./agent_repurposing.js');
require('./agent_trend.js');
require('./agent_fact_checking.js');
require('./agent_newsletter.js');
require('./agent_analytics.js');

console.log('All agents successfully loaded and running!');
