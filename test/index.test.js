// Mock the modules first
jest.mock('@actions/core');
jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}));
jest.mock('path');
jest.mock('glob');
jest.mock('js-yaml');

// Then import them
const core = require('@actions/core');
const fs = require('fs/promises');
const path = require('path');
const { glob } = require('glob');
const yaml = require('js-yaml');

// Import the function to test (we'll need to modify index.js to export functions)
const { extractRunsOn, run } = require('../index');

describe('Workflow Runner Analyzer', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();
    
    // Mock process.env.GITHUB_WORKSPACE
    process.env.GITHUB_WORKSPACE = '/github/workspace';
    
    // Mock path.join to return predictable paths
    path.join.mockImplementation((...args) => args.join('/'));
  });

  describe('extractRunsOn function', () => {
    test('extracts string runs-on value', () => {
      const workflow = {
        jobs: {
          build: {
            'runs-on': 'ubuntu-latest'
          }
        }
      };
      
      const runnerTags = [];
      extractRunsOn(workflow, runnerTags);
      
      expect(runnerTags).toEqual(['ubuntu-latest']);
    });

    test('extracts array runs-on value', () => {
      const workflow = {
        jobs: {
          build: {
            'runs-on': ['ubuntu-latest', 'windows-latest']
          }
        }
      };
      
      const runnerTags = [];
      extractRunsOn(workflow, runnerTags);
      
      expect(runnerTags).toEqual(['ubuntu-latest', 'windows-latest']);
    });

    test('extracts object runs-on value', () => {
      const runsOnObject = { group: 'ubuntu-group' };
      const workflow = {
        jobs: {
          build: {
            'runs-on': runsOnObject
          }
        }
      };
      
      const runnerTags = [];
      extractRunsOn(workflow, runnerTags);
      
      expect(runnerTags).toEqual([JSON.stringify(runsOnObject)]);
    });

    test('handles multiple jobs', () => {
      const workflow = {
        jobs: {
          build: {
            'runs-on': 'ubuntu-latest'
          },
          test: {
            'runs-on': 'windows-latest'
          }
        }
      };
      
      const runnerTags = [];
      extractRunsOn(workflow, runnerTags);
      
      expect(runnerTags).toEqual(['ubuntu-latest', 'windows-latest']);
    });

    test('handles undefined or null workflow', () => {
      const runnerTags = [];
      
      extractRunsOn(null, runnerTags);
      extractRunsOn(undefined, runnerTags);
      
      expect(runnerTags).toEqual([]);
    });
  });

  describe('run function', () => {
    test('processes workflow files and finds runner tags', async () => {
      // Mock glob to return workflow files
      glob.mockResolvedValue([
        '/github/workspace/.github/workflows/ci.yml',
        '/github/workspace/.github/workflows/release.yml'
      ]);
      
      // Mock file contents
      const ciWorkflow = {
        jobs: {
          test: { 'runs-on': 'ubuntu-latest' },
          build: { 'runs-on': 'self-hosted' }
        }
      };
      
      const releaseWorkflow = {
        jobs: {
          release: { 'runs-on': 'ubuntu-latest' }
        }
      };
      
      // Mock fs.readFile
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('ci.yml')) {
          return Promise.resolve('ci-workflow-content');
        } else if (filePath.includes('release.yml')) {
          return Promise.resolve('release-workflow-content');
        }
        return Promise.reject(new Error('Unexpected file'));
      });
      
      // Mock yaml.load to return the parsed workflow
      yaml.load.mockImplementation((content) => {
        if (content === 'ci-workflow-content') {
          return ciWorkflow;
        } else if (content === 'release-workflow-content') {
          return releaseWorkflow;
        }
        return {};
      });
      
      // Mock core.getInput to return allowed runners
      core.getInput.mockImplementation((name) => {
        if (name === 'allowed-runners') {
          return 'ubuntu-latest self-hosted';
        }
        return '';
      });
      
      // Run the function
      await run();
      
      // Verify output
      expect(core.setOutput).toHaveBeenCalledWith(
        'runner-tags', 
        JSON.stringify(['ubuntu-latest', 'self-hosted'])
      );
      
      // Verify no failures
      expect(core.setFailed).not.toHaveBeenCalled();
    });

    test('fails when disallowed runners are found', async () => {
      // Mock glob to return workflow files
      glob.mockResolvedValue(['/github/workspace/.github/workflows/ci.yml']);
      
      // Mock file contents
      const ciWorkflow = {
        jobs: {
          test: { 'runs-on': 'ubuntu-latest' },
          build: { 'runs-on': 'self-hosted' }
        }
      };
      
      // Mock fs.readFile
      fs.readFile.mockResolvedValue('ci-workflow-content');
      
      // Mock yaml.load
      yaml.load.mockReturnValue(ciWorkflow);
      
      // Mock core.getInput to return allowed runners
      core.getInput.mockReturnValue('ubuntu-latest');
      
      // Run the function
      await run();
      
      // Verify failure
      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Found disallowed runner tags: self-hosted')
      );
    });

    test('allows all runners when wildcard is used', async () => {
      // Mock glob to return workflow files
      glob.mockResolvedValue(['/github/workspace/.github/workflows/ci.yml']);
      
      // Mock file contents
      const ciWorkflow = {
        jobs: {
          test: { 'runs-on': 'ubuntu-latest' },
          build: { 'runs-on': 'self-hosted' }
        }
      };
      
      // Mock fs.readFile
      fs.readFile.mockResolvedValue('ci-workflow-content');
      
      // Mock yaml.load
      yaml.load.mockReturnValue(ciWorkflow);
      
      // Mock core.getInput to return wildcard
      core.getInput.mockReturnValue('*');
      
      // Run the function
      await run();
      
      // Verify no failures
      expect(core.setFailed).not.toHaveBeenCalled();
    });

    test('handles errors in file processing', async () => {
      // Mock glob to return workflow files
      glob.mockResolvedValue([
        '/github/workspace/.github/workflows/good.yml',
        '/github/workspace/.github/workflows/bad.yml'
      ]);
      
      // Mock file contents
      const goodWorkflow = {
        jobs: {
          test: { 'runs-on': 'ubuntu-latest' }
        }
      };
      
      // Mock fs.readFile to throw for the bad file
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('bad.yml')) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve('good-workflow-content');
      });
      
      // Mock yaml.load
      yaml.load.mockImplementation((content) => {
        if (content === 'good-workflow-content') {
          return goodWorkflow;
        }
        return {};
      });
      
      // Mock core.getInput
      core.getInput.mockReturnValue('ubuntu-latest');
      
      // Spy on console.log
      const consoleSpy = jest.spyOn(console, 'log');
      
      // Run the function
      await run();
      
      // Verify error was logged but didn't fail the action
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing file')
      );
      
      // Verify the action still completed successfully
      expect(core.setFailed).not.toHaveBeenCalled();
      
      // Restore console.log
      consoleSpy.mockRestore();
    });
  });
});
