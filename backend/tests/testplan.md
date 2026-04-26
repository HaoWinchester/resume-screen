# HR 简历智能筛查系统 - 全栈测试用例

## 测试环境
- 前端: http://localhost:3004
- 后端: http://localhost:8001
- API 文档: http://localhost:8001/docs

## 优先级说明
- **P0**: 必须通过，核心功能
- **P1**: 重要，影响用户体验
- **P2**: 次要，边缘情况

---

## A. 认证流程 (Auth)

### A-001 用户注册成功
- **前置条件**: 无
- **测试步骤**:
  1. POST /api/v1/auth/register
  ```json
  {
    "email": "newuser@example.com",
    "password": "securepass123",
    "name": "张三",
    "company_name": "测试公司"
  }
  ```
- **预期结果**: 201 Created
  - 返回 user 对象 (id, email, name, role="operator", company_id)
  - 返回 access_token
  - token_type="bearer"
- **优先级**: P0

### A-002 重复邮箱注册失败
- **前置条件**: 邮箱已注册
- **测试步骤**:
  1. POST /api/v1/auth/register 使用已存在的邮箱
- **预期结果**: 409 Conflict
  - error.code="EMAIL_EXISTS"
  - error.message="邮箱已被注册"
- **优先级**: P0

### A-003 注册密码过短
- **前置条件**: 无
- **测试步骤**:
  1. POST /api/v1/auth/register，password="abc"
- **预期结果**: 422 Unprocessable Entity
  - 验证错误：密码最小长度为8
- **优先级**: P0

### A-004 注册缺失必填字段
- **前置条件**: 无
- **测试步骤**:
  1. POST /api/v1/auth/register，仅提供 email
- **预期结果**: 422 Unprocessable Entity
  - 缺少 password, name, company_name
- **优先级**: P0

### A-005 用户登录成功
- **前置条件**: 用户已注册
- **测试步骤**:
  1. POST /api/v1/auth/login
  ```json
  {
    "email": "existing@example.com",
    "password": "correctpassword"
  }
  ```
- **预期结果**: 200 OK
  - 返回 user 和 access_token
- **优先级**: P0

### A-006 登录密码错误
- **前置条件**: 用户已注册
- **测试步骤**:
  1. POST /api/v1/auth/login 使用错误密码
- **预期结果**: 401 Unauthorized
  - error.code="INVALID_CREDENTIALS"
- **优先级**: P0

### A-007 登录不存在的邮箱
- **前置条件**: 无
- **测试步骤**:
  1. POST /api/v1/auth/login 使用不存在的邮箱
- **预期结果**: 401 Unauthorized
  - error.code="INVALID_CREDENTIALS"
- **优先级**: P0

### A-008 密码重置请求成功
- **前置条件**: 用户已注册
- **测试步骤**:
  1. POST /api/v1/auth/reset-password
  ```json
  {
    "email": "existing@example.com"
  }
  ```
- **预期结果**: 200 OK
  - message="密码重置邮件已发送"
- **优先级**: P2

### A-009 Token 过期/无效访问
- **前置条件**: 无
- **测试步骤**:
  1. GET /api/v1/job-requirements 携带无效/过期 Token
- **预期结果**: 401 Unauthorized
- **优先级**: P0

### A-010 未认证访问受保护资源
- **前置条件**: 无
- **测试步骤**:
  1. GET /api/v1/job-requirements 不携带 Authorization header
- **预期结果**: 401 Unauthorized
- **优先级**: P0

---

## B. 岗位需求管理 (Job Requirements)

### B-001 创建岗位成功
- **前置条件**: 用户已登录
- **测试步骤**:
  1. POST /api/v1/job-requirements
  ```json
  {
    "title": "Python开发工程师",
    "description": "负责后端开发",
    "criteria": {
      "required_skills": ["Python", "FastAPI"],
      "min_experience_years": 3,
      "education": "bachelor"
    }
  }
  ```
- **预期结果**: 201 Created
  - 返回岗位对象，status="draft"
  - resume_count=0, analyzed_count=0
- **优先级**: P0

### B-002 创建岗位标题为空
- **前置条件**: 用户已登录
- **测试步骤**:
  1. POST /api/v1/job-requirements，title=""
- **预期结果**: 422 Unprocessable Entity
- **优先级**: P0

### B-003 从模板创建岗位
- **前置条件**: 用户已登录，模板已存在
- **测试步骤**:
  1. POST /api/v1/job-requirements
  ```json
  {
    "title": "岗位A",
    "template_id": "template-uuid"
  }
  ```
