from dataclasses import dataclass
from datetime import datetime
from email.message import EmailMessage
import smtplib

from app.config import get_settings


@dataclass
class EmailDeliveryResult:
    sent: bool
    mode: str
    message: str


class EmailService:
    def __init__(self):
        self.settings = get_settings()

    def send_interview_invitation(
        self,
        *,
        to_email: str,
        candidate_name: str,
        job_title: str,
        scheduled_at: datetime,
        mode: str,
        location: str,
        note: str | None,
        sender_name: str,
        contact_name: str,
        contact_phone: str,
        contact_email: str | None = None,
    ) -> EmailDeliveryResult:
        subject = f"{job_title} 面试安排通知"
        body = self._build_interview_body(
            candidate_name=candidate_name,
            job_title=job_title,
            scheduled_at=scheduled_at,
            mode=mode,
            location=location,
            note=note,
            sender_name=sender_name,
            contact_name=contact_name,
            contact_phone=contact_phone,
            contact_email=contact_email,
        )

        if self.settings.EMAIL_DELIVERY_MODE == "console":
            print(
                "\n".join(
                    [
                        "[EmailService] console delivery",
                        f"To: {to_email}",
                        f"Subject: {subject}",
                        body,
                    ]
                )
            )
            return EmailDeliveryResult(sent=False, mode="console", message="本地开发模式：邮件内容已写入后端日志")

        if not self.settings.SMTP_HOST or not self.settings.SMTP_FROM_EMAIL:
            raise RuntimeError("SMTP 未配置，请设置 SMTP_HOST 和 SMTP_FROM_EMAIL")

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = f"{self.settings.SMTP_FROM_NAME} <{self.settings.SMTP_FROM_EMAIL}>"
        message["To"] = to_email
        message.set_content(body)

        smtp_class = smtplib.SMTP_SSL if self.settings.SMTP_USE_SSL else smtplib.SMTP
        with smtp_class(self.settings.SMTP_HOST, self.settings.SMTP_PORT, timeout=15) as smtp:
            if self.settings.SMTP_USE_TLS and not self.settings.SMTP_USE_SSL:
                smtp.starttls()
            if self.settings.SMTP_USERNAME:
                smtp.login(self.settings.SMTP_USERNAME, self.settings.SMTP_PASSWORD)
            smtp.send_message(message)

        return EmailDeliveryResult(sent=True, mode="smtp", message="面试通知邮件已发送")

    def send_interview_reminder(
        self,
        *,
        to_email: str,
        candidate_name: str,
        job_title: str,
        scheduled_at: datetime,
        mode: str,
        location: str,
        reminder_label: str,
        sender_name: str,
        contact_name: str,
        contact_phone: str,
        contact_email: str | None = None,
    ) -> EmailDeliveryResult:
        subject = f"{job_title} 面试提醒（{reminder_label}）"
        body = self._build_interview_reminder_body(
            candidate_name=candidate_name,
            job_title=job_title,
            scheduled_at=scheduled_at,
            mode=mode,
            location=location,
            reminder_label=reminder_label,
            sender_name=sender_name,
            contact_name=contact_name,
            contact_phone=contact_phone,
            contact_email=contact_email,
        )

        if self.settings.EMAIL_DELIVERY_MODE == "console":
            print(
                "\n".join(
                    [
                        "[EmailService] console delivery",
                        f"To: {to_email}",
                        f"Subject: {subject}",
                        body,
                    ]
                )
            )
            return EmailDeliveryResult(sent=False, mode="console", message=f"本地开发模式：{reminder_label}邮件内容已写入后端日志")

        if not self.settings.SMTP_HOST or not self.settings.SMTP_FROM_EMAIL:
            raise RuntimeError("SMTP 未配置，请设置 SMTP_HOST 和 SMTP_FROM_EMAIL")

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = f"{self.settings.SMTP_FROM_NAME} <{self.settings.SMTP_FROM_EMAIL}>"
        message["To"] = to_email
        message.set_content(body)

        smtp_class = smtplib.SMTP_SSL if self.settings.SMTP_USE_SSL else smtplib.SMTP
        with smtp_class(self.settings.SMTP_HOST, self.settings.SMTP_PORT, timeout=15) as smtp:
            if self.settings.SMTP_USE_TLS and not self.settings.SMTP_USE_SSL:
                smtp.starttls()
            if self.settings.SMTP_USERNAME:
                smtp.login(self.settings.SMTP_USERNAME, self.settings.SMTP_PASSWORD)
            smtp.send_message(message)

        return EmailDeliveryResult(sent=True, mode="smtp", message=f"{reminder_label}邮件已发送")

    def _build_interview_body(
        self,
        *,
        candidate_name: str,
        job_title: str,
        scheduled_at: datetime,
        mode: str,
        location: str,
        note: str | None,
        sender_name: str,
        contact_name: str,
        contact_phone: str,
        contact_email: str | None,
    ) -> str:
        local_time = scheduled_at.strftime("%Y-%m-%d %H:%M")
        note_line = f"\n面试备注：{note}" if note else ""
        contact_email_line = f"\n联系邮箱：{contact_email}" if contact_email else ""
        return (
            f"{candidate_name}，你好：\n\n"
            f"我们已为你安排 {job_title} 的面试，信息如下：\n"
            f"面试时间：{local_time}\n"
            f"面试方式：{mode or '线上/线下待确认'}\n"
            f"面试地点/会议链接：{location}\n"
            f"联系人：{contact_name}\n"
            f"联系电话：{contact_phone}"
            f"{contact_email_line}\n"
            f"{note_line}\n\n"
            "请按时参加。如需调整时间，请及时回复本邮件或联系 HR。\n\n"
            f"{sender_name}\n"
            "HR Talent"
        )

    def _build_interview_reminder_body(
        self,
        *,
        candidate_name: str,
        job_title: str,
        scheduled_at: datetime,
        mode: str,
        location: str,
        reminder_label: str,
        sender_name: str,
        contact_name: str,
        contact_phone: str,
        contact_email: str | None,
    ) -> str:
        local_time = scheduled_at.strftime("%Y-%m-%d %H:%M")
        contact_email_line = f"\n联系邮箱：{contact_email}" if contact_email else ""
        return (
            f"{candidate_name}，你好：\n\n"
            f"温馨提醒，你的 {job_title} 面试将在 {reminder_label} 后开始，请提前做好准备。\n\n"
            f"面试时间：{local_time}\n"
            f"面试方式：{mode or '线上/线下待确认'}\n"
            f"面试地点/会议链接：{location}\n"
            f"联系人：{contact_name}\n"
            f"联系电话：{contact_phone}"
            f"{contact_email_line}\n\n"
            "建议提前 5-10 分钟进入会议或到达现场。如需调整时间，请及时回复本邮件或联系 HR。\n\n"
            f"{sender_name}\n"
            "HR Talent"
        )
