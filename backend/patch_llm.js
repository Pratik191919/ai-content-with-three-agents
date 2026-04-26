const fs = require('fs');
const files = [
    'agent_01_content_strategist.js', 'agent_02_blog_writer.js', 'agent_03_content_auditor.js',
    'agent_analytics.js', 'agent_fact_checking.js', 'agent_newsletter.js', 'agent_repurposing.js',
    'agent_seo.js', 'agent_social.js', 'agent_translation.js'
];

for (const f of files) {
    if (!fs.existsSync(f)) continue;
    let content = fs.readFileSync(f, 'utf8');
    
    // Replace duplicate let
    content = content.replace(/let finalHtml;\s*let finalHtml;/g, 'let finalHtml;');
    content = content.replace(/let lastTitles = \[\];\s*let lastTitles = \[\];/g, 'let lastTitles = [];');
    
    // Convert direct groq calls to llm_helper
    const regex = /const\s+completion\s*=\s*await\s+groq\.chat\.completions\.create\(\{\s*model:\s*'[^']+',\s*messages:\s*\[\{\s*role:\s*'user',\s*content:\s*(.*?)\s*\}\],\s*temperature:\s*([0-9.]+)\s*\}\);\s*(?:const|let)\s+([a-zA-Z0-9_]+)\s*=\s*completion\.choices\[0\]\.message\.content/gs;
    
    content = content.replace(regex, (match, promptVar, temp, resultVar) => {
        return `const { generateWithFallback } = require('./llm_helper');
        const ${resultVar} = await generateWithFallback(${promptVar}, ${temp})`;
    });

    // Remove !groq early returns
    content = content.replace(/if \(!supabase \|\| !groq\) return;/g, 'if (!supabase) return;');
    content = content.replace(/if \(!groq\) throw new Error\('GROQ_API_KEY is missing.'\);/g, '');

    fs.writeFileSync(f, content);
    console.log('Patched', f);
}