- **预期结果**: 201 Created
  - criteria 从模板复制
- **优先级**: P1

### B-004 获取岗位列表（全部）
- **前置条件**: 用户已登录，有多个岗位
- **测试步骤**:
  1. GET /api/v1/job-requirements?page=1&per_page=20
- **预期结果**: 200 OK
  - 返回 items, total, page, per_page
  - 每项包含 resume_count, analyzed_count
- **优先级**: P0

### B-005 获取岗位列表（状态筛选-draft）
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/job-requirements?status=draft
- **预期结果**: 200 OK
  - 仅返回 draft 状态的岗位
- **优先级**: P0

### B-006 获取岗位列表（状态筛选-active）
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/job-requirements?status=active
- **预期结果**: 200 OK
  - 仅返回 active 状态的岗位
- **优先级**: P0

### B-007 获取岗位列表（状态筛选-closed）
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/job-requirements?status=closed
- **预期结果**: 200 OK
  - 仅返回 closed 状态的岗位
- **优先级**: P0

### B-008 获取岗位列表（分页）
- **前置条件**: 用户已登录，有25个岗位
- **测试步骤**:
  1. GET /api/v1/job-requirements?page=2&per_page=10
- **预期结果**: 200 OK
  - 返回第2页的10条记录
  - total=25
- **优先级**: P1

### B-009 获取岗位详情
- **前置条件**: 用户已登录，岗位存在
- **测试步骤**:
  1. GET /api/v1/job-requirements/{job_id}
- **预期结果**: 200 OK
  - 返回完整岗位信息及统计
- **优先级**: P0

### B-010 获取不存在岗位详情
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/job-requirements/{invalid_id}
- **预期结果**: 404 Not Found
  - error.code="NOT_FOUND"
- **优先级**: P0

### B-011 更新岗位成功
- **前置条件**: 用户已登录，draft 状态岗位
- **测试步骤**:
  1. PATCH /api/v1/job-requirements/{job_id}
  ```json
  {
    "title": "更新后的标题",
    "description": "新描述"
  }
  ```
- **预期结果**: 200 OK
  - 返回更新后的岗位信息
- **优先级**: P0

### B-012 更新 active 状态岗位
- **前置条件**: 用户已登录，active 状态岗位
- **测试步骤**:
  1. PATCH /api/v1/job-requirements/{job_id} 修改 criteria
- **预期结果**: 200 OK（允许更新）
- **优先级**: P1

### B-013 激活岗位成功
- **前置条件**: 用户已登录，draft 状态岗位，criteria 非空
- **测试步骤**:
  1. POST /api/v1/job-requirements/{job_id}/activate
- **预期结果**: 200 OK
  - status="active"
- **优先级**: P0

### B-014 激活岗位-criteria为空
- **前置条件**: 用户已登录，draft 状态岗位，criteria 为空
- **测试步骤**:
  1. POST /api/v1/job-requirements/{job_id}/activate
- **预期结果**: 422 Unprocessable Entity
  - error.code="EMPTY_CRITERIA"
  - error.message="激活失败：筛选条件不能为空"
- **优先级**: P0

### B-015 关闭岗位成功
- **前置条件**: 用户已登录，active 状态岗位
- **测试步骤**:
  1. POST /api/v1/job-requirements/{job_id}/close
- **预期结果**: 200 OK
  - status="closed"
- **优先级**: P0

### B-016 复制岗位成功
- **前置条件**: 用户已登录，岗位存在
- **测试步骤**:
  1. POST /api/v1/job-requirements/{job_id}/copy
- **预期结果**: 201 Created
  - 返回新岗位，title后缀"(复制)"
  - status="draft"
  - resume_count=0
- **优先级**: P1

### B-017 删除 draft 岗位成功
- **前置条件**: 用户已登录，draft 状态岗位
- **测试步骤**:
  1. DELETE /api/v1/job-requirements/{job_id}
- **预期结果**: 204 No Content
- **优先级**: P0

### B-018 删除 active 岗位失败
- **前置条件**: 用户已登录，active 状态岗位
- **测试步骤**:
  1. DELETE /api/v1/job-requirements/{job_id}
- **预期结果**: 400 Bad Request
  - error.code="CANNOT_DELETE"
  - error.message="无法删除该岗位需求（仅 draft 状态可删除）"
- **优先级**: P0

### B-019 删除 closed 岗位失败
- **前置条件**: 用户已登录，closed 状态岗位
- **测试步骤**:
  1. DELETE /api/v1/job-requirements/{job_id}
