# API Contracts: HR 简历智能筛查系统

**Branch**: `1-resume-screening`
**Created**: 2026-04-17
**Base URL**: `/api/v1`

---

## Authentication

All endpoints (except login/register) require JWT Bearer token in Authorization header:
```
Authorization: Bearer <access_token>
```

---

## 1. Auth（认证）

### POST /auth/register
注册新用户

**Request**:
```json
{
  "email": "hr@example.com",
  "password": "SecureP@ss123",
  "name": "张三",
  "company_name": "ABC科技有限公司"
}
```

**Response 201**:
```json
{
  "user": {
    "id": "uuid",
    "email": "hr@example.com",
    "name": "张三",
    "role": "operator",
    "company_id": "uuid"
  },
  "access_token": "jwt_token",
  "token_type": "bearer"
}
```

### POST /auth/login
用户登录

**Request**:
```json
{
  "email": "hr@example.com",
  "password": "SecureP@ss123"
}
```

**Response 200**:
```json
{
  "user": {
    "id": "uuid",
    "email": "hr@example.com",
    "name": "张三",
    "role": "operator",
    "company_id": "uuid"
  },
  "access_token": "jwt_token",
  "token_type": "bearer"
}
```

### POST /auth/reset-password
密码重置

**Request**:
```json
{
  "email": "hr@example.com"
}
```

**Response 200**:
```json
{
  "message": "密码重置邮件已发送"
}
```

---

## 2. Companies（公司）

### GET /companies/me
获取当前用户的公司信息

**Response 200**:
```json
{
  "id": "uuid",
  "name": "ABC科技有限公司",
  "industry": "互联网",
  "created_at": "2026-04-17T10:00:00Z"
}
```

### GET /companies/me/members
获取公司成员列表（管理员）

**Response 200**:
```json
{
  "members": [
    {
      "id": "uuid",
      "name": "张三",
      "email": "hr@example.com",
      "role": "operator",
      "is_active": true,
      "created_at": "2026-04-17T10:00:00Z"
    }
  ],
  "total": 5
}
```

### POST /companies/me/invite
邀请新成员（管理员）

**Request**:
```json
{
  "email": "newhr@example.com",
  "name": "李四",
  "role": "operator"
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "email": "newhr@example.com",
  "name": "李四",
  "role": "operator"
}
```

### PATCH /companies/me/members/{user_id}
更新成员角色（管理员）

**Request**:
```json
{
  "role": "admin"
}
```

**Response 200**:
```json
{
  "id": "uuid",
  "role": "admin"
}
```

---

## 3. Job Requirements（岗位需求）

### GET /job-requirements
获取当前公司的岗位需求列表

**Query Parameters**:
| Param    | Type   | Description                  |
| -------- | ------ | ---------------------------- |
| status   | string | 筛选状态: draft/active/closed |
| page     | int    | 页码，默认 1                 |
| per_page | int    | 每页数量，默认 20            |

**Response 200**:
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "高级前端工程师",
      "status": "active",
      "created_by": "uuid",
      "criteria": { "..." : "..." },
      "resume_count": 45,
      "analyzed_count": 42,
      "created_at": "2026-04-17T10:00:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "per_page": 20
}
```

### POST /job-requirements
创建岗位需求

**Request**:
```json
{
  "title": "高级前端工程师",
  "description": "负责公司核心产品前端架构设计与开发",
  "template_id": null,
  "criteria": {
    "required_skills": ["React", "TypeScript", "Node.js"],
    "bonus_skills": ["Next.js", "GraphQL"],
    "min_experience_years": 3,
    "education": "bachelor",
    "industry_preference": ["互联网"],
    "languages": ["中文"],
    "weights": {
      "skill_match": "high",
      "experience_match": "high",
      "education": "medium",
      "project_relevance": "medium",
      "overall_quality": "low"
    },
    "other_requirements": "有大型项目经验优先"
  }
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "title": "高级前端工程师",
  "description": "...",
  "status": "draft",
  "criteria": { "...": "..." },
  "created_at": "2026-04-17T10:00:00Z"
}
```

### GET /job-requirements/{id}
获取单个岗位需求详情

**Response 200**: 同上完整对象

### PATCH /job-requirements/{id}
更新岗位需求

**Request**: 同创建，字段可选

**Response 200**: 更新后的完整对象

### DELETE /job-requirements/{id}
删除岗位需求（仅 draft 状态可删除）

**Response 204**: 无内容

### POST /job-requirements/{id}/activate
激活岗位需求（校验 criteria 非空）

**Response 200**:
```json
{
  "id": "uuid",
  "status": "active"
}
```

---

## 4. Job Templates（岗位模板）

### GET /job-templates
获取公司岗位模板列表

**Response 200**:
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "前端工程师标准模板",
      "content": { "...": "..." },
      "created_at": "2026-04-17T10:00:00Z"
    }
  ]
}
```

