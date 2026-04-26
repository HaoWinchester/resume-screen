'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Tag,
  Button,
  Card,
  Select,
  Space,
  message,
  Tabs,
  Typography,
  Dropdown,
  Alert,
} from 'antd';
import type { MenuProps } from 'antd';
import type { ColumnsType, TableProps } from 'antd/es/table';
import {
  EyeOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  ReloadOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import {
  fetchResumes,
  deleteResume,
  downloadResumeFile,
  retryResumeParse,
} from '@/lib/api/resume';
import { fetchJobRequirements } from '@/lib/api/job';
import type { ResumeListItem, ParseStatus } from '@/types/resume';
import type { JobRequirementListItem } from '@/types/job';

const { Title } = Typography;
const { Option } = Select;

export default function ResumesPage() {
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [jobs, setJobs] = useState<JobRequirementListItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ParseStatus | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (selectedJobId) {
      void loadResumes();
    }
  }, [selectedJobId, statusFilter, pagination.current, pagination.pageSize]);

  const activeProcessingCount = resumes.filter(
    (resume) => resume.parse_status === 'pending' || resume.parse_status === 'parsing'
  ).length;

  useEffect(() => {
    if (!selectedJobId || activeProcessingCount === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadResumes({ silent: true });
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [selectedJobId, activeProcessingCount, loadResumes]);

  const loadJobs = async () => {
    try {
      const response = await fetchJobRequirements({ status: 'active', per_page: 100 });
      setJobs(response.items);
      if (response.items.length > 0 && !selectedJobId) {
        setSelectedJobId(response.items[0].id);
      }
    } catch (error) {
      message.error('加载岗位列表失败');
    }
  };

  async function loadResumes(options?: { silent?: boolean }) {
    if (!selectedJobId) return;

    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
    }

    try {
      const params: any = {
        job_requirement_id: selectedJobId,
        page: pagination.current,
        per_page: pagination.pageSize,
      };
      if (statusFilter !== 'all') {
        params.parse_status = statusFilter;
      }

      const response = await fetchResumes(params);
      setResumes(response.items);
      setPagination({
        current: response.page,
        pageSize: response.per_page,
        total: response.total,
      });
    } catch (error) {
      if (!silent) {
        message.error('加载简历列表失败');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  const handleTableChange: TableProps<ResumeListItem>['onChange'] = (newPagination) => {
    setPagination({
      ...pagination,
      current: newPagination.current || 1,
      pageSize: newPagination.pageSize || 20,
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteResume(id);
      message.success('删除成功');
      void loadResumes();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleRetryParse = async (id: string) => {
    try {
      await retryResumeParse(id);
      message.success('已重新提交解析');
      void loadResumes({ silent: true });
    } catch (error) {
      message.error('重新解析失败');
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    try {
      const blob = await downloadResumeFile(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success('下载成功');
    } catch (error) {
      message.error('下载失败');
    }
  };

  const getParseStatusTag = (status: ParseStatus) => {
    const statusConfig = {
      pending: { color: 'default', text: '等待解析' },
      parsing: { color: 'processing', text: '解析中' },
      success: { color: 'success', text: '解析成功' },
      failed: { color: 'error', text: '解析失败' },
    };
    const config = statusConfig[status];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId);
    setPagination({ ...pagination, current: 1 });
  };

  const handleStatusFilterChange = (status: ParseStatus | 'all') => {
    setStatusFilter(status);
    setPagination({ ...pagination, current: 1 });
  };

  const getActionMenuItems = (record: ResumeListItem): MenuProps['items'] => {
    const items: NonNullable<MenuProps['items']> = [
      {
        key: 'view',
        label: '查看详情',
        icon: <EyeOutlined />,
        onClick: () => router.push(`/dashboard/resumes/${record.id}`),
      },
      {
        key: 'download',
        label: '下载文件',
        icon: <DownloadOutlined />,
        onClick: () => handleDownload(record.id, record.file_name),
      },
    ];

    if (record.parse_status !== 'parsing') {
      items.push({
        key: 'retry',
        label: '重新解析',
        icon: <ReloadOutlined />,
        onClick: () => handleRetryParse(record.id),
      } satisfies NonNullable<MenuProps['items']>[number]);
    }

    items.push(
      {
        type: 'divider' as const,
      },
      {
        key: 'delete',
        label: '删除',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => handleDelete(record.id),
      }
    );

    return items;
  };

  const renderCandidateName = (record: ResumeListItem) => {
    if (record.candidate_name) return record.candidate_name;
    if (record.parse_status === 'success') {
      return <span className="text-gray-400">未识别姓名</span>;
    }
    if (record.parse_status === 'failed') {
      return <span className="text-gray-400">解析失败</span>;
    }
    return <span className="text-gray-400">待解析</span>;
  };

  const columns: ColumnsType<ResumeListItem> = [
    {
      title: '候选人姓名',
      dataIndex: 'candidate_name',
      key: 'candidate_name',
      render: (_, record) => renderCandidateName(record),
    },
    {
      title: '邮箱',
      dataIndex: 'candidate_email',
      key: 'candidate_email',
      render: (email) => email || <span className="text-gray-400">-</span>,
    },
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      ellipsis: true,
    },
    {
      title: '解析状态',
      dataIndex: 'parse_status',
      key: 'parse_status',
      width: 120,
      render: (status: ParseStatus) => getParseStatusTag(status),
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Dropdown menu={{ items: getActionMenuItems(record) }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const tabItems = [
    { key: 'all', label: '全部' },
    { key: 'success', label: '解析成功' },
    { key: 'failed', label: '解析失败' },
    { key: 'pending', label: '等待中' },
    { key: 'parsing', label: '解析中' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={3} className="mb-0">
          简历管理
        </Title>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => router.push('/dashboard/resumes/upload')}
        >
          上传简历
        </Button>
      </div>

      <Card>
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="block mb-2 text-sm font-medium">选择岗位</label>
            <Select
              value={selectedJobId}
              onChange={handleJobChange}
              style={{ width: '100%' }}
              placeholder="请选择岗位需求"
            >
              {jobs.map((job) => (
                <Option key={job.id} value={job.id}>
                  {job.title}
                </Option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <label className="block mb-2 text-sm font-medium">筛选状态</label>
            <Tabs
              activeKey={statusFilter}
              onChange={(key) => handleStatusFilterChange(key as ParseStatus | 'all')}
              items={tabItems}
            />
          </div>
        </div>

        {activeProcessingCount > 0 && (
          <Alert
            className="mb-4"
            type="info"
            showIcon
            message={`当前有 ${activeProcessingCount} 份简历正在等待解析或解析中，列表每 3 秒自动刷新一次。`}
          />
        )}

        {selectedJobId ? (
          <Table
            columns={columns}
            dataSource={resumes}
            rowKey="id"
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
            scroll={{ x: 800 }}
          />
        ) : (
          <div className="text-center py-12 text-gray-500">
            请先选择一个岗位需求
          </div>
        )}
      </Card>
    </div>
  );
}