- **预期结果**: 400 Bad Request
- **优先级**: P0

### B-020 多租户隔离（A公司看不到B公司岗位）
- **前置条件**: 两个公司用户
- **测试步骤**:
  1. 公司A用户登录
  2. GET /api/v1/job-requirements
  3. 公司B用户登录
  4. GET /api/v1/job-requirements
- **预期结果**: 各自只能看到自己公司的岗位
- **优先级**: P0

### B-021 获取其他公司岗位详情失败
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/job-requirements/{other_company_job_id}
- **预期结果**: 404 Not Found
- **优先级**: P0

---

## C. 简历上传和管理 (Resumes)

### C-001 单文件上传成功
- **前置条件**: 用户已登录，active 状态岗位
- **测试步骤**:
  1. POST /api/v1/resumes/upload
  - job_requirement_id: 岗位ID
  - files: [resume.pdf]
- **预期结果**: 202 Accepted
  - total_uploaded=1
  - uploaded 包含 resume 记录
  - parse_status="pending"
- **优先级**: P0

### C-002 批量上传成功（10个文件）
- **前置条件**: 用户已登录，active 状态岗位
- **测试步骤**:
  1. POST /api/v1/resumes/upload
  - files: [10个PDF]
- **预期结果**: 202 Accepted
  - total_uploaded=10
  - 触发10个解析任务
- **优先级**: P0

### C-003 上传无效文件格式
- **前置条件**: 用户已登录，active 状态岗位
- **测试步骤**:
  1. POST /api/v1/resumes/upload
  - files: [test.exe]
- **预期结果**: 202 Accepted
  - total_uploaded=0
  - total_failed=1
  - failed 包含错误信息
- **优先级**: P0

### C-004 上传到已关闭的岗位
- **前置条件**: 用户已登录，closed 状态岗位
- **测试步骤**:
  1. POST /api/v1/resumes/upload
  - job_requirement_id: closed岗位ID
- **预期结果**: 400 Bad Request
  - error.code="INVALID_JOB_STATUS"
  - error.message="仅活跃状态的岗位可上传简历"
- **优先级**: P0

### C-005 上传到不存在的岗位
- **前置条件**: 用户已登录
- **测试步骤**:
  1. POST /api/v1/resumes/upload
  - job_requirement_id: invalid_id
- **预期结果**: 404 Not Found
- **优先级**: P0

### C-006 超量文件上传（>100）
- **前置条件**: 用户已登录，active 状态岗位
- **测试步骤**:
  1. POST /api/v1/resumes/upload
  - files: [101个PDF]
- **预期结果**: 400 Bad Request
  - error.code="TOO_MANY_FILES"
  - error.message="最多支持100个文件"
- **优先级**: P1

### C-007 超大文件上传（>20MB）
- **前置条件**: 用户已登录，active 状态岗位
- **测试步骤**:
  1. POST /api/v1/resumes/upload
  - files: [25MB的PDF]
- **预期结果**: 202 Accepted
  - total_failed=1
  - 失败原因包含文件大小限制
- **优先级**: P1

### C-008 获取简历列表
- **前置条件**: 用户已登录，岗位有简历
- **测试步骤**:
  1. GET /api/v1/resumes?job_requirement_id={job_id}
- **预期结果**: 200 OK
  - 返回分页的简历列表
  - 包含 candidate_name, parse_status
- **优先级**: P0

### C-009 获取简历列表（按解析状态筛选）
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/resumes?job_requirement_id={job_id}&parse_status=success
- **预期结果**: 200 OK
  - 仅返回解析成功的简历
- **优先级**: P1

### C-010 获取简历列表（按解析状态筛选-failed）
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/resumes?job_requirement_id={job_id}&parse_status=failed
- **预期结果**: 200 OK
  - 仅返回解析失败的简历
- **优先级**: P1

### C-011 获取简历列表（分页）
- **前置条件**: 用户已登录，岗位有50份简历
- **测试步骤**:
  1. GET /api/v1/resumes?job_requirement_id={job_id}&page=2&per_page=20
- **预期结果**: 200 OK
  - 返回第2页20条记录
- **优先级**: P1

### C-012 获取简历详情
- **前置条件**: 用户已登录，简历存在
- **测试步骤**:
  1. GET /api/v1/resumes/{resume_id}
- **预期结果**: 200 OK
  - 返回完整简历信息
  - 包含 parsed_data, candidate_name
  - file_url 可下载
- **优先级**: P0

### C-013 获取不存在简历详情
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/resumes/{invalid_id}
- **预期结果**: 404 Not Found
- **优先级**: P0

