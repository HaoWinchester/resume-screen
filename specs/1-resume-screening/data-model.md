# Data Model: HR 简历智能筛查系统

**Branch**: `1-resume-screening`
**Created**: 2026-04-17

---

## Entity Relationship Diagram

```
Company 1──N User
Company 1──N JobTemplate
Company 1──N JobRequirement
User   1──N JobRequirement (created_by)
JobRequirement 1──N Resume
JobRequirement 1──1 JobTemplate (optional, source template)
Resume 1──1 AnalysisResult
AnalysisResult 1──N DimensionScore
```

## Entities

### Company（公司）

| Field         | Type         | Required | Description          | Constraints             |
| ------------- | ------------ | -------- | -------------------- | ----------------------- |
| id            | UUID         | Yes      | 主键                 | 自动生成                |
| name          | VARCHAR(200) | Yes      | 公司名称             | 唯一                    |
| industry      | VARCHAR(100) | No       | 所属行业             |                         |
| created_at    | TIMESTAMP    | Yes      | 创建时间             | 自动填充                |
| updated_at    | TIMESTAMP    | Yes      | 更新时间             | 自动更新                |

### User（用户）

| Field         | Type         | Required | Description            | Constraints                     |
| ------------- | ------------ | -------- | ---------------------- | ------------------------------- |
| id            | UUID         | Yes      | 主键                   | 自动生成                        |
| email         | VARCHAR(255) | Yes      | 登录邮箱               | 唯一，格式校验                  |
| password_hash | VARCHAR(255) | Yes      | 密码哈希               | bcrypt 加密                     |
| name          | VARCHAR(100) | Yes      | 用户姓名               |                                 |
| role          | ENUM         | Yes      | 角色                   | `admin` / `operator`            |
| company_id    | UUID         | Yes      | 所属公司               | 外键 → Company                  |
| is_active     | BOOLEAN      | Yes      | 是否启用               | 默认 true                       |
| created_at    | TIMESTAMP    | Yes      | 创建时间               | 自动填充                        |
| updated_at    | TIMESTAMP    | Yes      | 更新时间               | 自动更新                        |

### JobTemplate（岗位模板）

| Field          | Type         | Required | Description            | Constraints                     |
| -------------- | ------------ | -------- | ---------------------- | ------------------------------- |
| id             | UUID         | Yes      | 主键                   | 自动生成                        |
| name           | VARCHAR(200) | Yes      | 模板名称               |                                 |
| company_id     | UUID         | Yes      | 所属公司               | 外键 → Company                  |
| content        | JSONB        | Yes      | 模板内容（同 JobReq）  | 见 JobRequirement.criteria      |
| created_by     | UUID         | Yes      | 创建者                 | 外键 → User                     |
| created_at     | TIMESTAMP    | Yes      | 创建时间               | 自动填充                        |
| updated_at     | TIMESTAMP    | Yes      | 更新时间               | 自动更新                        |

### JobRequirement（岗位需求）

| Field          | Type         | Required | Description            | Constraints                     |
| -------------- | ------------ | -------- | ---------------------- | ------------------------------- |
| id             | UUID         | Yes      | 主键                   | 自动生成                        |
| title          | VARCHAR(200) | Yes      | 岗位名称               |                                 |
| description    | TEXT         | No       | 岗位描述               |                                 |
| company_id     | UUID         | Yes      | 所属公司               | 外键 → Company                  |
| created_by     | UUID         | Yes      | 创建者                 | 外键 → User                     |
| template_id    | UUID         | No       | 来源模板               | 外键 → JobTemplate（可空）      |
| status         | ENUM         | Yes      | 状态                   | `draft` / `active` / `closed`   |
| criteria       | JSONB        | Yes      | 筛选条件               | 见下方 criteria 结构             |
| created_at     | TIMESTAMP    | Yes      | 创建时间               | 自动填充                        |
| updated_at     | TIMESTAMP    | Yes      | 更新时间               | 自动更新                        |

**criteria JSONB 结构**:

```json
{
  "required_skills": ["Python", "React"],
  "bonus_skills": ["Docker", "K8s"],
  "min_experience_years": 3,
  "education": "bachelor",
  "industry_preference": ["互联网", "金融科技"],
  "languages": ["中文", "英语"],
  "weights": {
    "skill_match": "high",
    "experience_match": "high",
    "education": "medium",
    "project_relevance": "medium",
    "overall_quality": "low"
  },
  "other_requirements": "具备良好的沟通能力"
}
```

**weights 校验规则**:
- 权重值: `high`（系数 3）、`medium`（系数 2）、`low`（系数 1）
- 至少设置一个维度的权重
- 空岗位需求（所有筛选条件为空）不允许设置为 `active` 状态

### Resume（简历）

