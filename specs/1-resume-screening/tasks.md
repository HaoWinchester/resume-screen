# Tasks: HR 简历智能筛查系统

**Branch**: `1-resume-screening`
**Created**: 2026-04-17
**Status**: Ready

---

## Implementation Strategy

采用 **MVP 优先、增量交付** 策略：

1. 先搭建基础设施和认证系统（Phase 1-2）
2. 按用户故事优先级逐步交付：岗位管理 → 简历上传 → AI 分析 → 推荐导出 → 团队管理
3. 每个用户故事完成后可独立演示和测试
4. 前后端任务可并行开发，通过 API 合约解耦

**建议 MVP 范围**: Phase 1 + Phase 2 + Phase 3（US1 岗位管理），完成后即可演示完整的岗位创建流程。

## Dependencies

```
Phase 1 (Setup)
  └→ Phase 2 (Foundational)
       ├→ Phase 3 [US1] 岗位需求管理
       │     └→ Phase 4 [US2] 批量上传简历
       │           └→ Phase 5 [US3] AI 分析与评分
       │                 └→ Phase 6 [US4] 推荐与导出
       └→ Phase 7 [US5] 团队管理（可与 Phase 3-6 并行）
```

**关键依赖链**: 岗位需求 → 简历上传 → AI 分析 → 推荐导出（必须顺序完成）

## Parallel Execution

以下任务组可并行执行：
- Phase 1 中 T001-T003（后端初始化）与 T004-T005（前端初始化）可并行
- Phase 2 中后端认证任务与前端认证页面可并行（通过合约先行解耦）
- Phase 3-6 中每个 Phase 内的后端和前端任务可并行
- Phase 7（团队管理）可与 Phase 3-6 完全并行

---

## Tasks

### Phase 1: Setup（项目初始化）

**Goal**: 创建项目骨架，搭建开发环境，配置 Docker Compose

- [ ] T001 Create monorepo project structure with `backend/`, `frontend/`, `specs/` directories and root `docker-compose.yml` per quickstart.md
- [ ] T002 [P] Initialize Python backend project with FastAPI in `backend/` — create `app/main.py`, `app/config.py`, `app/database.py`, and `requirements.txt` with dependencies (fastapi, uvicorn, sqlalchemy, asyncpg, alembic, celery, redis, python-jose, passlib, anthropic, openai, pymupdf, python-docx, pytesseract, pydantic, python-multipart, openpyxl)
- [ ] T003 [P] Initialize Next.js frontend project with App Router in `frontend/` — install dependencies (next, react, antd, @ant-design/icons, axios, zustand, recharts) and configure TypeScript, Tailwind CSS in `frontend/`
- [ ] T004 Configure Docker Compose in `docker-compose.yml` with services: backend (FastAPI), frontend (Next.js), postgres, redis, celery-worker; include volume mounts for development and `backend/.env.example`
- [ ] T005 [P] Create environment configuration files — `backend/.env.example` (DATABASE_URL, REDIS_URL, SECRET_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY) and `frontend/.env.example` (NEXT_PUBLIC_API_URL)

### Phase 2: Foundational（基础架构 — 阻塞所有用户故事）

**Goal**: 实现数据库模型、认证系统和共享中间件，为所有用户故事提供基础

- [ ] T006 Create SQLAlchemy models for all 7 entities in `backend/app/models/` — `company.py` (Company), `user.py` (User), `job_template.py` (JobTemplate), `job_requirement.py` (JobRequirement), `resume.py` (Resume), `analysis_result.py` (AnalysisResult), `dimension_score.py` (DimensionScore) with relationships, indexes, and `__init__.py` re-export per data-model.md
- [ ] T007 Configure Alembic in `backend/alembic/` — initialize with `alembic.ini`, configure `env.py` to import all models, generate initial migration for all tables with indexes from data-model.md
- [ ] T008 Create Pydantic schemas in `backend/app/schemas/` — `auth.py` (RegisterRequest, LoginRequest, TokenResponse, UserResponse), `common.py` (PaginatedResponse, ErrorResponse) per contracts/api.md
- [ ] T009 Implement JWT authentication service in `backend/app/services/auth_service.py` — register (create company if not exists, create user with bcrypt hash), login (verify password, generate JWT), get_current_user, password reset stub
- [ ] T010 Implement auth API routes in `backend/app/api/auth.py` — POST /auth/register, POST /auth/login, POST /auth/reset-password with request validation and proper error handling per contracts/api.md section 1
- [ ] T011 Create authentication middleware in `backend/app/middleware/auth.py` — JWT token extraction from Authorization header, user loading with company context, role-based access decorator (require_admin)
- [ ] T012 Create shared API dependencies in `backend/app/api/deps.py` — get_db session, get_current_user with company isolation, get_pagination_params
- [ ] T013 [P] Create frontend API client in `frontend/src/lib/api.ts` — axios instance with base URL, JWT token interceptor (attach from localStorage), 401 redirect to login, error response parsing
- [ ] T014 [P] Create frontend auth store in `frontend/src/lib/auth.ts` — Zustand store for user state and token management (login, logout, register), persist token to localStorage
- [ ] T015 [P] Create frontend auth pages — login page in `frontend/src/app/login/page.tsx` and register page in `frontend/src/app/register/page.tsx` using Ant Design Form components with email/password/name/company_name fields
- [ ] T016 [P] Create frontend app layout in `frontend/src/app/layout.tsx` — root layout with Ant Design ConfigProvider (zh-CN locale), auth state check, redirect to login if unauthenticated; create dashboard layout in `frontend/src/app/dashboard/layout.tsx` with sidebar navigation (岗位管理, 简历上传, 分析看板, 团队管理)

