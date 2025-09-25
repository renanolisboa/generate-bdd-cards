#!/usr/bin/env tsx

import { config } from 'dotenv';
import axios from 'axios';
import { Logger } from './utils/logger.js';

// Load environment variables
config();

const logger = Logger.getInstance();
logger.setVerbose(true);

async function diagnoseGepetoAPI() {
  logger.info('\n🔍 Diagnosing Gepeto API...');
  logger.info('-'.repeat(40));
  
  const gepetoConfig = {
    baseUrl: process.env.GEPETO_API_BASE || 'https://gepeto.svc.in.devneon.com.br/api/',
    apiKey: process.env.GEPETO_API_KEY || '',
    model: process.env.GEPETO_MODEL || 'gpt-5',
    endpoint: process.env.GEPETO_ENDPOINT || 'chat/completions',
  };
  
  logger.info(`Base URL: ${gepetoConfig.baseUrl}`);
  logger.info(`API Key: ${gepetoConfig.apiKey ? '***' + gepetoConfig.apiKey.slice(-4) : 'NOT SET'}`);
  logger.info(`Model: ${gepetoConfig.model}`);
  logger.info(`Endpoint: ${gepetoConfig.endpoint}`);
  
  const fullUrl = `${gepetoConfig.baseUrl}${gepetoConfig.endpoint}`;
  logger.info(`Full URL: ${fullUrl}`);
  
  try {
    // Test basic connectivity
    logger.info('\nTesting basic connectivity...');
    const response = await axios.get(gepetoConfig.baseUrl, { timeout: 5000 });
    logger.success(`✅ Base URL is reachable (${response.status})`);
  } catch (error: any) {
    logger.error(`❌ Base URL not reachable: ${error.message}`);
    return;
  }
  
  try {
    // Test API endpoint
    logger.info('\nTesting API endpoint...');
    const response = await axios.post(fullUrl, {
      model: gepetoConfig.model,
      messages: [
        {
          role: 'user',
          content: 'Hello, please respond with "OK"'
        }
      ],
      max_completion_tokens: 10
    }, {
      headers: {
        'Authorization': `Bearer ${gepetoConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    logger.success(`✅ API endpoint is working (${response.status})`);
    logger.info(`Response: ${JSON.stringify(response.data, null, 2)}`);
  } catch (error: any) {
    logger.error(`❌ API endpoint failed: ${error.message}`);
    if (error.response) {
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

async function diagnoseJiraAPI() {
  logger.info('\n🔍 Diagnosing Jira API...');
  logger.info('-'.repeat(40));
  
  const jiraConfig = {
    baseUrl: process.env.JIRA_BASE_URL || '',
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
    projectKey: process.env.JIRA_PROJECT_KEY || '',
    issueType: process.env.JIRA_ISSUE_TYPE || 'Story',
  };
  
  logger.info(`Base URL: ${jiraConfig.baseUrl}`);
  logger.info(`Email: ${jiraConfig.email}`);
  logger.info(`API Token: ${jiraConfig.apiToken ? '***' + jiraConfig.apiToken.slice(-4) : 'NOT SET'}`);
  logger.info(`Project Key: ${jiraConfig.projectKey}`);
  logger.info(`Issue Type: ${jiraConfig.issueType}`);
  
  if (!jiraConfig.baseUrl || !jiraConfig.email || !jiraConfig.apiToken) {
    logger.error('❌ Missing required Jira configuration');
    return;
  }
  
  try {
    // Test basic connectivity
    logger.info('\nTesting basic connectivity...');
    const response = await axios.get(jiraConfig.baseUrl, { 
      timeout: 5000,
      auth: {
        username: jiraConfig.email,
        password: jiraConfig.apiToken
      }
    });
    logger.success(`✅ Base URL is reachable (${response.status})`);
  } catch (error: any) {
    logger.error(`❌ Base URL not reachable: ${error.message}`);
    return;
  }
  
  try {
    // Test authentication
    logger.info('\nTesting authentication...');
    const response = await axios.get(`${jiraConfig.baseUrl}/rest/api/3/myself`, {
      auth: {
        username: jiraConfig.email,
        password: jiraConfig.apiToken
      },
      timeout: 10000
    });
    
    logger.success(`✅ Authentication successful`);
    logger.info(`User: ${response.data.displayName} (${response.data.emailAddress})`);
  } catch (error: any) {
    logger.error(`❌ Authentication failed: ${error.message}`);
    if (error.response) {
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return;
  }
  
  try {
    // Test project access
    logger.info('\nTesting project access...');
    const response = await axios.get(`${jiraConfig.baseUrl}/rest/api/3/project/${jiraConfig.projectKey}`, {
      auth: {
        username: jiraConfig.email,
        password: jiraConfig.apiToken
      },
      timeout: 10000
    });
    
    logger.success(`✅ Project access successful`);
    logger.info(`Project: ${response.data.name} (${response.data.key})`);
  } catch (error: any) {
    logger.error(`❌ Project access failed: ${error.message}`);
    if (error.response) {
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
  
  try {
    // Test user search
    logger.info('\nTesting user search...');
    const response = await axios.get(`${jiraConfig.baseUrl}/rest/api/3/user/search?query=${encodeURIComponent(jiraConfig.email)}`, {
      auth: {
        username: jiraConfig.email,
        password: jiraConfig.apiToken
      },
      timeout: 10000
    });
    
    logger.success(`✅ User search successful`);
    logger.info(`Found ${response.data.length} users`);
    response.data.forEach((user: any, index: number) => {
      logger.info(`  ${index + 1}. ${user.displayName} (${user.emailAddress})`);
    });
  } catch (error: any) {
    logger.error(`❌ User search failed: ${error.message}`);
    if (error.response) {
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

async function main() {
  logger.info('🔍 API Configuration Diagnostics');
  logger.info('=' .repeat(50));
  
  await diagnoseGepetoAPI();
  await diagnoseJiraAPI();
  
  logger.info('\n📋 Summary');
  logger.info('-'.repeat(20));
  logger.info('Check the output above for any configuration issues.');
  logger.info('Common issues:');
  logger.info('- Incorrect API URLs or endpoints');
  logger.info('- Invalid API keys or tokens');
  logger.info('- Missing environment variables');
  logger.info('- Network connectivity problems');
  logger.info('- Insufficient permissions');
}

main().catch(console.error);