### POST /job-templates
创建模板

**Request**:
```json
{
  "name": "前端工程师标准模板",
  "content": {
    "required_skills": ["React", "TypeScript"],
    "weights": { "...": "..." }
  }
}
```

**Response 201**: 创建后的模板对象

### PATCH /job-templates/{id}
更新模板

**Response 200**: 更新后的模板对象

### DELETE /job-templates/{id}
删除模板

**Response 204**: 无内容

---

## 5. Resumes（简历）

### POST /resumes/upload
批量上传简历

**Content-Type**: `multipart/form-data`

**Form Fields**:
| Field              | Type   | Description                    |
| ------------------ | ------ | ------------------------------ |
| job_requirement_id | string | 关联的岗位需求 ID              |
| files              | file[] | 简历文件（最多 100 个）        |

**Response 202**:
```json
{
  "job_requirement_id": "uuid",
  "uploaded": [
    {
      "id": "uuid",
      "file_name": "张三_前端工程师.pdf",
      "parse_status": "pending"
    }
  ],
  "failed": [
    {
      "file_name": "损坏文件.pdf",
      "error": "文件无法读取"
    }
  ],
  "total_uploaded": 48,
  "total_failed": 2
}
```

### GET /resumes
获取简历列表（按岗位筛选）

**Query Parameters**:
| Param              | Type   | Description                      |
| ------------------ | ------ | -------------------------------- |
| job_requirement_id | string | 岗位需求 ID（必填）              |
| parse_status       | string | 解析状态筛选                     |
| page               | int    | 页码                             |
| per_page           | int    | 每页数量                         |

**Response 200**:
```json
{
  "items": [
    {
      "id": "uuid",
      "file_name": "张三_前端工程师.pdf",
      "parse_status": "success",
      "candidate_name": "张三",
      "candidate_email": "zhangsan@example.com",
      "created_at": "2026-04-17T10:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "per_page": 20
}
```

### GET /resumes/{id}
获取简历详情（含解析数据）

**Response 200**:
```json
{
  "id": "uuid",
  "file_name": "张三_前端工程师.pdf",
  "parse_status": "success",
  "parsed_data": {
    "name": "张三",
    "skills": ["React", "TypeScript"],
    "...": "..."
  },
  "file_url": "/api/v1/resumes/uuid/file"
}
```

### GET /resumes/{id}/file
下载简历原始文件

**Response**: 文件流（Content-Type 根据文件类型）

### DELETE /resumes/{id}
删除简历

**Response 204**: 无内容

---

## 6. Analysis（分析）

### GET /analysis
获取岗位下所有简历的分析结果

**Query Parameters**:
| Param              | Type   | Description                          |
| ------------------ | ------ | ------------------------------------ |
| job_requirement_id | string | 岗位需求 ID（必填）                  |
| sort_by            | string | 排序字段: overall_score（默认）, skill_match, experience_match 等 |
| sort_order         | string | asc / desc（默认 desc）              |
| recommendation     | string | 推荐等级筛选                         |
| page               | int    | 页码                                 |
| per_page           | int    | 每页数量                             |

**Response 200**:
```json
{
  "items": [
    {
      "id": "uuid",
      "resume_id": "uuid",
      "candidate_name": "张三",
      "overall_score": 87.50,
      "recommendation": "strongly_recommended",
      "recommendation_reason": "技能完全匹配，项目经验丰富...",
      "dimension_scores": [
        {
          "dimension": "skill_match",
          "score": 92.00,
          "weight": "high"
        },
        {
          "dimension": "experience_match",
          "score": 88.00,
          "weight": "high"
        },
        {
          "dimension": "education",
          "score": 80.00,
          "weight": "medium"
        },
        {
          "dimension": "project_relevance",
          "score": 90.00,
          "weight": "medium"
        },
        {
          "dimension": "overall_quality",
          "score": 85.00,
          "weight": "low"
        }
      ],
      "analyzed_at": "2026-04-17T10:05:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 20,
  "statistics": {
    "total_resumes": 50,
    "analyzed": 42,
    "pending": 5,
    "failed": 3,
    "strongly_recommended": 5,
    "recommended": 8,
    "average_score": 68.5
  }
}
```