### C-014 下载简历文件
- **前置条件**: 用户已登录，简历文件存在
- **测试步骤**:
  1. GET /api/v1/resumes/{resume_id}/file
- **预期结果**: 200 OK
  - Content-Type 正确
  - 文件可下载
- **优先级**: P1

### C-015 删除简历成功
- **前置条件**: 用户已登录，简历存在
- **测试步骤**:
  1. DELETE /api/v1/resumes/{resume_id}
- **预期结果**: 204 No Content
  - 文件被删除
  - 分析结果被级联删除
- **优先级**: P0

### C-016 删除其他公司简历失败
- **前置条件**: 用户已登录
- **测试步骤**:
  1. DELETE /api/v1/resumes/{other_company_resume_id}
- **预期结果**: 404 Not Found
- **优先级**: P0

### C-017 多租户隔离（A公司看不到B公司简历）
- **前置条件**: 两个公司用户
- **测试步骤**:
  1. 公司A用户获取岗位简历
  2. 公司B用户获取岗位简历
- **预期结果**: 各自只能看到自己公司的简历
- **优先级**: P0

---

## D. AI 分析 (Analysis)

### D-001 获取分析结果列表
- **前置条件**: 用户已登录，岗位有分析结果
- **测试步骤**:
  1. GET /api/v1/analysis?job_requirement_id={job_id}
- **预期结果**: 200 OK
  - 返回分页的分析列表
  - 包含 statistics（统计数据）
  - 包含维度评分
- **优先级**: P0

### D-002 分析结果排序（按总分降序）
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/analysis?job_requirement_id={job_id}&sort_by=overall_score&sort_order=desc
- **预期结果**: 200 OK
  - 结果按 overall_score 降序排列
- **优先级**: P0

### D-003 分析结果排序（按总分升序）
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/analysis?job_requirement_id={job_id}&sort_order=asc
- **预期结果**: 200 OK
  - 结果按 overall_score 升序排列
- **优先级**: P1

### D-004 分析结果筛选（强烈推荐）
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/analysis?job_requirement_id={job_id}&recommendation=strongly_recommended
- **预期结果**: 200 OK
  - 仅返回强烈推荐的候选人
- **优先级**: P0

### D-005 分析结果筛选（推荐）
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/analysis?job_requirement_id={job_id}&recommendation=recommended
- **预期结果**: 200 OK
  - 仅返回推荐的候选人
- **优先级**: P0

### D-006 分析结果筛选（待定）
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/analysis?job_requirement_id={job_id}&recommendation=pending
- **预期结果**: 200 OK
  - 仅返回待定的候选人
- **优先级**: P0

### D-007 分析统计信息
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/analysis?job_requirement_id={job_id}
- **预期结果**: 200 OK
  - statistics 包含：
    - total_resumes: 总简历数
    - analyzed: 已分析数
    - pending: 待分析数
    - failed: 失败数
    - strongly_recommended: 强烈推荐数
    - recommended: 推荐数
    - average_score: 平均分
- **优先级**: P0

### D-008 获取分析详情
- **前置条件**: 用户已登录，分析存在
- **测试步骤**:
  1. GET /api/v1/analysis/{analysis_id}
- **预期结果**: 200 OK
  - 返回完整分析报告
  - 包含 dimension_scores（维度评分详情）
  - 包含 strengths（优势）和 weaknesses（劣势）
  - 包含 resume 和 job_requirement 完整信息
- **优先级**: P0

### D-009 获取不存在分析详情
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/analysis/{invalid_id}
- **预期结果**: 404 Not Found
- **优先级**: P0

### D-010 重新分析失败的结果
- **前置条件**: 用户已登录，分析状态为 failed
- **测试步骤**:
  1. POST /api/v1/analysis/{analysis_id}/retry
- **预期结果**: 202 Accepted
  - analysis_status="pending"
  - 重新触发分析任务
- **优先级**: P1

### D-011 重新分析已完成的结果
- **前置条件**: 用户已登录，分析状态为 completed
- **测试步骤**:
  1. POST /api/v1/analysis/{analysis_id}/retry
- **预期结果**: 202 Accepted
  - analysis_status="pending"
- **优先级**: P2

### D-012 候选人对比（2人）
- **前置条件**: 用户已登录，有两个已完成的分析
- **测试步骤**:
  1. GET /api/v1/analysis/compare?analysis_ids={id1},{id2}
- **预期结果**: 200 OK
  - 返回两位候选人的对比信息
  - 包含维度评分对比
  - 包含关键信息提取