| Field            | Type         | Required | Description          | Constraints                       |
| ---------------- | ------------ | -------- | -------------------- | --------------------------------- |
| id               | UUID         | Yes      | 主键                 | 自动生成                          |
| job_requirement_id | UUID       | Yes      | 关联岗位             | 外键 → JobRequirement              |
| file_name        | VARCHAR(500) | Yes      | 原始文件名           |                                   |
| file_path        | VARCHAR(1000)| Yes      | 文件存储路径         |                                   |
| file_type        | ENUM         | Yes      | 文件类型             | `pdf` / `doc` / `docx` / `jpg` / `png` |
| file_size        | INTEGER      | Yes      | 文件大小（字节）     | 最大 20MB                         |
| parse_status     | ENUM         | Yes      | 解析状态             | `pending` / `parsing` / `success` / `failed` |
| parse_error      | TEXT         | No       | 解析失败原因         | parse_status 为 failed 时必填     |
| parsed_data      | JSONB        | No       | 解析后的结构化数据   | parse_status 为 success 时有值    |
| candidate_name   | VARCHAR(100) | No       | 候选人姓名           | 从解析数据提取                    |
| candidate_email  | VARCHAR(255) | No       | 候选人邮箱           | 从解析数据提取                    |
| candidate_phone  | VARCHAR(50)  | No       | 候选人电话           | 从解析数据提取                    |
| uploaded_by      | UUID         | Yes      | 上传者               | 外键 → User                       |
| created_at       | TIMESTAMP    | Yes      | 上传时间             | 自动填充                          |

**parsed_data JSONB 结构**:

```json
{
  "name": "张三",
  "email": "zhangsan@example.com",
  "phone": "13800138000",
  "education": [
    {
      "school": "北京大学",
      "degree": "本科",
      "major": "计算机科学",
      "start_date": "2015-09",
      "end_date": "2019-06"
    }
  ],
  "work_experience": [
    {
      "company": "ABC科技",
      "position": "前端工程师",
      "start_date": "2019-07",
      "end_date": "2023-03",
      "description": "负责公司核心产品的前端开发..."
    }
  ],
  "skills": ["JavaScript", "React", "TypeScript", "Node.js"],
  "projects": [
    {
      "name": "电商平台重构",
      "role": "前端负责人",
      "description": "主导电商平台从 Vue 迁移到 React..."
    }
  ],
  "raw_text": "完整简历文本内容..."
}
```

**State Transitions (parse_status)**:

```
pending → parsing → success
                  → failed
```

### AnalysisResult（分析结果）

| Field              | Type         | Required | Description          | Constraints                       |
| ------------------ | ------------ | -------- | -------------------- | --------------------------------- |
| id                 | UUID         | Yes      | 主键                 | 自动生成                          |
| resume_id          | UUID         | Yes      | 关联简历             | 外键 → Resume，唯一               |
| job_requirement_id | UUID         | Yes      | 关联岗位             | 外键 → JobRequirement              |
| overall_score      | DECIMAL(5,2) | Yes      | 综合评分             | 0.00 - 100.00                     |
| recommendation     | ENUM         | Yes      | 推荐等级             | `strongly_recommended` / `recommended` / `pending` |
| recommendation_reason | TEXT      | No       | 推荐理由             | 推荐等级非 pending 时生成          |
| strengths          | JSONB        | No       | 核心优势列表         | 字符串数组                        |
| weaknesses         | JSONB        | No       | 不足之处列表         | 字符串数组                        |
| analysis_status    | ENUM         | Yes      | 分析状态             | `pending` / `analyzing` / `completed` / `failed` |
| analyzed_at        | TIMESTAMP    | No       | 分析完成时间         |                                   |
| created_at         | TIMESTAMP    | Yes      | 创建时间             | 自动填充                          |

**State Transitions (analysis_status)**:

```
pending → analyzing → completed
                    → failed
```

### DimensionScore（维度评分）

| Field            | Type         | Required | Description          | Constraints                       |
| ---------------- | ------------ | -------- | -------------------- | --------------------------------- |
| id               | UUID         | Yes      | 主键                 | 自动生成                          |
| analysis_id      | UUID         | Yes      | 关联分析结果         | 外键 → AnalysisResult             |
| dimension        | ENUM         | Yes      | 维度名称             | 见下方维度枚举                     |
| score            | DECIMAL(5,2) | Yes      | 维度评分             | 0.00 - 100.00                     |
| weight           | VARCHAR(10)  | Yes      | 该维度权重           | `high` / `medium` / `low`         |
| analysis_text    | TEXT         | Yes      | 维度分析说明         |                                   |
| match_details    | JSONB        | No       | 匹配详情             | 具体匹配项列表                    |

**dimension 枚举值**:

- `skill_match` - 技能匹配度
- `experience_match` - 工作经验匹配度
- `education` - 教育背景评估
- `project_relevance` - 项目经历相关性
- `overall_quality` - 简历整体质量

**综合评分计算公式**:

```
overall_score = Σ(dimension_score × weight_factor) / Σ(weight_factor)

weight_factor: high=3, medium=2, low=1
```

## Indexes

```sql
-- 用户按公司查询
CREATE INDEX idx_user_company ON users(company_id);

-- 岗位需求按公司查询
CREATE INDEX idx_job_requirement_company ON job_requirements(company_id);

-- 简历按岗位查询
CREATE INDEX idx_resume_job ON resumes(job_requirement_id);

-- 简历解析状态查询
CREATE INDEX idx_resume_parse_status ON resumes(parse_status);

-- 分析结果按岗位查询
CREATE INDEX idx_analysis_job ON analysis_results(job_requirement_id);

-- 分析结果按评分排序
CREATE INDEX idx_analysis_score ON analysis_results(overall_score DESC);

-- 维度评分按分析结果查询
CREATE INDEX idx_dimension_analysis ON dimension_scores(analysis_id);
```
