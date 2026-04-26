'use client';

import { useEffect } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, BankOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [form] = Form.useForm();

  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handleSubmit = async (values: {
    email: string;
    password: string;
    confirmPassword: string;
    name: string;
    companyName: string;
  }) => {
    try {
      await register(values.email, values.password, values.name, values.companyName);
      message.success('注册成功');
      router.replace('/dashboard/jobs');
    } catch {
      // 错误已在 store 中处理
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <Card className="w-full max-w-md shadow-lg">
        <div className="text-center mb-8">
          <Title level={2}>HR 简历智能筛查系统</Title>
          <Text type="secondary">创建您的账户</Text>
        </div>

        <Form
          form={form}
          name="register"
          onFinish={handleSubmit}
          autoComplete="off"
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="name"
            rules={[{ required: true, message: '请输入您的姓名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="您的姓名"
              autoComplete="name"
            />
          </Form.Item>

          <Form.Item
            name="companyName"
            rules={[{ required: true, message: '请输入公司名称' }]}
          >
            <Input
              prefix={<BankOutlined />}
              placeholder="公司名称"
              autoComplete="organization"
            />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="邮箱"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少需要 8 个字符' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码（至少 8 个字符）"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="确认密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              className="h-12"
            >
              注册
            </Button>
          </Form.Item>

          <div className="text-center">
            <Text>
              已有账户？{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-800">
                立即登录
              </Link>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
}