### GET /analysis/{id}
获取单份简历的详细分析报告

**Response 200**:
```json
{
  "id": "uuid",
  "resume_id": "uuid",
  "job_requirement_id": "uuid",
  "overall_score": 87.50,
  "recommendation": "strongly_recommended",
  "recommendation_reason": "技能完全匹配岗位需求...",
  "strengths": [
    "3 年以上 React 开发经验，技术栈完全匹配",
    "参与过大型电商平台架构重构项目",
    "熟悉 TypeScript 和 Node.js"
  ],
  "weaknesses": [
    "学历为大专，不满足本科要求",
    "无团队管理经验"
  ],
  "dimension_scores": [
    {
      "dimension": "skill_match",
      "score": 92.00,
      "weight": "high",
      "analysis_text": "候选人掌握 React、TypeScript、Node.js 等核心技能，与岗位要求高度匹配...",
      "match_details": {
        "matched_skills": ["React", "TypeScript", "Node.js"],
        "missing_skills": [],
        "bonus_skills_matched": ["Next.js"]
      }
    }
  ],
  "resume": {
    "id": "uuid",
    "file_name": "张三_前端工程师.pdf",
    "parsed_data": { "...": "..." }
  },
  "job_requirement": {
    "id": "uuid",
    "title": "高级前端工程师",
    "criteria": { "...": "..." }
  },
  "analyzed_at": "2026-04-17T10:05:00Z"
}
```

### POST /analysis/{id}/retry
重新分析（当分析失败时）

**Response 202**:
```json
{
  "id": "uuid",
  "analysis_status": "pending"
}
```

### GET /analysis/compare
候选人对比

**Query Parameters**:
| Param         | Type   | Description                    |
| ------------- | ------ | ------------------------------ |
| analysis_ids  | string | 分析结果 ID，逗号分隔（2-3个） |

**Response 200**:
```json
{
  "candidates": [
    {
      "analysis_id": "uuid",
      "candidate_name": "张三",
      "overall_score": 87.50,
      "dimension_scores": [
        { "dimension": "skill_match", "score": 92.00 }
      ],
      "key_info": {
        "experience_years": 5,
        "education": "本科",
        "top_skills": ["React", "TypeScript", "Node.js"]
      }
    }
  ]
}
```

### GET /analysis/export
导出分析结果

**Query Parameters**:
| Param              | Type   | Description                    |
| ------------------ | ------ | ------------------------------ |
| job_requirement_id | string | 岗位需求 ID（必填）            |
| format             | string | 导出格式: xlsx / csv           |
| recommendation     | string | 推荐等级筛选（可选）           |

**Response 200**: 文件下载（Content-Type: application/octet-stream）

---

## 7. Async Status（异步任务状态）

### GET /tasks/{task_id}
获取异步任务进度

**Response 200**:
```json
{
  "task_id": "uuid",
  "type": "resume_analysis",
  "status": "in_progress",
  "progress": {
    "total": 50,
    "completed": 35,
    "failed": 2
  },
  "created_at": "2026-04-17T10:00:00Z"
}
```

**Status 枚举**: `pending` / `in_progress` / `completed` / `failed`

---

## Error Responses

所有错误使用统一格式：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "details": [
      {
        "field": "email",
        "message": "邮箱格式不正确"
      }
    ]
  }
}
```

**HTTP Status Codes**:
| Code | Description              |
| ---- | ------------------------ |
| 400  | 请求参数错误             |
| 401  | 未认证/Token 过期        |
| 403  | 权限不足                 |
| 404  | 资源不存在               |
| 409  | 资源冲突（如邮箱已注册） |
| 413  | 文件过大                 |
| 422  | 数据校验失败             |
| 500  | 服务器内部错误           |
