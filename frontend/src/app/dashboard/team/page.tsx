'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Button,
  Card,
  Tag,
  Space,
  message,
  Modal,
  Form,
  Input,
  Select,
  Statistic,
  Row,
  Col,
  Popconfirm,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/lib/auth';
import {
  fetchMembers,
  inviteMember,
  updateMemberRole,
  fetchCompanyInfo,
} from '@/lib/api/team';
import type { TeamMember, UserRole } from '@/types/team';

const { Title } = Typography;
const { Option } = Select;

export default function TeamPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const hasHandledUnauthorizedRef = useRef(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteForm] = Form.useForm();
  const [totalMembers, setTotalMembers] = useState(0);
  const [companyName, setCompanyName] = useState<string>('');

  useEffect(() => {
    // 检查权限
    if (user && user.role !== 'admin') {
      if (!hasHandledUnauthorizedRef.current) {
        hasHandledUnauthorizedRef.current = true;
        message.error('您没有访问团队管理页面的权限');
      }
      router.replace('/dashboard/jobs');
      return;
    }

    hasHandledUnauthorizedRef.current = false;
    loadMembers();
    loadCompanyInfo();
  }, [router, user]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const response = await fetchMembers();
      setMembers(response.members);
      setTotalMembers(response.total);
    } catch (error) {
      message.error('加载成员列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyInfo = async () => {
    try {
      const info = await fetchCompanyInfo();
      setCompanyName(info.name);
    } catch (error) {
      console.error('加载公司信息失败', error);
    }
  };

  const handleInvite = async (values: { email: string; name: string; role: UserRole }) => {
    try {
      await inviteMember(values);
      message.success('邀请成功');
      setInviteModalVisible(false);
      inviteForm.resetFields();
      loadMembers();
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '邀请失败');
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await updateMemberRole(userId, { role: newRole });
      message.success('角色更新成功');
      loadMembers();
    } catch (error) {
      message.error('角色更新失败');
    }
  };

  const getRoleTag = (role: UserRole) => {
    return role === 'admin' ? (
      <Tag color="red">管理员</Tag>
    ) : (
      <Tag color="blue">操作员</Tag>
    );
  };

  const getRoleOptions = (currentUserId: string) => {
    // 不能修改自己的角色
    return [
      { label: '管理员', value: 'admin' },
      { label: '操作员', value: 'operator' },
    ];
  };

  const columns: ColumnsType<TeamMember> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <UserOutlined />
          {name}
          {record.id === user?.id && (
            <Tag color="purple" className="ml-2">
              你
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 150,
      render: (role: UserRole, record) => {
        if (record.id === user?.id) {
          return getRoleTag(role);
        }
        return (
          <Select
            value={role}
            onChange={(newRole) => handleRoleChange(record.id, newRole)}
            style={{ width: 100 }}
            size="small"
          >
            <Option value="admin">管理员</Option>
            <Option value="operator">操作员</Option>
          </Select>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) =>
        isActive ? (
          <Tag color="green">活跃</Tag>
        ) : (
          <Tag color="default">停用</Tag>
        ),
    },
    {
      title: '加入时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={3} className="mb-0">
          团队管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setInviteModalVisible(true)}>
          邀请成员
        </Button>
      </div>

      <Row gutter={16} className="mb-6">
        <Col span={8}>
          <Card>
            <Statistic
              title="团队成员"
              value={totalMembers}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="公司名称"
              value={companyName || '-'}
              valueStyle={{ fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="管理员数量"
              value={members.filter((m) => m.role === 'admin').length}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={members}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* 邀请成员弹窗 */}
      <Modal
        title="邀请新成员"
        open={inviteModalVisible}
        onCancel={() => setInviteModalVisible(false)}
        footer={null}
      >
        <Form form={inviteForm} layout="vertical" onFinish={handleInvite}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入成员姓名' }]}
          >
            <Input placeholder="请输入成员姓名" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱地址" />
          </Form.Item>

          <Form.Item
            name="role"
            label="角色"
            initialValue="operator"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select>
              <Option value="operator">操作员</Option>
              <Option value="admin">管理员</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <div className="text-sm text-gray-500 mb-4">
              邀请成功后，新成员将收到一封包含登录信息的邮件
            </div>
          </Form.Item>

          <Form.Item>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setInviteModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                发送邀请
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
