const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { glob } = require('glob');

/**
 * Extracts runs-on values from a workflow object
 * @param {Object} workflow - Parsed workflow YAML
 * @param {Array} runnerTags - Array to collect runner tags
 */
function extractRunsOn(workflow, runnerTags) {
    if (!workflow || typeof workflow !== 'object') return;

    // Check for jobs section
    if (workflow.jobs && typeof workflow.jobs === 'object') {
        // Iterate through each job
        for (const jobName in workflow.jobs) {
            const job = workflow.jobs[jobName];

            // Extract runs-on attribute
            if (job && job['runs-on']) {
                const runsOn = job['runs-on'];

                // Handle string value (single runner)
                if (typeof runsOn === 'string') {
                    runnerTags.push(runsOn);
                }
                // Handle array (multiple runners in a single job)
                else if (Array.isArray(runsOn)) {
                    runnerTags.push(...runsOn);
                }
                // Handle object (matrix configuration)
                else if (typeof runsOn === 'object') {
                    // For simplicity, we'll stringify the object
                    runnerTags.push(JSON.stringify(runsOn));
                }
            }
        }
    }
}

async function run() {
    try {
        const workflowsPath = path.join(process.env.GITHUB_WORKSPACE || '.', '.github', 'workflows');
        const allRunnerTags = [];

        // Find all YAML and YML files in the workflows directory
        const workflowFiles = await glob('**/*.{yml,yaml}', { cwd: workflowsPath, absolute: true });

        console.log(`Found ${workflowFiles.length} workflow files to analyze`);

        // Process each workflow file
        for (const file of workflowFiles) {
            try {
                const fileContent = fs.readFileSync(file, 'utf8');
                const workflow = yaml.load(fileContent);

                extractRunsOn(workflow, allRunnerTags);
            } catch (error) {
                console.log(`Error processing file ${file}: ${error.message}`);
                // Continue with other files
            }
        }

        // Get unique runner tags
        const uniqueRunnerTags = [...new Set(allRunnerTags)];

        // Output results
        console.log('Unique runner tags found:');
        console.log(uniqueRunnerTags);

        // Set output for use in other workflow steps
        core.setOutput('runner-tags', JSON.stringify(uniqueRunnerTags));

        // Read the allowed-runners input
        const allowedRunnersInput = core.getInput('allowed-runners');

        // Split by spaces to get array of allowed runners
        const allowedRunners = allowedRunnersInput.split(' ').filter(runner => runner.trim() !== '');

        console.log('Allowed runners:', allowedRunners);

        // Check if wildcard is included
        const wildcardAllowed = allowedRunners.includes('*');

        if (!wildcardAllowed) {
            // Find any disallowed runners
            const disallowedRunners = uniqueRunnerTags.filter(tag => !allowedRunners.includes(tag));

            if (disallowedRunners.length > 0) {
                core.setFailed(`Found disallowed runner tags: ${disallowedRunners.join(', ')}`);
                return;
            }
        }

        console.log('All runner tags are allowed');

    } catch (error) {
        core.setFailed(`Action failed with error: ${error.message}`);
    }
}

run();