### Phase 3: [US1] 岗位需求管理（Scenario 1 + FR-2 + FR-10）

**Goal**: HR 可以创建、编辑、删除岗位需求，定义筛选标准和权重，保存为模板

**Independent Test**: HR 登录后可以创建一个包含技能要求和权重的岗位需求，保存为模板，从模板创建新岗位

- [ ] T017 [US1] Create Pydantic schemas for job requirements in `backend/app/schemas/job_requirement.py` — JobRequirementCreate (title, description, template_id?, criteria with weights validation), JobRequirementUpdate (partial), JobRequirementResponse (with resume_count, analyzed_count), CriteriaSchema (required_skills, bonus_skills, min_experience_years, education, industry_preference, languages, weights, other_requirements) with weight enum validation (high/medium/low)
- [ ] T018 [US1] Create Pydantic schemas for job templates in `backend/app/schemas/job_template.py` — JobTemplateCreate (name, content), JobTemplateUpdate, JobTemplateResponse per contracts/api.md section 4
- [ ] T019 [US1] Implement JobRequirement service in `backend/app/services/job_requirement_service.py` — CRUD operations with company isolation, activate (validate criteria not empty), close, copy, save-as-template; weight calculation helper (high=3, medium=2, low=1)
- [ ] T020 [US1] Implement JobTemplate service in `backend/app/services/job_template_service.py` — CRUD with company isolation, create-from-job-requirement
- [ ] T021 [US1] Implement job requirement API routes in `backend/app/api/job_requirements.py` — GET /job-requirements (paginated, filter by status), POST /job-requirements, GET /job-requirements/{id}, PATCH /job-requirements/{id}, DELETE /job-requirements/{id} (draft only), POST /job-requirements/{id}/activate per contracts/api.md section 3
- [ ] T022 [US1] Implement job template API routes in `backend/app/api/job_templates.py` — GET /job-templates, POST /job-templates, PATCH /job-templates/{id}, DELETE /job-templates/{id} per contracts/api.md section 4
- [ ] T023 [US1] Register all new routers in `backend/app/main.py` — mount job_requirements and job_templates routers under /api/v1 with auth dependency
- [ ] T024 [P] [US1] Create TypeScript types in `frontend/src/types/job.ts` — JobRequirement, JobTemplate, Criteria, WeightConfig interfaces matching API schemas
- [ ] T025 [P] [US1] Create job API functions in `frontend/src/lib/api/job.ts` — fetchJobRequirements, createJobRequirement, updateJobRequirement, deleteJobRequirement, activateJobRequirement, fetchJobTemplates, createJobTemplate, updateJobTemplate, deleteJobTemplate
- [ ] T026 [US1] Create job list page in `frontend/src/app/dashboard/jobs/page.tsx` — Ant Design Table showing all job requirements with columns (title, status badge, resume count, created date), action buttons (edit, activate, close, delete), filter by status tabs, "New Job" button linking to creation form
- [ ] T027 [US1] Create job creation/edit form in `frontend/src/app/dashboard/jobs/new/page.tsx` and `frontend/src/app/dashboard/jobs/[id]/edit/page.tsx` — multi-step form: (1) basic info (title, description), (2) criteria (required_skills tag input, bonus_skills tag input, min_experience_years slider, education select, industry_preference select, languages tag input, other_requirements textarea), (3) weights (weight selector for each of 5 dimensions: skill_match, experience_match, education, project_relevance, overall_quality); option to save as template; option to load from template
- [ ] T028 [US1] Create template management modal component in `frontend/src/components/job/TemplateModal.tsx` — list templates, preview template content, select to apply, edit, delete

### Phase 4: [US2] 批量上传简历（Scenario 2 + FR-3）

**Goal**: HR 可以上传简历文件（PDF/Word/图片），系统自动解析提取候选人信息

**Independent Test**: HR 选择一个活跃的岗位需求，上传 10 份不同格式的简历，系统自动解析并展示解析结果

**Depends on**: Phase 3 完成岗位需求创建功能

