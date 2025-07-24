const express = require('express');
const axios = require('axios');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

const { analyzePDFContent } = require('../services/llmService');
const { createAssessment } = require('../services/assessmentService');

const router = express.Router();

const gitlabSchema = Joi.object({
  projectUrl: Joi.string().uri().required(),
  accessToken: Joi.string().optional(),
  branch: Joi.string().default('main'),
  difficulty: Joi.number().integer().min(1).max(10).default(5),
  questionCount: Joi.number().integer().min(1).max(50).default(10),
  llmProvider: Joi.string().valid('gemini', 'claude', 'openai', 'deepseek', 'custom').optional(),
  includeFiles: Joi.array().items(Joi.string()).optional(),
  excludeFiles: Joi.array().items(Joi.string()).default([
    '*.log', '*.tmp', 'node_modules/**', '.git/**', '*.min.js', '*.bundle.*'
  ])
});

router.post('/analyze', async (req, res, next) => {
  try {
    const { error, value } = gitlabSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: 'Validation Error', details: error.details });
    }

    const projectInfo = extractProjectInfo(value.projectUrl);
    if (!projectInfo) {
      return res.status(400).json({ error: 'Invalid GitLab project URL' });
    }

    const projectFiles = await fetchProjectFiles(projectInfo, value);
    
    if (projectFiles.length === 0) {
      return res.status(400).json({ error: 'No accessible files found in the project' });
    }

    const content = await processProjectFiles(projectFiles, projectInfo, value);
    
    const analysis = await analyzePDFContent(content, {
      provider: value.llmProvider || process.env.DEFAULT_LLM_PROVIDER,
      difficulty: value.difficulty,
      questionCount: value.questionCount
    });

    const assessment = await createAssessment({
      filename: `gitlab_${projectInfo.projectId}_${Date.now()}`,
      originalName: `${projectInfo.namespace}/${projectInfo.project}`,
      content,
      analysis,
      difficulty: value.difficulty,
      questionCount: value.questionCount,
      llmProvider: value.llmProvider
    });

    res.json({
      success: true,
      assessmentId: assessment.id,
      projectName: `${projectInfo.namespace}/${projectInfo.project}`,
      filesProcessed: projectFiles.length,
      analysis: analysis.summary,
      questionsGenerated: assessment.questions.length
    });

  } catch (error) {
    next(error);
  }
});

function extractProjectInfo(projectUrl) {
  try {
    const url = new URL(projectUrl);
    
    if (!url.hostname.includes('gitlab')) {
      return null;
    }

    const pathParts = url.pathname.split('/').filter(part => part.length > 0);
    
    if (pathParts.length < 2) {
      return null;
    }

    const namespace = pathParts[0];
    const project = pathParts[1];
    
    return {
      baseUrl: `${url.protocol}//${url.hostname}`,
      namespace,
      project,
      projectId: `${namespace}/${project}`,
      apiUrl: `${url.protocol}//${url.hostname}/api/v4`
    };
  } catch (error) {
    return null;
  }
}

async function fetchProjectFiles(projectInfo, options) {
  try {
    const headers = {};
    if (options.accessToken) {
      headers['PRIVATE-TOKEN'] = options.accessToken;
    }

    const treeUrl = `${projectInfo.apiUrl}/projects/${encodeURIComponent(projectInfo.projectId)}/repository/tree`;
    const params = {
      ref: options.branch,
      recursive: true,
      per_page: 100
    };

    const response = await axios.get(treeUrl, { headers, params });
    
    const allFiles = response.data.filter(item => item.type === 'blob');
    
    const relevantFiles = allFiles.filter(file => {
      if (options.includeFiles && options.includeFiles.length > 0) {
        return options.includeFiles.some(pattern => 
          file.path.includes(pattern) || minimatch(file.path, pattern)
        );
      }
      
      return !options.excludeFiles.some(pattern => 
        minimatch(file.path, pattern)
      ) && isRelevantFile(file.path);
    });

    return relevantFiles.slice(0, 20);

  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('Access token required or invalid for private repository');
    }
    if (error.response?.status === 404) {
      throw new Error('Project not found or not accessible');
    }
    throw new Error(`Failed to fetch project files: ${error.message}`);
  }
}