- **优先级**: P0

### D-013 候选人对比（3人）
- **前置条件**: 用户已登录，有三个已完成的分析
- **测试步骤**:
  1. GET /api/v1/analysis/compare?analysis_ids={id1},{id2},{id3}
- **预期结果**: 200 OK
  - 返回三位候选人的对比信息
- **优先级**: P0

### D-014 候选人对比（1人失败）
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/analysis/compare?analysis_ids={id1}
- **预期结果**: 422 Unprocessable Entity
  - error.code="INVALID_COUNT"
  - error.message="仅支持2-3位候选人对比"
- **优先级**: P0

### D-015 候选人对比（4人失败）
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/analysis/compare?analysis_ids={id1},{id2},{id3},{id4}
- **预期结果**: 422 Unprocessable Entity
- **优先级**: P0

### D-016 导出分析结果为 XLSX
- **前置条件**: 用户已登录，有分析结果
- **测试步骤**:
  1. GET /api/v1/analysis/export?job_requirement_id={job_id}&format=xlsx
- **预期结果**: 200 OK
  - Content-Type: application/octet-stream
  - 文件名包含岗位标题
  - 文件可下载并打开
- **优先级**: P0

### D-017 导出分析结果为 CSV
- **前置条件**: 用户已登录，有分析结果
- **测试步骤**:
  1. GET /api/v1/analysis/export?job_requirement_id={job_id}&format=csv
- **预期结果**: 200 OK
  - Content-Type: text/csv
  - 文件可下载并打开
- **优先级**: P0

### D-018 导出筛选结果（仅强烈推荐）
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/analysis/export?job_requirement_id={job_id}&recommendation=strongly_recommended
- **预期结果**: 200 OK
  - 仅包含强烈推荐的候选人
- **优先级**: P1

### D-019 导出空结果
- **前置条件**: 用户已登录，岗位无分析结果
- **测试步骤**:
  1. GET /api/v1/analysis/export?job_requirement_id={job_id}
- **预期结果**: 200 OK
  - 返回空表格（仅表头）
- **优先级**: P2

### D-020 多租户隔离（A公司看不到B公司分析）
- **前置条件**: 两个公司用户
- **测试步骤**:
  1. 公司A用户获取分析结果
  2. 公司B用户获取分析结果
- **预期结果**: 各自只能看到自己公司的分析结果
- **优先级**: P0

---

## E. 团队管理 (Companies)

### E-001 获取公司信息
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/companies/me
- **预期结果**: 200 OK
  - 返回公司信息（id, name, industry, created_at）
- **优先级**: P0

### E-002 获取成员列表（管理员）
- **前置条件**: 管理员用户登录
- **测试步骤**:
  1. GET /api/v1/companies/me/members
- **预期结果**: 200 OK
  - 返回成员列表
  - 每个成员包含 role, is_active, created_at
- **优先级**: P0

### E-003 获取成员列表（普通成员被禁止）
- **前置条件**: 普通操作员登录
- **测试步骤**:
  1. GET /api/v1/companies/me/members
- **预期结果**: 403 Forbidden
  - Admin access required
- **优先级**: P0

### E-004 邀请成员成功
- **前置条件**: 管理员登录
- **测试步骤**:
  1. POST /api/v1/companies/me/invite
  ```json
  {
    "email": "newmember@example.com",
    "name": "新成员",
    "role": "operator"
  }
  ```
- **预期结果**: 201 Created
  - 返回新用户信息
  - 包含临时密码 temp_password
- **优先级**: P0

### E-005 邀请成员（重复邮箱）
- **前置条件**: 管理员登录，成员已存在
- **测试步骤**:
  1. POST /api/v1/companies/me/invite 使用已存在邮箱
- **预期结果**: 409 Conflict
  - error.code="USER_EXISTS"
- **优先级**: P0

### E-006 邀请成员（邮箱属于其他公司）
- **前置条件**: 管理员登录
- **测试步骤**:
  1. POST /api/v1/companies/me/invite 使用其他公司用户邮箱
- **预期结果**: 409 Conflict
  - error.code="USER_IN_OTHER_COMPANY"
- **优先级**: P0

### E-007 邀请成员（无效角色）
- **前置条件**: 管理员登录
- **测试步骤**:
  1. POST /api/v1/companies/me/invite
  ```json
  {
    "email": "test@example.com",
    "name": "Test",
    "role": "invalid_role"
  }
  ```
- **预期结果**: 422 Unprocessable Entity
  - error.code="INVALID_ROLE"