- [ ] T029 [US2] Create Pydantic schemas for resumes in `backend/app/schemas/resume.py` — ResumeUploadResponse, ResumeListItem, ResumeDetail, ResumeListResponse with parse_status enum per contracts/api.md section 5
- [ ] T030 [US2] Implement file storage service in `backend/app/services/storage_service.py` — save file to local storage with directory structure `uploads/{company_id}/{job_requirement_id}/{resume_id}.{ext}`, validate file type (pdf/doc/docx/jpg/png), validate file size (max 20MB), generate file path, delete file
- [ ] T031 [US2] Implement resume parser service in `backend/app/services/resume_parser.py` — parse_pdf (PyMuPDF extract text), parse_docx (python-docx extract text and tables), parse_image (pytesseract OCR extract text), extract_structured_data (use regex/heuristics to extract name, email, phone, education, work_experience, skills, projects from raw text), return parsed_data JSONB per data-model.md
- [ ] T032 [US2] Configure Celery in `backend/app/worker.py` — Celery app with Redis broker, configure task serialization, create task for resume parsing `backend/app/tasks/parse_resume.py` (update parse_status: pending→parsing→success/failed, call resume_parser, save parsed_data, extract candidate_name/email/phone, trigger analysis task on success)
- [ ] T033 [US2] Implement resume upload API in `backend/app/api/resumes.py` — POST /resumes/upload (multipart, validate job_requirement_id exists and is active, validate file count ≤100, save files, create Resume records with pending status, dispatch Celery parse tasks, return 202 with upload summary), GET /resumes (paginated, filter by job_requirement_id and parse_status), GET /resumes/{id} (with parsed_data), GET /resumes/{id}/file (stream file), DELETE /resumes/{id} per contracts/api.md section 5
- [ ] T034 [US2] Add async task status endpoint in `backend/app/api/tasks.py` — GET /tasks/{task_id} to track batch parsing/analysis progress per contracts/api.md section 7
- [ ] T035 [US2] Register resume and task routers in `backend/app/main.py`
- [ ] T036 [P] [US2] Create TypeScript types in `frontend/src/types/resume.ts` — Resume, ResumeUploadResult, ParseStatus type, ParsedData interface
- [ ] T037 [P] [US2] Create resume API functions in `frontend/src/lib/api/resume.ts` — uploadResumes (multipart/form-data), fetchResumes, fetchResumeDetail, deleteResume, fetchTaskStatus
- [ ] T038 [US2] Create resume upload page in `frontend/src/app/dashboard/resumes/upload/page.tsx` — Ant Design Upload.Dragger for multi-file drag-and-drop, job requirement selector dropdown, upload progress bar (per-file and overall), upload result summary (success count, failed count with error messages), link to view uploaded resumes
- [ ] T039 [US2] Create resume list page in `frontend/src/app/dashboard/resumes/page.tsx` — Ant Design Table with columns (candidate name, email, file name, parse status badge, upload date), filter by job requirement selector, filter by parse status tabs (all/success/failed/pending), click row to view detail, delete action

### Phase 5: [US3] AI 分析与评分排名（Scenario 3 + FR-4 + FR-5 + FR-7）

**Goal**: 系统自动对简历进行多维度 AI 分析，展示评分排名和详细分析报告

**Independent Test**: 上传简历后系统自动完成 AI 分析，HR 可查看所有简历的评分排名，点击查看详细报告

**Depends on**: Phase 4 完成简历上传和解析

- [ ] T040 [US3] Create Pydantic schemas for analysis in `backend/app/schemas/analysis.py` — AnalysisListItem (with dimension_scores, recommendation), AnalysisDetail (with strengths, weaknesses, match_details, resume, job_requirement), AnalysisStatistics, AnalysisListResponse with statistics per contracts/api.md section 6
- [ ] T041 [US3] Implement AI analyzer service in `backend/app/services/ai_analyzer.py` — build_analysis_prompt (combine job criteria + resume parsed_data into structured prompt requesting JSON output with 5 dimension scores, analysis text, match details, strengths, weaknesses, recommendation), call_claude_api (primary), call_openai_api (fallback on failure), parse_ai_response (validate JSON structure, extract scores), calculate_overall_score (weighted average per data-model.md formula: Σ(score×weight_factor)/Σ(weight_factor))
- [ ] T042 [US3] Create Celery task for resume analysis in `backend/app/tasks/analyze_resume.py` — update analysis_status: pending→analyzing, call ai_analyzer with resume data and job requirement criteria, create AnalysisResult record with overall_score, create DimensionScore records for each dimension, calculate recommendation level (top 10% strongly_recommended, top 10-30% recommended, rest pending), update analysis_status: completed/failed
- [ ] T043 [US3] Hook analysis trigger into parse success flow — after `parse_resume` task succeeds and parsed_data is valid, automatically dispatch `analyze_resume` Celery task; handle case where parse fails (mark analysis as failed)
- [ ] T044 [US3] Implement analysis API routes in `backend/app/api/analysis.py` — GET /analysis (paginated list with sort_by, sort_order, recommendation filter, statistics summary), GET /analysis/{id} (full detail with resume data, job requirement, dimension scores, strengths, weaknesses, match details), POST /analysis/{id}/retry (re-dispatch Celery task) per contracts/api.md section 6
- [ ] T045 [US3] Register analysis router in `backend/app/main.py`
- [ ] T046 [P] [US3] Create TypeScript types in `frontend/src/types/analysis.ts` — AnalysisResult, DimensionScore, AnalysisDetail, AnalysisStatistics, RecommendationLevel type
- [ ] T047 [P] [US3] Create analysis API functions in `frontend/src/lib/api/analysis.ts` — fetchAnalysisList, fetchAnalysisDetail, retryAnalysis
- [ ] T048 [US3] Create analysis dashboard page in `frontend/src/app/dashboard/analysis/page.tsx` — job requirement selector at top, statistics cards (total resumes, analyzed, strongly recommended count, average score), Ant Design Table with columns (rank, candidate name, overall score with progress bar, recommendation badge, dimension mini-scores), sortable by any dimension, filterable by recommendation level tabs, auto-refresh while analysis in progress (poll task status)
- [ ] T049 [US3] Create analysis detail page in `frontend/src/app/dashboard/analysis/[id]/page.tsx` — two-column layout: left side shows parsed resume content (structured sections for education, experience, skills, projects), right side shows analysis panel: overall score with gauge chart, dimension score cards (score + analysis text), strengths list (green tags), weaknesses list (red tags), match details table (matched/missing skills per job requirement); print button at top