function isRelevantFile(filePath) {
  const codeExtensions = [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
    '.cs', '.php', '.rb', '.go', '.rs', '.kt', '.swift', '.scala', '.clj',
    '.html', '.css', '.scss', '.less', '.vue', '.svelte', '.sql', '.sh',
    '.md', '.txt', '.json', '.xml', '.yaml', '.yml', '.toml', '.ini'
  ];
  
  const maxFileSize = 50000;
  const ext = path.extname(filePath).toLowerCase();
  
  return codeExtensions.includes(ext) && 
         !filePath.includes('test') && 
         !filePath.includes('spec') &&
         !filePath.includes('.min.');
}

function minimatch(str, pattern) {
  const regexPattern = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(str);
}

async function processProjectFiles(files, projectInfo, options) {
  const fileContents = [];
  const headers = {};
  
  if (options.accessToken) {
    headers['PRIVATE-TOKEN'] = options.accessToken;
  }

  for (const file of files.slice(0, 10)) {
    try {
      const fileUrl = `${projectInfo.apiUrl}/projects/${encodeURIComponent(projectInfo.projectId)}/repository/files/${encodeURIComponent(file.path)}/raw`;
      const params = { ref: options.branch };
      
      const response = await axios.get(fileUrl, { 
        headers, 
        params,
        timeout: 5000,
        maxContentLength: 100000
      });
      
      if (response.data && typeof response.data === 'string') {
        fileContents.push({
          path: file.path,
          content: response.data.substring(0, 5000)
        });
      }
    } catch (error) {
      console.warn(`Failed to fetch file ${file.path}:`, error.message);
    }
  }

  const combinedContent = fileContents.map(file => 
    `--- ${file.path} ---\n${file.content}\n`
  ).join('\n');

  return {
    text: combinedContent,
    pages: 1,
    info: {
      project: `${projectInfo.namespace}/${projectInfo.project}`,
      branch: options.branch,
      filesIncluded: fileContents.length
    },
    metadata: {
      wordCount: combinedContent.split(/\s+/).length,
      characterCount: combinedContent.length,
      extractedAt: new Date().toISOString(),
      source: 'gitlab',
      files: fileContents.map(f => f.path)
    }
  };
}

router.get('/project-info', async (req, res, next) => {
  try {
    const { projectUrl, accessToken } = req.query;
    
    if (!projectUrl) {
      return res.status(400).json({ error: 'projectUrl parameter required' });
    }

    const projectInfo = extractProjectInfo(projectUrl);
    if (!projectInfo) {
      return res.status(400).json({ error: 'Invalid GitLab project URL' });
    }

    const headers = {};
    if (accessToken) {
      headers['PRIVATE-TOKEN'] = accessToken;
    }

    const projectApiUrl = `${projectInfo.apiUrl}/projects/${encodeURIComponent(projectInfo.projectId)}`;
    
    try {
      const response = await axios.get(projectApiUrl, { headers });
      const project = response.data;
      
      res.json({
        id: project.id,
        name: project.name,
        fullName: project.path_with_namespace,
        description: project.description,
        defaultBranch: project.default_branch,
        languages: project.languages || {},
        lastActivity: project.last_activity_at,
        webUrl: project.web_url,
        isPublic: project.visibility === 'public',
        fileCount: project.statistics?.repository_size || 'Unknown'
      });
      
    } catch (error) {
      if (error.response?.status === 401) {
        res.status(401).json({ error: 'Access token required for private repository' });
      } else if (error.response?.status === 404) {
        res.status(404).json({ error: 'Project not found' });
      } else {
        throw error;
      }
    }

  } catch (error) {
    next(error);
  }
});

module.exports = router;