- **优先级**: P0

### E-008 邀请成员（普通成员被禁止）
- **前置条件**: 普通操作员登录
- **测试步骤**:
  1. POST /api/v1/companies/me/invite
- **预期结果**: 403 Forbidden
- **优先级**: P0

### E-009 修改成员角色成功
- **前置条件**: 管理员登录
- **测试步骤**:
  1. PATCH /api/v1/companies/me/members/{user_id}
  ```json
  {
    "role": "admin"
  }
  ```
- **预期结果**: 200 OK
  - 返回更新后的用户角色
- **优先级**: P0

### E-010 不能修改自己的角色
- **前置条件**: 管理员登录
- **测试步骤**:
  1. PATCH /api/v1/companies/me/members/{self_user_id}
- **预期结果**: 403 Forbidden
  - error.code="CANNOT_MODIFY_SELF"
- **优先级**: P0

### E-011 修改成员角色（普通成员被禁止）
- **前置条件**: 普通操作员登录
- **测试步骤**:
  1. PATCH /api/v1/companies/me/members/{user_id}
- **预期结果**: 403 Forbidden
- **优先级**: P0

### E-012 移除成员成功
- **前置条件**: 管理员登录
- **测试步骤**:
  1. DELETE /api/v1/companies/me/members/{user_id}
- **预期结果**: 204 No Content
  - 用户 is_active=False
- **优先级**: P0

### E-013 不能移除自己
- **前置条件**: 管理员登录
- **测试步骤**:
  1. DELETE /api/v1/companies/me/members/{self_user_id}
- **预期结果**: 403 Forbidden
  - error.code="CANNOT_REMOVE_SELF"
- **优先级**: P0

### E-014 移除成员（普通成员被禁止）
- **前置条件**: 普通操作员登录
- **测试步骤**:
  1. DELETE /api/v1/companies/me/members/{user_id}
- **预期结果**: 403 Forbidden
- **优先级**: P0

---

## F. 端到端业务流程

### F-001 完整招聘流程
- **前置条件**: 无
- **测试步骤**:
  1. 用户注册新账号
  2. 登录系统
  3. 创建岗位需求
  4. 填写筛选条件并激活岗位
  5. 批量上传简历
  6. 等待 AI 分析完成
  7. 查看分析结果列表
  8. 查看候选人详情
  9. 对比两位候选人
  10. 导出分析结果为 XLSX
- **预期结果**: 全流程无错误
  - 简历正确解析
  - 分析结果正确生成
  - 导出文件可正常打开
- **优先级**: P0

### F-002 管理员邀请操作员协作
- **前置条件**: 管理员已登录
- **测试步骤**:
  1. 管理员邀请操作员
  2. 记录临时密码
  3. 操作员登录
  4. 操作员创建岗位
  5. 操作员上传简历
  6. 管理员查看操作员创建的内容
- **预期结果**:
  - 邀请成功，操作员可登录
  - 操作员能创建和上传
  - 管理员能看到所有内容
- **优先级**: P0

### F-003 操作员权限边界
- **前置条件**: 操作员已登录
- **测试步骤**:
  1. 操作员尝试访问成员管理页面
  2. 操作员尝试邀请成员
  3. 操作员尝试修改他人角色
- **预期结果**:
  - 所有操作返回 403 Forbidden
- **优先级**: P0

### F-004 岗位状态流转
- **前置条件**: 用户已登录
- **测试步骤**:
  1. 创建岗位（状态：draft）
  2. 编辑岗位 criteria
  3. 激活岗位（状态：active）
  4. 上传简历
  5. 尝试编辑岗位（应被允许或禁止）
  6. 关闭岗位（状态：closed）
  7. 尝试上传简历（应失败）
- **预期结果**:
  - draft → active → closed 流转正确
  - closed 状态不能上传简历
- **优先级**: P0

### F-005 多公司数据隔离
- **前置条件**: 两个公司用户
- **测试步骤**:
  1. 公司A用户创建岗位和上传简历
  2. 公司B用户登录
  3. 公司B用户尝试访问公司A的岗位ID
  4. 公司B用户尝试访问公司A的简历ID
  5. 公司B用户尝试访问公司A的分析ID
- **预期结果**:
  - 公司B用户无法访问公司A的任何资源
  - 所有跨公司访问返回 404
- **优先级**: P0

---

## G. 错误处理和边界条件

### G-001 无效 JWT Token 格式
- **前置条件**: 无
- **测试步骤**:
  1. GET /api/v1/job-requirements
  - Authorization: "Bearer invalid-token"