### Phase 6: [US4] 推荐候选人与导出（Scenario 4 + FR-6 + FR-8 + FR-9）

**Goal**: HR 可以查看推荐候选人、对比候选人、导出分析结果

**Independent Test**: HR 在分析看板中看到推荐标记，选择 2-3 位候选人对比，导出 Excel 评分表

**Depends on**: Phase 5 完成 AI 分析

- [ ] T050 [US4] Implement candidate comparison API endpoint in `backend/app/api/analysis.py` — add GET /analysis/compare (accept analysis_ids comma-separated, validate 2-3 IDs, return candidates with dimension scores and key_info: experience_years, education, top_skills) per contracts/api.md section 6
- [ ] T051 [US4] Implement export service in `backend/app/services/export_service.py` — generate_xlsx (openpyxl: header row with candidate info + all dimension scores + overall score + recommendation, data rows sorted by score), generate_csv (same data as CSV format), stream file response
- [ ] T052 [US4] Add export API endpoint in `backend/app/api/analysis.py` — GET /analysis/export (accept job_requirement_id, format=xlsx|csv, optional recommendation filter, return file download) per contracts/api.md section 6
- [ ] T053 [P] [US4] Create TypeScript types and API functions for comparison and export in `frontend/src/types/analysis.ts` and `frontend/src/lib/api/analysis.ts` — CompareResponse, add fetchCandidateComparison, exportAnalysis functions
- [ ] T054 [US4] Add recommendation highlights to analysis dashboard in `frontend/src/app/dashboard/analysis/page.tsx` — highlight strongly_recommended rows with gold background, add recommendation reason tooltip, add "Export" button (format selector: xlsx/csv, optional recommendation filter checkbox)
- [ ] T055 [US4] Create candidate comparison page in `frontend/src/app/dashboard/analysis/compare/page.tsx` — checkbox selection on analysis table (2-3 candidates), "Compare" button opens comparison view with Recharts RadarChart for dimension scores, side-by-side key info table (experience years, education, core skills), score difference highlights

### Phase 7: [US5] 团队管理（Scenario 5 + FR-1 扩展）

**Goal**: HR 管理员可以邀请成员、管理角色、查看操作记录

**Independent Test**: 管理员邀请新成员，设置角色，在成员列表中看到新成员

**Depends on**: Phase 2（基础认证系统）

*Note: 此阶段可与 Phase 3-6 完全并行开发*

- [ ] T056 [US5] Create Pydantic schemas for company/team in `backend/app/schemas/company.py` — CompanyResponse, MemberListResponse, MemberItem, InviteRequest, UpdateRoleRequest per contracts/api.md section 2
- [ ] T057 [US5] Implement company/team service in `backend/app/services/company_service.py` — get_company_info, get_members (paginated, filtered by company), invite_member (create user with temp password, send email stub), update_member_role (admin only check)
- [ ] T058 [US5] Implement company/team API routes in `backend/app/api/companies.py` — GET /companies/me, GET /companies/me/members (admin required), POST /companies/me/invite (admin required), PATCH /companies/me/members/{user_id} (admin required) per contracts/api.md section 2
- [ ] T059 [US5] Register company router in `backend/app/main.py`
- [ ] T060 [P] [US5] Create TypeScript types and API functions for team in `frontend/src/types/team.ts` and `frontend/src/lib/api/team.ts` — Company, TeamMember, InvitePayload interfaces; fetchCompanyInfo, fetchMembers, inviteMember, updateMemberRole functions
- [ ] T061 [US5] Create team management page in `frontend/src/app/dashboard/team/page.tsx` — admin-only page (show 403 for operators), Ant Design Table with columns (name, email, role badge, status, join date), invite member modal (form with email, name, role selector), role change dropdown (admin/operator), member count summary card

### Final Phase: Polish & Cross-Cutting Concerns

**Goal**: 错误处理优化、重试机制、用户体验打磨

