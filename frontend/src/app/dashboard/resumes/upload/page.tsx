'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Empty, Progress, Select, Spin, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { fetchResumes, uploadResumes } from '@/lib/api/resume';
import { fetchJobRequirements } from '@/lib/api/job';
import type { JobRequirementListItem } from '@/types/job';
import type { ResumeListItem } from '@/types/resume';

const { Dragger } = Upload;

function MaterialIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

interface FileItem {
  uid: string;
  name: string;
  status?: 'uploading' | 'done' | 'error';
  percent?: number;
  response?: any;
  error?: any;
  type?: string;
  size?: number;
  originFileObj?: File;
}

export default function ResumeUploadPage() {
  const router = useRouter();
  const [jobOptions, setJobOptions] = useState<JobRequirementListItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [scanMode, setScanMode] = useState<'standard' | 'deep'>('standard');
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [recentResumes, setRecentResumes] = useState<ResumeListItem[]>([]);
  const [uploadResult, setUploadResult] = useState<{
    uploaded: any[];
    failed: any[];
    total_uploaded: number;
    total_failed: number;
  } | null>(null);

  useEffect(() => {
    void loadActiveJobs();
  }, []);

  useEffect(() => {
    if (selectedJobId) {
      void loadRecentResumes(selectedJobId);
    }
  }, [selectedJobId]);

  const loadActiveJobs = async () => {
    setLoadingJobs(true);
    try {
      const response = await fetchJobRequirements({ status: 'active', per_page: 100 });
      setJobOptions(response.items);
      if (response.items.length > 0) {
        setSelectedJobId(response.items[0].id);
      }
    } catch {
      message.error('加载岗位列表失败');
    } finally {
      setLoadingJobs(false);
    }
  };

  const loadRecentResumes = async (jobId: string) => {
    try {
      const response = await fetchResumes({ job_requirement_id: jobId, page: 1, per_page: 4 });
      setRecentResumes(response.items);
    } catch {
      setRecentResumes([]);
    }
  };

  const handleUpload = async () => {
    if (!selectedJobId) {
      message.warning('请先选择一个目标职位');
      return;
    }

    const files = fileList
      .filter((file) => file.status !== 'done')
      .map((file) => file.originFileObj)
      .filter((file): file is File => file !== undefined);

    if (files.length === 0) {
      message.warning('请先选择要上传的文件');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const result = await uploadResumes(selectedJobId, files, setUploadProgress);
      setFileList((prev) =>
        prev.map((file) => {
          const uploadedItem = result.uploaded.find((item) => item.file_name === file.name);
          const failedItem = result.failed.find((item) => item.file_name === file.name);
          if (uploadedItem) {
            return { ...file, status: 'done', percent: 100, response: uploadedItem };
          }
          if (failedItem) {
            return { ...file, status: 'error', error: failedItem.error };
          }
          return file;
        })
      );
      setUploadResult(result);
      await loadRecentResumes(selectedJobId);
      message.success(`上传完成：${result.total_uploaded} 份成功，${result.total_failed} 份失败`);
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const uploadProps: UploadProps = {
    name: 'files',
    multiple: true,
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png',
    fileList: fileList as any,
    showUploadList: false,
    disabled: uploading,
    beforeUpload: (file) => {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
      ];
      const validType = allowedTypes.includes(file.type) || file.name.endsWith('.doc');
      if (!validType) {
        message.error(`不支持的文件类型：${file.name}`);
        return Upload.LIST_IGNORE;
      }

      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error(`单个文件最大限制 10MB：${file.name}`);
        return Upload.LIST_IGNORE;
      }

      setFileList((prev) => [
        ...prev,
        {
          uid: `${Date.now()}-${Math.random()}`,
          name: file.name,
          status: 'uploading',
          type: file.type,
          size: file.size,
          originFileObj: file,
        },
      ]);
      return false;
    },
  };

  const handleReset = () => {
    setFileList([]);
    setUploadProgress(0);
    setUploadResult(null);
  };

  const selectedJob = jobOptions.find((job) => job.id === selectedJobId);

  if (loadingJobs) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (jobOptions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 shadow-sm">
        <Empty description="暂无可上传简历的活跃岗位">
          <Button type="primary" className="bg-[#00288e]" onClick={() => router.push('/dashboard/jobs/new')}>
            创建岗位
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_380px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#1a1b22]">上传文档</h1>
                <p className="mt-1 text-sm leading-6 text-slate-700">将简历添加到解析队列。支持 PDF、DOC、DOCX、JPG 和 PNG 格式。</p>
              </div>
              <span className="self-start whitespace-nowrap rounded-full bg-[#dde1ff] px-4 py-2 text-sm font-black text-[#001453]">
                队列：{fileList.length} 个文件
              </span>
            </div>

            <Dragger {...uploadProps} className="talent-upload-dragger">
              <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-10 text-center transition hover:border-[#00288e] hover:bg-blue-50/30">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-[#00288e]">
                  <MaterialIcon name="cloud_upload" className="text-5xl" />
                </span>
                <p className="mt-6 text-2xl font-black text-[#1a1b22]">点击上传或将文件拖拽至此</p>
                <p className="mt-2 text-slate-600">单个文件最大限制：10MB</p>
                <span className="mt-7 inline-flex h-12 items-center rounded-lg bg-[#00288e] px-8 font-bold text-white shadow-sm">
                  选择文件
                </span>
              </div>
            </Dragger>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-600">上传进度</h2>
              <Button type="link" onClick={handleReset} disabled={uploading}>
                清除已成功
              </Button>
            </div>

            {fileList.length === 0 ? (
              <div className="p-8 text-center text-slate-500">选择文件后，解析队列会显示在这里。</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {fileList.map((file) => (
                  <UploadRow key={file.uid} file={file} uploading={uploading} onRemove={() => setFileList((prev) => prev.filter((item) => item.uid !== file.uid))} />
                ))}
              </div>
            )}

            {uploading && (
              <div className="border-t border-slate-100 p-6">
                <Progress percent={uploadProgress} status="active" strokeColor="#00288e" />
                <p className="mt-2 text-sm text-slate-500">正在上传文件并提交解析任务...</p>
              </div>
            )}
          </div>

          {uploadResult && (
            <Alert
              type={uploadResult.total_failed > 0 ? 'warning' : 'success'}
              showIcon
              message={`上传完成：${uploadResult.total_uploaded} 份成功，${uploadResult.total_failed} 份失败`}
              description="成功文件已进入后台解析队列，可前往候选人结果页观察分析状态。"
              action={
                <Button type="primary" className="bg-[#00288e]" onClick={() => router.push(`/dashboard/analysis?job=${selectedJobId}`)}>
                  查看候选人
                </Button>
              }
            />
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-black text-[#1a1b22]">解析配置</h2>
            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-bold text-slate-700">目标职位类别</span>
              <Select
                value={selectedJobId}
                onChange={setSelectedJobId}
                className="h-12 w-full"
                options={jobOptions.map((job) => ({ label: job.title, value: job.id }))}
              />
            </label>

            <div className="mt-6">
              <span className="mb-3 block text-sm font-bold text-slate-700">AI 解析强度</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`h-12 rounded-lg border font-bold ${scanMode === 'standard' ? 'border-blue-300 bg-blue-50 text-[#00288e]' : 'border-slate-200 bg-white text-slate-600'}`}
                  onClick={() => setScanMode('standard')}
                >
                  标准
                </button>
                <button
                  className={`h-12 rounded-lg border font-bold ${scanMode === 'deep' ? 'border-blue-300 bg-blue-50 text-[#00288e]' : 'border-slate-200 bg-white text-slate-600'}`}
                  onClick={() => setScanMode('deep')}
                >
                  深度扫描
                </button>
              </div>
            </div>

            <Button
              type="primary"
              icon={<MaterialIcon name="play_arrow" className="text-xl" />}
              loading={uploading}
              disabled={fileList.length === 0}
              onClick={handleUpload}
              className="mt-8 h-14 w-full rounded-lg bg-[#00288e] text-lg font-black"
            >
              开始解析
            </Button>
          </div>

          <div className="rounded-xl bg-[#1e40af] p-8 text-white shadow-sm">
            <MaterialIcon name="auto_awesome" className="text-5xl" />
            <h2 className="mt-6 text-2xl font-black">智能排名</h2>
            <p className="mt-3 leading-7 text-blue-50">
              我们的 AI 将根据 {selectedJob?.title || '目标职位'} 的技能和经验要求，自动为这些候选人与开放职位进行匹配排名。
            </p>
            <button className="mt-6 inline-flex items-center gap-1 border-0 bg-transparent p-0 font-bold text-white" onClick={() => router.push('/dashboard/jobs')}>
              了解更多 <MaterialIcon name="arrow_forward" className="text-lg" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="font-black">系统统计</h2>
            <div className="mt-6 flex justify-between text-lg font-black">
              <span>每月额度</span>
              <span>840 / 1,000</span>
            </div>
            <Progress percent={84} showInfo={false} strokeColor="#10b981" className="mt-4" />
            <p className="mt-4 text-sm text-slate-500">额度将在 12 天后重置。需要更多？</p>
          </div>
        </aside>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-black">近期活动</h2>
          <Button type="link" onClick={() => router.push(`/dashboard/analysis?job=${selectedJobId}`)}>查看历史</Button>
        </div>
        {recentResumes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            当前岗位暂无上传记录。选择文件并开始解析后，这里会显示真实简历。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {recentResumes.map((resume) => (
              <div key={resume.id} className="flex items-center gap-4 rounded-xl border border-slate-100 p-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-[#00288e]">
                  <MaterialIcon name="description" className="text-2xl" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold">{resume.candidate_name || resume.file_name}</p>
                  <span className={`rounded-md px-2 py-1 text-xs font-bold ${resume.parse_status === 'success' ? 'bg-emerald-100 text-emerald-700' : resume.parse_status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-[#00288e]'}`}>
                    {resume.parse_status === 'success' ? '解析成功' : resume.parse_status === 'failed' ? '解析失败' : '解析中'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function UploadRow({ file, uploading, onRemove }: { file: FileItem; uploading: boolean; onRemove: () => void }) {
  const size = file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : '待上传';

  if (file.status === 'done') {
    return (
      <div className="flex items-center gap-4 p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <MaterialIcon name="check_circle" className="text-2xl" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{file.name}</p>
          <p className="text-sm text-slate-500">{size} · 2 分钟前上传</p>
        </div>
        <span className="font-bold text-emerald-700">成功</span>
        <MaterialIcon name="visibility" className="text-xl text-slate-400" />
      </div>
    );
  }

  if (file.status === 'error') {
    return (
      <div className="flex items-center gap-4 p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-700">
          <MaterialIcon name="error" className="text-2xl" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{file.name}</p>
          <p className="text-sm text-red-600">{file.error || '文件格式无法识别或已损坏。'}</p>
        </div>
        <span className="font-bold text-red-600">错误</span>
        <MaterialIcon name="replay" className="text-xl text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
        <MaterialIcon name="description" className="text-2xl" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex justify-between gap-3">
          <p className="truncate font-semibold">{file.name}</p>
          <span className="text-sm font-bold text-[#00288e]">{uploading ? '75%' : '待解析'}</span>
        </div>
        <Progress percent={uploading ? 75 : 0} showInfo={false} strokeColor="#00288e" size="small" />
        <p className="mt-2 text-sm text-slate-500">{size} · 解析中</p>
      </div>
      <Button type="text" icon={<MaterialIcon name="close" className="text-xl" />} disabled={uploading} onClick={onRemove} />
    </div>
  );
}