- **预期结果**: 401 Unauthorized
- **优先级**: P0

### G-002 缺少 Authorization Header
- **前置条件**: 无
- **测试步骤**:
  1. GET /api/v1/job-requirements（不带 Authorization）
- **预期结果**: 401 Unauthorized
- **优先级**: P0

### G-003 Token 过期
- **前置条件**: 生成过期的 Token
- **测试步骤**:
  1. 使用过期 Token 访问 API
- **预期结果**: 401 Unauthorized
- **优先级**: P0

### G-004 无效的 UUID 格式
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/job-requirements/not-a-uuid
- **预期结果**: 422 Unprocessable Entity
- **优先级**: P1

### G-005 分页参数超出范围
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/job-requirements?page=999
  2. GET /api/v1/job-requirements?per_page=999
- **预期结果**: 200 OK
  - 返回空列表或最后一页数据
- **优先级**: P2

### G-006 负分页参数
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/job-requirements?page=-1
- **预期结果**: 422 Unprocessable Entity
- **优先级**: P2

### G-007 特殊字符注入
- **前置条件**: 用户已登录
- **测试步骤**:
  1. POST /api/v1/job-requirements
  ```json
  {
    "title": "<script>alert('xss')</script>",
    "description": "'; DROP TABLE users; --"
  }
  ```
- **预期结果**:
  - 请求成功（但字符被转义或拒绝）
  - 数据库未受影响
- **优先级**: P1

### G-008 SQL 注入尝试
- **前置条件**: 用户已登录
- **测试步骤**:
  1. GET /api/v1/job-requirements?title=' OR '1'='1
- **预期结果**:
  - 不会返回所有记录
  - 参数被正确处理
- **优先级**: P1

### G-009 并发上传相同简历
- **前置条件**: 用户已登录
- **测试步骤**:
  1. 同时发起 10 个相同文件的上传请求
- **预期结果**:
  - 所有请求都成功
  - 创建 10 条独立的简历记录
- **优先级**: P2

### G-010 网络超时处理
- **前置条件**: 模拟慢网络
- **测试步骤**:
  1. 上传大文件时网络中断
- **预期结果**:
  - 适当的错误处理
  - 不创建部分记录
- **优先级**: P2

---

## H. 前端交互测试

### H-001 前端登录页面
- **前置条件**: 浏览器访问 http://localhost:3004/login
- **测试步骤**:
  1. 输入正确邮箱和密码
  2. 点击登录按钮
- **预期结果**:
  - 登录成功后跳转到 /dashboard
  - 顶部导航栏显示用户名
- **优先级**: P0

### H-002 前端登录失败提示
- **前置条件**: 浏览器访问登录页
- **测试步骤**:
  1. 输入错误密码
  2. 点击登录
- **预期结果**:
  - 显示错误提示信息
  - 不跳转页面
- **优先级**: P0

### H-003 岗位管理页面
- **前置条件**: 用户已登录
- **测试步骤**:
  1. 访问 /dashboard/jobs
  2. 点击"新建岗位"
  3. 填写表单并提交
  4. 在列表中查看新岗位
- **预期结果**:
  - 岗位创建成功
  - 列表自动刷新显示新数据
- **优先级**: P0

### H-004 岗位状态切换
- **前置条件**: 用户已登录，有 draft 状态岗位
- **测试步骤**:
  1. 在岗位列表点击操作菜单
  2. 点击"激活"
- **预期结果**:
  - 状态变为"进行中"
  - 列表自动刷新
- **优先级**: P0

### H-005 简历上传页面
- **前置条件**: 用户已登录，有 active 状态岗位
- **测试步骤**:
  1. 访问 /dashboard/resumes/upload
  2. 选择岗位
  3. 拖拽/选择文件上传
  4. 查看上传进度
- **预期结果**:
  - 文件成功上传
  - 显示上传结果（成功/失败）
- **优先级**: P0

### H-006 分析看板页面
- **前置条件**: 用户已登录，有分析结果
- **测试步骤**:
  1. 访问 /dashboard/analysis
  2. 选择岗位
  3. 查看统计数据卡片
  4. 查看候选人列表
  5. 点击排序
  6. 切换推荐等级筛选
- **预期结果**:
  - 统计数据正确显示
  - 列表正确排序和筛选
- **优先级**: P0

### H-007 候选人详情页面
- **前置条件**: 用户已登录
- **测试步骤**:
  1. 在分析看板点击候选人姓名
  2. 查看详情页面（评分、优势、劣势、维度详情）