- [ ] T062 Add global error handling in `backend/app/main.py` — exception handlers for HTTPException, ValidationError, generic 500 errors returning standardized error format per contracts/api.md; add request logging middleware
- [ ] T063 Implement retry mechanism for failed analysis in `backend/app/tasks/analyze_resume.py` — on AI service failure, mark as failed with error message; support manual retry via POST /analysis/{id}/retry endpoint which re-dispatches the task; add max retry count (3) to prevent infinite loops
- [ ] T064 [P] Add loading states and error feedback across all frontend pages — Ant Design Spin/Skeleton components for data loading, error boundaries with retry buttons, toast notifications (Ant Message) for success/error operations (upload, save, export)
- [ ] T065 [P] Add responsive layout adjustments in `frontend/src/app/dashboard/layout.tsx` — sidebar collapsible on mobile, table scroll on small screens, upload area responsive sizing
- [ ] T066 Verify all API endpoints have proper company data isolation — review all service layer queries to ensure company_id filter is applied, test with multiple companies to confirm data isolation

### Testing Phase: 后端 API 测试 + 前端交互测试 + 整体流程测试

**Goal**: 功能全部完成后，编写完整的后端 API 单元/集成测试、前端交互测试和端到端流程测试，确保系统质量

**Depends on**: 所有功能 Phase (1-7) + Final Phase 全部完成

#### 后端 API 测试（pytest + httpx）

