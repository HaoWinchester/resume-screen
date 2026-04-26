import type { APIRequestContext, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export const API_BASE = 'http://localhost:8001';
export const ADMIN_EMAIL = 'admin@test.com';
export const ADMIN_PASSWORD = '12345678';
export const TEST_PASSWORD = 'TestPassword123!';

export async function login(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto('/login');
  await page.getByPlaceholder(/邮箱/).fill(email);
  await page.getByPlaceholder(/密码/).fill(password);
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.waitForURL('**/dashboard/**', { timeout: 10000 });
}

export async function getAuthToken(email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to login: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

export async function registerViaAPI(
  request: APIRequestContext,
  email: string,
  companyName: string,
  name = 'E2E Test User',
  password = TEST_PASSWORD
) {
  const response = await request.post(`${API_BASE}/api/v1/auth/register`, {
    data: {
      email,
      password,
      name,
      company_name: companyName,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to register: ${response.status()} ${await response.text()}`);
  }

  return response.json();
}

export async function createJobViaAPI(
  token: string,
  title: string,
  status: 'draft' | 'active' | 'closed' = 'draft'
) {
  const response = await fetch(`${API_BASE}/api/v1/job-requirements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      title,
      description: 'E2E测试创建的岗位',
      criteria: {
        required_skills: ['React', 'TypeScript'],
        bonus_skills: ['Python'],
        min_experience_years: 3,
        education: 'bachelor',
        industry_preference: ['互联网'],
        languages: ['中文'],
        weights: {
          skill_match: 'high',
          experience_match: 'medium',
          education: 'high',
          project_relevance: 'medium',
          overall_quality: 'high',
        },
        other_requirements: 'E2E测试',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create job: ${response.status} ${error}`);
  }

  const job = await response.json();

  if (status === 'active' || status === 'closed') {
    await activateJobViaAPI(token, job.id);

    if (status === 'closed') {
      await closeJobViaAPI(token, job.id);
    }
  }

  return job;
}

export async function activateJobViaAPI(token: string, jobId: string) {
  const response = await fetch(`${API_BASE}/api/v1/job-requirements/${jobId}/activate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to activate job: ${response.status} ${error}`);
  }

  return response.json();
}

export async function closeJobViaAPI(token: string, jobId: string) {
  const response = await fetch(`${API_BASE}/api/v1/job-requirements/${jobId}/close`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to close job: ${response.status} ${error}`);
  }

  return response.json();
}

export async function copyJobViaAPI(token: string, jobId: string) {
  const response = await fetch(`${API_BASE}/api/v1/job-requirements/${jobId}/copy`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to copy job: ${response.status} ${error}`);
  }

  return response.json();
}

export async function inviteMemberViaAPI(
  token: string,
  email: string,
  name: string,
  role: 'admin' | 'operator' = 'operator'
) {
  const response = await fetch(`${API_BASE}/api/v1/companies/me/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ email, name, role }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to invite member: ${response.status} ${error}`);
  }

  return response.json();
}

export async function uploadSampleResume(
  request: APIRequestContext,
  token: string,
  jobId: string,
  fileName = `sample-${Date.now()}.pdf`
) {
  const samplePath = path.join(__dirname, 'test-data', 'sample.pdf');
  const response = await request.post(`${API_BASE}/api/v1/resumes/upload`, {
    headers: { 'Authorization': `Bearer ${token}` },
    multipart: {
      job_requirement_id: jobId,
      files: {
        name: fileName,
        mimeType: 'application/pdf',
        buffer: fs.readFileSync(samplePath),
      },
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to upload sample resume: ${response.status()} ${await response.text()}`);
  }

  return response.json();
}

export async function waitForCompletedAnalysis(
  request: APIRequestContext,
  token: string,
  jobId: string,
  timeoutMs = 90000
) {
  const deadline = Date.now() + timeoutMs;
  let lastPayload: any = null;

  while (Date.now() < deadline) {
    const response = await request.get(`${API_BASE}/api/v1/analysis`, {
      headers: { 'Authorization': `Bearer ${token}` },
      params: {
        job_requirement_id: jobId,
        page: '1',
        per_page: '20',
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to list analysis: ${response.status()} ${await response.text()}`);
    }

    const payload = await response.json();
    lastPayload = payload;
    if ((payload.statistics?.analyzed || 0) > 0 && (payload.items?.length || 0) > 0) {
      return payload.items;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(`Timed out waiting for completed analysis: ${JSON.stringify(lastPayload)}`);
}