- **预期结果**:
  - 完整显示分析报告
  - 各维度评分可视化展示
- **优先级**: P0

### H-008 候选人对比功能
- **前置条件**: 用户已登录
- **测试步骤**:
  1. 在分析看板选择2-3位候选人
  2. 点击"对比候选人"按钮
  3. 查看对比页面
- **预期结果**:
  - 显示对比表格
  - 各维度并排展示
- **优先级**: P0

### H-009 导出功能
- **前置条件**: 用户已登录
- **测试步骤**:
  1. 在分析看板点击"导出"下拉菜单
  2. 选择"导出 Excel"
  3. 验证下载文件
- **预期结果**:
  - 文件成功下载
  - 内容完整可读
- **优先级**: P0

### H-010 团队管理页面
- **前置条件**: 管理员已登录
- **测试步骤**:
  1. 访问 /dashboard/team
  2. 查看成员列表
  3. 点击"邀请新成员"
  4. 填写表单并提交
- **预期结果**:
  - 成员列表正确显示
  - 邀请成功后列表更新
- **优先级**: P0

### H-011 权限控制（普通成员）
- **前置条件**: 普通操作员登录
- **测试步骤**:
  1. 尝试访问 /dashboard/team
- **预期结果**:
  - 显示权限不足提示
  - 或自动跳转回首页
- **优先级**: P0

### H-012 响应式布局
- **前置条件**: 用户已登录
- **测试步骤**:
  1. 在不同屏幕尺寸下查看（手机、平板、桌面）
- **预期结果**:
  - 布局自适应
  - 功能正常可用
- **优先级**: P1

---

## 测试数据准备

### 标准测试账号
- **管理员**: admin@test.com / Test123456
- **操作员**: operator@test.com / Test123456
- **其他公司**: other@test.com / Test123456

### 测试简历文件
- valid_resume.pdf - 有效简历（PDF格式）
- valid_resume.docx - 有效简历（Word格式）
- valid_resume.jpg - 有效简历（图片格式）
- invalid.exe - 无效文件
- large_file.pdf - 25MB大文件
- corrupted.pdf - 损坏的PDF文件

### 测试岗位数据
- 软件工程师（criteria 完整）
- 产品经理（criteria 最小）
- 设计师（criteria 空对象）

---

## 测试执行检查清单

### P0 用例（必须全部通过）
- [ ] A-001 至 A-010（认证流程）
- [ ] B-001, B-002, B-004 至 B-011, B-013, B-015, B-017 至 B-021（岗位管理）
- [ ] C-001 至 C-006, C-008, C-010, C-012, C-015 至 C-017（简历管理）
- [ ] D-001, D-002, D-004 至 D-009, D-012 至 D-016, D-020（AI分析）
- [ ] E-001 至 E-003, E-004, E-005, E-009, E-010, E-012, E-013（团队管理）
- [ ] F-001 至 F-005（端到端流程）
- [ ] G-001 至 G-003, G-007（错误处理）
- [ ] H-001 至 H-009, H-011（前端交互）

### P1 用例（重要）
- [ ] B-003, B-008
- [ ] C-007, C-009, C-011, C-014
- [ ] D-003, D-010, D-018
- [ ] G-004, G-005, G-008
- [ ] H-010, H-012

### P2 用例（次要）
- [ ] A-008
- [ ] D-011, D-019
- [ ] G-006, G-009, G-010

---

## 附录：错误代码参考

| 错误代码 | HTTP状态码 | 说明 |
|---------|-----------|------|
| EMAIL_EXISTS | 409 | 邮箱已被注册 |
| INVALID_CREDENTIALS | 401 | 邮箱或密码错误 |
| NOT_FOUND | 404 | 资源不存在 |
| CANNOT_DELETE | 400 | 无法删除（状态限制） |
| EMPTY_CRITERIA | 422 | 筛选条件为空 |
| INVALID_JOB_STATUS | 400 | 岗位状态不满足操作要求 |
| TOO_MANY_FILES | 400 | 文件数量超过限制 |
| INVALID_COUNT | 422 | 数量不符合要求（如候选人对比） |
| INVALID_ROLE | 422 | 角色无效 |
| USER_EXISTS | 409 | 用户已存在 |
| USER_IN_OTHER_COMPANY | 409 | 用户属于其他公司 |
| CANNOT_MODIFY_SELF | 403 | 不能修改自己 |
| CANNOT_REMOVE_SELF | 403 | 不能移除自己 |
| FILE_NOT_FOUND | 404 | 文件不存在 |