- [ ] T067 [P] Setup backend test infrastructure in `backend/tests/` — create `conftest.py` with fixtures: async test client (httpx AsyncClient), test database (PostgreSQL test DB with auto-create/drop), authenticated user fixture (with JWT token), admin user fixture, second company user fixture (for isolation testing), sample job requirement fixture (active status with full criteria), sample resume fixture (parsed and pending), mock AI response fixture; configure `pytest.ini` with asyncio mode
- [ ] T068 [P] Write auth API tests in `backend/tests/test_auth.py` — test_register_success (creates company + user, returns JWT, role is operator), test_register_duplicate_email (returns 409), test_register_missing_fields (returns 422), test_register_same_company_name (two users register with same company_name → both get same company_id), test_login_success (returns JWT with correct user info), test_login_wrong_password (returns 401), test_login_nonexistent_email (returns 401), test_reset_password (returns success message), test_token_expired (returns 401), test_token_invalid (returns 401)
- [ ] T069 [P] Write job requirement API tests in `backend/tests/test_job_requirements.py` — test_create_job_requirement (returns 201 with correct fields), test_create_with_template_id (copies criteria from template), test_list_job_requirements_paginated (verify page/per_page params work), test_list_job_requirements_filter_by_status (draft/active/closed), test_get_job_requirement_detail (includes criteria and weights), test_update_job_requirement (partial update), test_copy_job_requirement (creates duplicate with new id), test_delete_draft_job (returns 204), test_delete_active_job_forbidden (returns 400), test_activate_job (validates criteria not empty), test_activate_empty_criteria_fails (returns 422), test_close_job (status changes to closed), test_job_isolation_across_companies (company A cannot see company B's jobs), test_weights_validation_invalid_value (rejects weight value not in high/medium/low)
- [ ] T070 [P] Write job template API tests in `backend/tests/test_job_templates.py` — test_create_template, test_list_templates (filtered by company), test_update_template, test_delete_template, test_create_job_from_template (criteria pre-filled), test_template_isolation_across_companies, test_template_shared_within_company (all company members can view)
- [ ] T071 [P] Write resume upload API tests in `backend/tests/test_resumes.py` — test_upload_single_pdf (returns 202 with pending status), test_upload_single_doc (legacy .doc format), test_upload_single_docx (returns 202), test_upload_single_jpg (image resume), test_upload_single_png (image resume), test_upload_batch (multiple files, returns upload summary with total_uploaded and total_failed), test_upload_exceeds_100_files (returns 400), test_upload_invalid_format_txt (returns error), test_upload_file_too_large (returns 413 for >20MB), test_upload_to_draft_job (returns 400, only active jobs accept resumes), test_upload_to_closed_job (returns 400), test_list_resumes_paginated (verify page/per_page works), test_list_resumes_filter_by_parse_status, test_get_resume_detail (includes parsed_data and file_url), test_download_resume_file (GET /resumes/{id}/file returns correct content-type and file bytes), test_delete_resume (removes file and record), test_resume_isolation_across_companies
- [ ] T072 [P] Write resume parser service tests in `backend/tests/test_resume_parser.py` — test_parse_pdf_extracts_text, test_parse_doc_extracts_text (legacy .doc), test_parse_docx_extracts_text_and_tables, test_parse_jpg_ocr_extracts_text, test_parse_png_ocr_extracts_text, test_extract_name_from_text, test_extract_email_from_text, test_extract_phone_from_text, test_extract_skills_from_text, test_extract_education_from_text, test_extract_work_experience_from_text, test_extract_projects_from_text, test_parse_corrupted_file (returns parse error), test_parse_empty_file (returns parse error)
- [ ] T073 [P] Write AI analyzer service tests in `backend/tests/test_ai_analyzer.py` — test_build_analysis_prompt (includes job criteria and resume data), test_calculate_overall_score_weighted (high=3, medium=2, low=1, verify exact calculation), test_calculate_score_all_high_weights, test_calculate_score_mixed_weights, test_recommendation_level_strongly_recommended (top 10%), test_recommendation_level_recommended (top 10-30%), test_recommendation_level_pending (rest), test_recommendation_with_1_resume (edge: 1 resume → strongly_recommended), test_recommendation_with_3_resumes (edge: top 1 strongly_recommended), test_recommendation_with_50_resumes (5 strongly_recommended, 10 recommended), test_ai_service_fallback_to_openai (when Claude fails), test_parse_ai_response_valid_json, test_parse_ai_response_invalid_json (returns error), test_ai_response_score_range (all scores within 0-100)
- [ ] T074 [P] Write analysis API tests in `backend/tests/test_analysis.py` — test_list_analysis_results_paginated (verify page/per_page), test_list_analysis_sorted_by_overall_score_desc (default), test_list_analysis_sorted_by_specific_dimension (sort_by=skill_match), test_list_analysis_sorted_ascending (sort_order=asc), test_list_analysis_filtered_by_recommendation (strongly_recommended only), test_list_analysis_statistics (total_resumes, analyzed, pending, failed, strongly_recommended count, average_score), test_get_analysis_detail (includes strengths, weaknesses, match_details with matched_skills/missing_skills, resume parsed_data, job_requirement criteria), test_get_analysis_detail_match_details_per_dimension (each dimension has match_details), test_retry_failed_analysis (re-dispatches task, status changes to pending), test_retry_completed_analysis_forbidden (cannot retry a successful analysis), test_analysis_isolation_across_companies
- [ ] T075 [P] Write comparison and export API tests in `backend/tests/test_comparison_export.py` — test_compare_2_candidates (returns dimension scores and key_info with experience_years/education/top_skills), test_compare_3_candidates, test_compare_1_candidate_fails (returns 422), test_compare_4_candidates_fails (returns 422), test_compare_cross_company_forbidden (returns 403), test_export_xlsx (returns application/octet-stream with .xlsx extension, open with openpyxl and verify headers: 姓名/邮箱/综合评分/技能匹配/经验匹配/教育背景/项目相关性/整体质量/推荐等级), test_export_csv (returns text/csv, parse rows and verify data columns), test_export_filtered_by_strongly_recommended, test_export_empty_results (returns file with headers only), test_export_file_data_matches_analysis (verify exported scores match API response scores)
- [ ] T076 [P] Write company/team API tests in `backend/tests/test_companies.py` — test_get_company_info, test_list_members (admin only, returns all members with correct fields), test_list_members_operator_forbidden (returns 403), test_invite_member (creates user with correct company_id), test_invite_duplicate_email (returns 409), test_update_member_role_admin_to_operator, test_update_member_role_operator_to_admin, test_update_role_requires_admin (operator cannot change roles), test_member_cannot_modify_self_role (returns 403)
- [ ] T088 [P] Write async task and Celery integration tests in `backend/tests/test_tasks_integration.py` — test_get_task_status_pending, test_get_task_status_in_progress (returns progress with total/completed/failed counts), test_get_task_status_completed, test_get_task_not_found (returns 404), test_parse_resume_celery_task_success (mock file, verify parse_status transitions: pending→parsing→success, parsed_data saved), test_parse_resume_celery_task_failure (corrupted file, verify parse_status: pending→parsing→failed, parse_error saved), test_analyze_resume_celery_task_success (mock AI, verify analysis_status: pending→analyzing→completed, overall_score and dimension_scores created), test_analyze_resume_celery_task_ai_failure (AI returns error, verify analysis_status: pending→analyzing→failed), test_parse_to_analyze_chain (parse_resume succeeds → analyze_resume auto-triggered → analysis completed), test_parse_failure_skips_analysis (parse_resume fails → no analysis triggered)

#### 前端交互测试（Playwright）

- [ ] T077 [P] Setup frontend E2E test infrastructure in `frontend/e2e/` — install Playwright (`npm init playwright@latest`), configure `playwright.config.ts` with baseURL pointing to dev server, create `e2e/fixtures.ts` with authenticated page fixture (auto-login before tests), admin page fixture, second company fixture; create `e2e/test-data/` with sample resume files (sample.pdf, sample.docx, sample.jpg, corrupted.txt)
- [ ] T078 [P] Write auth flow E2E tests in `frontend/e2e/auth.spec.ts` — test_register_new_user (fill email/password/name/company_name → submit → redirect to dashboard), test_register_validation_errors (submit empty form → all required fields show error messages), test_register_password_too_short (if enforced → show validation error), test_login_success (fill credentials → submit → redirect to dashboard, sidebar visible), test_login_wrong_password (show error toast/Message), test_logout (click logout in sidebar → redirect to login page), test_unauthenticated_access_to_dashboard (navigate to /dashboard → redirect to login)
- [ ] T079 [P] Write job management E2E tests in `frontend/e2e/jobs.spec.ts` — test_navigate_to_jobs (click "岗位管理" in sidebar → jobs list page loads), test_create_job_with_all_criteria (step 1: fill title + description → step 2: add skills tags, set min years, select education → step 3: set weights → save → new job appears in list with draft status), test_create_job_from_template (click "从模板创建" → select template → form pre-filled → save → job created), test_edit_job_requirement (click edit on existing job → change criteria → save → verify updated in list), test_copy_job_requirement (click copy → new job created with same criteria, different id), test_activate_job (click activate → confirm → status badge changes from draft to active), test_close_job (click close on active job → status changes to closed), test_delete_draft_job (click delete → confirm dialog → job removed from list), test_delete_active_job_disabled (delete button disabled for active jobs), test_save_job_as_template (in create form click "保存为模板" → template name dialog → save → appears in template list), test_job_list_pagination (create >20 jobs → verify pagination controls work)
- [ ] T080 [P] Write resume upload E2E tests in `frontend/e2e/resumes.spec.ts` — test_upload_single_pdf (select one PDF file → click upload → progress bar appears → success message → file appears in resume list with pending/success status), test_upload_single_image (select JPG file → upload → success), test_upload_batch_mixed_formats (drag 5 files: 2 PDF + 2 DOCX + 1 JPG → upload → progress bar → summary shows uploaded:5, failed:0), test_upload_invalid_file (upload .txt → error message: "不支持的文件格式"), test_upload_to_closed_job (select closed job in dropdown → error shown or dropdown disabled), test_upload_progress_bar_visible (during upload → progress bar shows percentage), test_view_resume_list_filter_by_job (select job in dropdown → list shows only that job's resumes), test_view_resume_list_filter_by_status (click success/failed/pending tabs → list filters correctly), test_view_resume_list_pagination (upload >20 resumes → verify pagination), test_view_resume_detail (click resume row → detail page shows parsed name/email/education/experience/skills/projects), test_download_resume_file (click download button → file downloads), test_delete_resume (click delete → confirm → removed from list), test_resume_upload_page_requires_active_job (if no active jobs → show message "请先创建并激活一个岗位需求")
- [ ] T081 [P] Write analysis dashboard E2E tests in `frontend/e2e/analysis.spec.ts` — test_analysis_dashboard_loads (select job in dropdown → statistics cards show: total resumes, analyzed count, strongly recommended count, average score), test_analysis_list_sorted_by_score_default (first row has highest score), test_sort_by_dimension_skill_match (click skill_match column header → list re-sorted), test_sort_by_dimension_experience (click experience column → re-sorted), test_filter_by_recommendation_strongly (click "强烈推荐" tab → only strongly_recommended rows shown, badge visible), test_filter_by_recommendation_recommended (click "推荐" tab), test_filter_by_recommendation_pending (click "待定" tab), test_score_progress_bar_visible (each row shows score as number + colored progress bar), test_recommendation_badge_colors (strongly_recommended=gold, recommended=blue, pending=gray), test_view_analysis_detail (click row → detail page: left column shows resume structured content, right column shows overall score gauge + 5 dimension cards with score + analysis text + strengths green tags + weaknesses red tags + match details table), test_analysis_detail_match_details_shows_matched_missing_skills (verify matched skills shown in green, missing in red), test_analysis_in_progress_shows_progress (upload resumes → view dashboard → shows spinner + progress indicator → auto-refreshes until complete), test_analysis_auto_refresh (while analyzing → page polls every few seconds → numbers update), test_print_analysis_report (click print button → window.print triggered or print view opens)
- [ ] T082 [P] Write comparison and export E2E tests in `frontend/e2e/compare-export.spec.ts` — test_compare_2_candidates (select 2 rows via checkboxes → click "对比" button → comparison page opens with Recharts RadarChart showing 2 overlapping polygons), test_compare_3_candidates (select 3 → radar chart shows 3 polygons), test_compare_shows_side_by_side_table (key info table: experience years, education, top skills for each candidate), test_compare_score_differences_highlighted (higher scores highlighted in green), test_export_xlsx (click export → select xlsx format → file downloads with .xlsx extension), test_export_csv (click export → select csv → file downloads with .csv extension), test_export_with_recommendation_filter (filter to strongly_recommended → export → verify exported file only contains recommended candidates), test_export_file_not_empty (downloaded file size > 0), test_recommendation_highlights_in_dashboard (strongly_recommended rows have gold/colored background in analysis table)
- [ ] T083 [P] Write team management E2E tests in `frontend/e2e/team.spec.ts` — test_admin_sees_team_page (login as admin → click "团队管理" → member list loads with name/email/role/status/date columns), test_operator_forbidden_team_page (login as operator → click "团队管理" → shows 403 forbidden message), test_invite_member (click "邀请成员" → modal opens → fill email/name/role → submit → success message → new member appears in list), test_invite_duplicate_email (invite existing email → error message shown), test_change_member_role (click role dropdown on a member → select new role → confirm → role badge updates in list), test_member_count_card (shows total member count at top of page)
- [ ] T089 [P] Write layout and navigation E2E tests in `frontend/e2e/navigation.spec.ts` — test_sidebar_navigation_all_items (click each sidebar item: 岗位管理/简历上传/分析看板/团队管理 → correct page loads), test_sidebar_active_state (current page item highlighted in sidebar), test_sidebar_collapsible_on_mobile (resize to mobile width → sidebar collapses to hamburger menu → click to expand), test_dashboard_layout_loads_with_auth (after login → dashboard layout renders with sidebar + header showing user name + company), test_global_loading_state (navigate between pages → loading spinner appears during data fetch), test_global_error_boundary (simulate API 500 → error message shown with retry button)

#### 整体流程测试（End-to-End）

- [ ] T084 Write full happy path E2E test in `frontend/e2e/flow-happy-path.spec.ts` — complete flow: (1) register new HR user → (2) login → redirected to dashboard → (3) create job requirement with skills (React, TypeScript), min 3 years experience, bachelor degree, weights (skill_match=high, experience_match=high) → (4) save as template named "前端模板" → (5) activate job → (6) upload 5 resume files (2 PDF + 2 DOCX + 1 JPG) → (7) wait for parsing → verify all 5 parsed successfully → (8) wait for AI analysis → verify all 5 analyzed with scores → (9) view analysis dashboard → verify 5 rows sorted by score, statistics cards correct → (10) click top candidate → verify detail page shows strengths/weaknesses/match details → (11) export as xlsx → verify file downloads → (12) select 2 candidates → compare → verify radar chart renders → (13) print detail report. Assert correct state at every step
- [ ] T085 Write multi-company isolation E2E test in `frontend/e2e/flow-multi-company.spec.ts` — (1) register user A (Alpha公司) → create job + upload 3 resumes → (2) register user B (Beta公司) → create job + upload 2 resumes → (3) login as A → verify only Alpha's 1 job and 3 resumes visible → (4) login as B → verify only Beta's 1 job and 2 resumes visible → (5) A's analysis dashboard shows 3 results, B's shows 2 → (6) verify no cross-company data in API responses (jobs, resumes, analysis, templates)
- [ ] T086 Write error recovery E2E test in `frontend/e2e/flow-error-recovery.spec.ts` — (1) create active job → upload 3 valid PDFs + 1 corrupted .txt (renamed as .pdf) → (2) verify upload summary: uploaded=3, failed=1 with error message → (3) wait for analysis → verify 3 analyzed successfully, 1 shows parse failed → (4) click retry on failed resume → verify re-analysis attempted → (5) upload another valid PDF → verify it gets analyzed → (6) verify original 3 analyses unaffected by failure
- [ ] T087 Write team collaboration E2E test in `frontend/e2e/flow-team-collaboration.spec.ts` — (1) login as admin → invite new operator (李四) → (2) logout → login as 李四 → (3) 李四 creates a job + uploads 2 resumes → (4) logout → login as admin → (5) verify admin can see 李四's job and resumes → (6) admin exports analysis → (7) admin changes 李四 to admin role → (8) verify 李四 can now access team management page
- [ ] T090 Write closed job boundary E2E test in `frontend/e2e/flow-closed-job.spec.ts` — (1) create job → activate → upload 2 resumes → wait for analysis → (2) close job → (3) verify cannot upload more resumes to closed job (upload button disabled or error) → (4) verify analysis results still visible for closed job → (5) verify can still export results from closed job → (6) verify can re-open or create new job from template
- [ ] T091 Write criteria change and re-analysis E2E test in `frontend/e2e/flow-reanalysis.spec.ts` — (1) create job with skill_match=high, education=low → activate → upload 3 resumes → wait for analysis → (2) note current scores → (3) edit job criteria: change education=high, skill_match=low → (4) verify scores are recalculated (education now weighted more) → (5) verify ranking may change based on new weights

---

## Summary

| Phase | User Story | Tasks | Key Deliverables |
| ----- | ---------- | ----- | --------------- |
| Phase 1: Setup | - | 5 (T001-T005) | 项目骨架, Docker Compose |
| Phase 2: Foundational | - | 11 (T006-T016) | 数据库, 认证, 前端布局 |
| Phase 3: [US1] | 岗位需求管理 | 12 (T017-T028) | 岗位 CRUD, 模板, 权重设置 |
| Phase 4: [US2] | 批量上传简历 | 11 (T029-T039) | 文件上传, 解析, Celery Worker |
| Phase 5: [US3] | AI 分析评分 | 10 (T040-T049) | AI 服务, 评分, 排名, 详情报告 |
| Phase 6: [US4] | 推荐与导出 | 6 (T050-T055) | 对比, 导出, 推荐高亮 |
| Phase 7: [US5] | 团队管理 | 6 (T056-T061) | 成员邀请, 角色管理 |
| Final: Polish | - | 5 (T062-T066) | 错误处理, 重试, 响应式 |
| Testing: 后端 API | - | 10 (T067-T076, T088) | 每个端点+边界+隔离+集成链路 |
| Testing: 前端交互 | - | 8 (T077-T083, T089) | 每个页面+导航+加载状态 |
| Testing: E2E 流程 | - | 8 (T084-T087, T090-T091) | 快乐路径+隔离+错误恢复+边界 |

**Total: 91 tasks**

**Parallel opportunities**: 28 (功能) + 35 (测试) = 63 个任务标记为 [P] 可并行执行

**MVP 建议**: Phase 1 + Phase 2 + Phase 3 (共 28 个任务) — 完成后可演示注册登录 + 岗位创建全流程
