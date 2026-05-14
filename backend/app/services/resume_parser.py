import re
import asyncio
import shutil
import subprocess
from typing import Optional
from pathlib import Path
import fitz  # PyMuPDF
from docx import Document
from docx.document import Document as DocxDocument
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table, _Cell
from docx.text.paragraph import Paragraph
import pytesseract
from PIL import Image
import io


class ResumeParser:
    """Resume parser service for extracting structured data from various file formats."""

    # Common patterns for extraction
    EMAIL_PATTERN = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    PHONE_PATTERN = r'(?:\+86[-\s]?)?1[3-9]\d{9}|\d{3,4}[-\s]?\d{7,8}'
    DATE_PATTERN = r'(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})[日]?'

    # Common skill keywords
    COMMON_SKILLS = [
        "Python", "Java", "JavaScript", "TypeScript", "React", "Vue", "Angular",
        "Node.js", "Django", "Flask", "Spring", "MySQL", "PostgreSQL", "MongoDB",
        "Docker", "Kubernetes", "Redis", "Git", "Linux", "AWS", "Azure", "GCP",
        "Machine Learning", "Deep Learning", "NLP", "Data Analysis", "SQL", "NoSQL"
    ]

    SKILL_PATTERNS = [
        (r"(?<![A-Za-z0-9])Python(?![A-Za-z0-9])", "Python"),
        (r"(?<![A-Za-z0-9])Java(?![A-Za-z0-9]|Script)", "Java"),
        (r"(?<![A-Za-z0-9])JavaScript(?![A-Za-z0-9])", "JavaScript"),
        (r"(?<![A-Za-z0-9])TypeScript(?![A-Za-z0-9])", "TypeScript"),
        (r"(?<![A-Za-z0-9])React(?![A-Za-z0-9])", "React"),
        (r"(?<![A-Za-z0-9])Vue(?![A-Za-z0-9])", "Vue"),
        (r"(?<![A-Za-z0-9])Angular(?![A-Za-z0-9])", "Angular"),
        (r"(?<![A-Za-z0-9])Node\.js(?![A-Za-z0-9])", "Node.js"),
        (r"(?<![A-Za-z0-9])Django(?![A-Za-z0-9])", "Django"),
        (r"(?<![A-Za-z0-9])Flask(?![A-Za-z0-9])", "Flask"),
        (r"(?<![A-Za-z0-9])Spring(?![A-Za-z0-9])", "Spring"),
        (r"(?<![A-Za-z0-9])MySQL(?![A-Za-z0-9])", "MySQL"),
        (r"(?<![A-Za-z0-9])PostgreSQL(?![A-Za-z0-9])", "PostgreSQL"),
        (r"(?<![A-Za-z0-9])MongoDB(?![A-Za-z0-9])", "MongoDB"),
        (r"(?<![A-Za-z0-9])Docker(?![A-Za-z0-9])", "Docker"),
        (r"(?<![A-Za-z0-9])Kubernetes(?![A-Za-z0-9])", "Kubernetes"),
        (r"(?<![A-Za-z0-9])Redis(?![A-Za-z0-9])", "Redis"),
        (r"(?<![A-Za-z0-9])Git(?![A-Za-z0-9])", "Git"),
        (r"(?<![A-Za-z0-9])Linux(?![A-Za-z0-9])", "Linux"),
        (r"(?<![A-Za-z0-9])AWS(?![A-Za-z0-9])", "AWS"),
        (r"(?<![A-Za-z0-9])Azure(?![A-Za-z0-9])", "Azure"),
        (r"(?<![A-Za-z0-9])GCP(?![A-Za-z0-9])", "GCP"),
        (r"(?<![A-Za-z0-9])SQL(?![A-Za-z0-9])", "SQL"),
        (r"(?<![A-Za-z0-9])NoSQL(?![A-Za-z0-9])", "NoSQL"),
        (r"(?<![A-Za-z0-9])Machine Learning(?![A-Za-z0-9])", "Machine Learning"),
        (r"(?<![A-Za-z0-9])Deep Learning(?![A-Za-z0-9])", "Deep Learning"),
        (r"(?<![A-Za-z0-9])NLP(?![A-Za-z0-9])", "NLP"),
        (r"(?<![A-Za-z0-9])Data Analysis(?![A-Za-z0-9])", "Data Analysis"),
        (r"(?<![A-Za-z0-9])Dify(?![A-Za-z0-9])", "Dify"),
        (r"(?<![A-Za-z0-9])Coze(?![A-Za-z0-9])", "Coze"),
        (r"(?<![A-Za-z0-9])RAG(?![A-Za-z0-9])", "RAG"),
        (r"(?<![A-Za-z0-9])SFT(?![A-Za-z0-9])", "SFT"),
        (r"(?<![A-Za-z0-9])RLHF(?![A-Za-z0-9])", "RLHF"),
        (r"\bLLM\b|大模型", "大模型"),
        (r"deepseek[-\s]?R1", "DeepSeek-R1"),
        (r"Qwen2\.5[-\s]?VL[-\s]?32B[-\s]?Instruct", "Qwen2.5-VL-32B-Instruct"),
        (r"(?<![A-Za-z0-9])Qwen[-\w.]*", "Qwen"),
        (r"Sentence[-\s]?BERT", "Sentence-BERT"),
        (r"(?<![A-Za-z0-9])Cesium(?![A-Za-z0-9])", "Cesium"),
        (r"(?<![A-Za-z0-9])Axure(?![A-Za-z0-9])", "Axure"),
        (r"(?<![A-Za-z0-9])Jira(?![A-Za-z0-9])", "Jira"),
        (r"(?<![A-Za-z0-9])Figma(?![A-Za-z0-9])", "Figma"),
        (r"墨刀", "墨刀"),
        (r"(?<![A-Za-z0-9])Scrum(?![A-Za-z0-9])", "Scrum"),
        (r"(?<![A-Za-z0-9])PMP(?![A-Za-z0-9])", "PMP"),
        (r"(?<![A-Za-z0-9])CSPM(?![A-Za-z0-9])", "CSPM"),
        (r"技术管理", "技术管理"),
        (r"产品管理", "产品管理"),
        (r"团队建设", "团队建设"),
        (r"跨部门协作", "跨部门协作"),
        (r"战略规划", "战略规划"),
        (r"技术决策", "技术决策"),
        (r"架构评审", "架构评审"),
        (r"技术标准化", "技术标准化"),
        (r"流程优化", "流程优化"),
        (r"AI平台", "AI平台"),
        (r"技术方案评估", "技术方案评估"),
        (r"方案选型", "方案选型"),
        (r"多模态", "多模态"),
        (r"内容合规|内容安全|合规检测", "内容安全"),
        (r"资源整合", "资源整合"),
        (r"预算管理", "预算管理"),
        (r"产品思维", "产品思维"),
        (r"需求分析", "需求分析"),
        (r"用户调研", "用户调研"),
        (r"竞品分析", "竞品分析"),
        (r"用户画像", "用户画像"),
        (r"产品路线图", "产品路线图"),
        (r"产品设计", "产品设计"),
        (r"项目管理", "项目管理"),
        (r"敏捷开发", "敏捷开发"),
        (r"看板", "看板"),
    ]

    BASIC_INFO_LABELS = {
        "姓名", "姓 名", "name", "full name", "性别", "gender", "年龄", "age",
        "电话", "手机", "联系方式", "联系电话", "邮箱", "电子邮箱", "email",
        "出生年月", "出生日期", "籍贯", "现居地", "求职意向"
    }

    INVALID_NAME_VALUES = {
        "姓名", "姓 名", "候选人", "未知", "待解析", "未识别姓名", "简历", "个人简历",
        "简历信息表", "基本信息", "个人信息", "一基本信息", "联系方式", "联系电话",
        "电话", "手机", "邮箱", "电子邮箱", "性别", "年龄", "男", "女", "求职意向"
    }

    def __init__(self) -> None:
        self.last_text_extractor = "unknown"

    def _normalize_extracted_text(self, text: str) -> str:
        """Normalize text from CLI/Python extractors while keeping readable line breaks."""
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[\u0000-\u0008\u000b\u000c\u000e-\u001f]", "", text)
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]

        normalized: list[str] = []
        blank_seen = False
        for line in lines:
            if not line:
                if not blank_seen:
                    normalized.append("")
                blank_seen = True
                continue
            normalized.append(line)
            blank_seen = False

        return "\n".join(normalized).strip()

    async def _run_cli_text_extractor(self, command: list[str], extractor_name: str) -> str | None:
        """Run a local CLI extractor and return normalized stdout when useful."""
        executable = command[0]
        if not shutil.which(executable):
            return None

        def _run() -> subprocess.CompletedProcess[str]:
            return subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )

        try:
            result = await asyncio.to_thread(_run)
        except Exception:
            return None

        if result.returncode != 0:
            return None

        text = self._normalize_extracted_text(result.stdout or "")
        if len(text) < 20:
            return None

        self.last_text_extractor = extractor_name
        return text

    async def parse_pdf(self, file_path: str) -> str:
        """Extract text from PDF file."""
        cli_text = await self._run_cli_text_extractor(
            ["pdftotext", "-layout", "-enc", "UTF-8", file_path, "-"],
            "pdftotext -layout",
        )
        if cli_text:
            return cli_text

        try:
            doc = fitz.open(file_path)
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            self.last_text_extractor = "pymupdf"
            return self._normalize_extracted_text(text)
        except Exception as e:
            raise ValueError(f"PDF解析失败: {str(e)}")

    async def parse_docx(self, file_path: str) -> str:
        """Extract text from DOCX file."""
        candidates: list[tuple[str, str]] = []
        for command, extractor_name in [
            (["pandoc", "-t", "plain", file_path], "pandoc"),
            (["textutil", "-convert", "txt", "-stdout", file_path], "textutil"),
        ]:
            cli_text = await self._run_cli_text_extractor(command, extractor_name)
            if cli_text:
                candidates.append((extractor_name, cli_text))

        try:
            candidates.append(("python-docx", self._parse_docx_with_python(file_path)))
        except Exception as e:
            if not candidates:
                raise ValueError(f"DOCX解析失败: {str(e)}")

        if not candidates:
            raise ValueError("DOCX解析失败: 未能抽取到有效文本")

        extractor_name, text = max(candidates, key=lambda candidate: self._score_resume_text(candidate[1]))
        self.last_text_extractor = extractor_name
        return text

    def _parse_docx_with_python(self, file_path: str) -> str:
        """Extract DOCX text with python-docx, preserving table row order."""
        doc = Document(file_path)
        lines: list[str] = []

        for block in self._iter_docx_blocks(doc):
            if isinstance(block, Paragraph):
                paragraph_text = block.text.strip()
                if paragraph_text:
                    lines.append(paragraph_text)
            elif isinstance(block, Table):
                lines.extend(self._extract_docx_table_lines(block))

        return self._normalize_extracted_text("\n".join(lines) + ("\n" if lines else ""))

    def _score_resume_text(self, text: str) -> int:
        """Prefer extractor output that produces more useful structured resume fields."""
        try:
            data = self.extract_structured_data(text)
        except Exception:
            return 0

        score = min(len(text), 5000) // 500
        for key in ("name", "email", "phone", "gender", "age"):
            if data.get(key):
                score += 4

        education = data.get("education") if isinstance(data.get("education"), list) else []
        for item in education[:3]:
            if isinstance(item, dict):
                score += sum(2 for key in ("school", "degree", "major") if item.get(key))

        work_experience = data.get("work_experience") if isinstance(data.get("work_experience"), list) else []
        for item in work_experience[:3]:
            if isinstance(item, dict):
                score += sum(2 for key in ("company", "position", "description") if item.get(key))

        skills = data.get("skills") if isinstance(data.get("skills"), list) else []
        score += min(len(skills), 10)
        return score

    def _iter_docx_blocks(self, parent: DocxDocument | _Cell):
        """Yield paragraphs and tables in the order they appear in a DOCX."""
        if isinstance(parent, DocxDocument):
            parent_element = parent.element.body
        elif isinstance(parent, _Cell):
            parent_element = parent._tc
        else:
            return

        for child in parent_element.iterchildren():
            if isinstance(child, CT_P):
                yield Paragraph(child, parent)
            elif isinstance(child, CT_Tbl):
                yield Table(child, parent)

    def _extract_docx_table_lines(self, table: Table) -> list[str]:
        """Extract table rows as tab-separated lines, avoiding merged-cell repeats."""
        lines: list[str] = []

        for row in table.rows:
            cells: list[str] = []
            seen_cells: set[int] = set()

            for cell in row.cells:
                cell_id = id(cell._tc)
                if cell_id in seen_cells:
                    continue
                seen_cells.add(cell_id)

                cell_text = "\n".join(
                    paragraph.text.strip()
                    for paragraph in cell.paragraphs
                    if paragraph.text.strip()
                ).strip()
                if cell_text:
                    cells.append(cell_text)

            if cells:
                lines.append("\t".join(cells))

        return lines

    async def parse_image(self, file_path: str) -> str:
        """Extract text from image using OCR."""
        try:
            image = Image.open(file_path)
            # Use Chinese and English
            text = pytesseract.image_to_string(image, lang='chi_sim+eng')
            self.last_text_extractor = "tesseract"
            return self._normalize_extracted_text(text)
        except Exception as e:
            raise ValueError(f"图片解析失败: {str(e)}")

    async def parse_doc(self, file_path: str) -> str:
        """Extract text from legacy DOC using available local CLI tools."""
        for command, extractor_name in [
            (["textutil", "-convert", "txt", "-stdout", file_path], "textutil"),
            (["antiword", file_path], "antiword"),
            (["catdoc", file_path], "catdoc"),
            (["pandoc", "-t", "plain", file_path], "pandoc"),
        ]:
            cli_text = await self._run_cli_text_extractor(command, extractor_name)
            if cli_text:
                return cli_text

        raise ValueError("旧版 .doc 格式解析失败：本机缺少可用的 textutil/antiword/catdoc/pandoc 解析工具")

    async def parse_file(self, file_path: str, file_type: str) -> str:
        """Parse file based on type and return extracted text."""
        if file_type == "pdf":
            return await self.parse_pdf(file_path)
        elif file_type == "docx":
            return await self.parse_docx(file_path)
        elif file_type in ["jpg", "png"]:
            return await self.parse_image(file_path)
        elif file_type == "doc":
            return await self.parse_doc(file_path)
        else:
            raise ValueError(f"不支持的文件类型: {file_type}")

    def extract_structured_data(self, raw_text: str) -> dict:
        """Extract structured data from raw resume text."""
        basic_info = self.extract_basic_info(raw_text)
        result = {
            "name": basic_info.get("name"),
            "gender": basic_info.get("gender"),
            "age": basic_info.get("age"),
            "email": basic_info.get("email"),
            "phone": basic_info.get("phone"),
            "education": self._extract_education(raw_text),
            "work_experience": self._extract_work_experience(raw_text),
            "skills": self._extract_skills(raw_text),
            "projects": self._extract_projects(raw_text),
            "raw_text": raw_text,
            "text_extractor": self.last_text_extractor,
        }
        return result

    def extract_basic_info(self, raw_text: str) -> dict:
        """Extract the candidate's high-confidence basic profile fields."""
        return {
            "name": self._extract_name(raw_text),
            "gender": self._extract_gender(raw_text),
            "age": self._extract_age(raw_text),
            "email": self._extract_email(raw_text),
            "phone": self._extract_phone(raw_text),
        }

    def clean_candidate_name(self, value: object) -> Optional[str]:
        """Normalize and validate a candidate name."""
        if value is None:
            return None

        name = str(value).strip()
        if not name:
            return None

        name = re.sub(r"^(?:姓名|姓\s*名|Name|Full Name)\s*[:：\-—|]?\s*", "", name, flags=re.I)
        name = re.split(
            r"(?:性别|年龄|电话|手机|联系方式|联系电话|邮箱|电子邮箱|Email|出生|现居地|求职意向)",
            name,
            maxsplit=1,
            flags=re.I
        )[0]
        name = name.strip(" ：:;；,，|/\\-—\t")
        name = re.sub(r"\s+", " ", name).strip()

        compact = re.sub(r"\s+", "", name)
        if not compact:
            return None
        if compact.lower() in {item.lower() for item in self.INVALID_NAME_VALUES}:
            return None
        if re.search(r"(简历|信息表|基本信息|个人信息|联系方式|邮箱|电话|手机)", compact):
            return None
        if re.search(r"[@\d]", compact):
            return None

        if re.fullmatch(r"[\u4e00-\u9fa5]{2,6}", compact):
            return compact
        if re.fullmatch(r"[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}", name):
            return name

        return None

    def _extract_name(self, text: str) -> Optional[str]:
        """Extract candidate name from text."""
        labeled_name = self._extract_labeled_value(text, ["姓名", "姓 名", "Name", "Full Name"])
        cleaned_labeled_name = self.clean_candidate_name(labeled_name)
        if cleaned_labeled_name:
            return cleaned_labeled_name

        lines = self._meaningful_lines(text)
        for line in lines[:16]:
            cleaned_name = self.clean_candidate_name(line)
            if cleaned_name:
                return cleaned_name
        return None

    def _extract_gender(self, text: str) -> Optional[str]:
        """Extract gender from text."""
        value = self._extract_labeled_value(text, ["性别", "Gender"])
        if not value:
            match = re.search(r"(?:性别|Gender)\s*[:：\-—]?\s*(男|女|male|female)", text, re.I)
            value = match.group(1) if match else None

        if not value:
            return None

        normalized = re.sub(r"\s+", "", str(value)).lower()
        if normalized.startswith("男") or normalized.startswith("male"):
            return "男"
        if normalized.startswith("女") or normalized.startswith("female"):
            return "女"
        return None

    def _extract_age(self, text: str) -> Optional[int]:
        """Extract candidate age from text."""
        value = self._extract_labeled_value(text, ["年龄", "Age"])
        if not value:
            match = re.search(r"(?:年龄|Age)\s*[:：\-—]?\s*(\d{1,2})\s*(?:岁)?", text, re.I)
            value = match.group(1) if match else None

        if not value:
            return None

        match = re.search(r"\d{1,2}", str(value))
        if not match:
            return None

        age = int(match.group(0))
        return age if 16 <= age <= 80 else None

    def _extract_email(self, text: str) -> Optional[str]:
        """Extract email from text."""
        match = re.search(self.EMAIL_PATTERN, text)
        return match.group(0) if match else None

    def _extract_phone(self, text: str) -> Optional[str]:
        """Extract phone number from text."""
        match = re.search(self.PHONE_PATTERN, text)
        return match.group(0) if match else None

    def _meaningful_lines(self, text: str) -> list[str]:
        return [
            re.sub(r"\s+", " ", line).strip()
            for line in text.split("\n")
            if line.strip()
        ]

    def _is_basic_label_line(self, line: str) -> bool:
        compact = re.sub(r"[\s：:|/\-—]+", "", line).lower()
        labels = {
            re.sub(r"[\s：:|/\-—]+", "", label).lower()
            for label in self.BASIC_INFO_LABELS
        }
        return compact in labels or compact in {"一基本信息", "基本资料", "个人资料"}

    def _trim_labeled_tail(self, value: str) -> str:
        return re.split(
            r"(?:性别|年龄|电话|手机|联系方式|联系电话|邮箱|电子邮箱|Email|出生年月|出生日期|现居地|籍贯|求职意向)",
            value,
            maxsplit=1,
            flags=re.I
        )[0].strip(" ：:;；,，|/\\-—\t")

    def _extract_labeled_value(self, text: str, labels: list[str], max_lines: int = 180) -> Optional[str]:
        lines = self._meaningful_lines(text)

        for index, line in enumerate(lines[:max_lines]):
            for label in labels:
                pattern = rf"^\s*{re.escape(label)}\s*[:：\-—|]?\s*(.+)$"
                match = re.match(pattern, line, re.I)
                if match:
                    value = self._trim_labeled_tail(match.group(1))
                    if value:
                        return value

                compact_line = re.sub(r"\s+", "", line)
                compact_label = re.sub(r"\s+", "", label)
                if compact_line.lower() == compact_label.lower():
                    for next_line in lines[index + 1:index + 5]:
                        if self._is_basic_label_line(next_line):
                            break
                        value = self._trim_labeled_tail(next_line)
                        if value:
                            return value

                if compact_line.lower().startswith(compact_label.lower()):
                    value = compact_line[len(compact_label):].lstrip("：:-—|")
                    value = self._trim_labeled_tail(value)
                    if value:
                        return value

        return None

    def _extract_education(self, text: str) -> list[dict]:
        """Extract education information."""
        education: list[dict] = []

        labeled_entry = self._extract_education_from_labeled_rows(text)
        if labeled_entry:
            education.append(labeled_entry)

        for line in self._extract_education_section_lines(text):
            entry = self._parse_education_line(line)
            if entry:
                education.append(entry)

        if not education:
            for line in self._meaningful_lines(text):
                entry = self._parse_education_line(line)
                if entry:
                    education.append(entry)

        return self._dedupe_education(education)

    def _extract_education_from_labeled_rows(self, text: str) -> Optional[dict]:
        """Extract education from basic-info tables such as 院校名称/专业/学历."""
        label_map = {
            "院校名称": "school",
            "毕业院校": "school",
            "学校": "school",
            "专业": "major",
            "学历": "degree",
            "学位": "degree",
        }
        values: dict[str, str] = {}

        for raw_line in text.split("\n")[:120]:
            cells = [
                cell.strip()
                for cell in re.split(r"\t+| {2,}", raw_line.strip())
                if cell.strip()
            ]
            if len(cells) < 2:
                continue

            for index, cell in enumerate(cells[:-1]):
                key = label_map.get(cell)
                if not key or key in values:
                    continue

                value = cells[index + 1].strip()
                if value and value not in label_map:
                    values[key] = value

        degree = self._normalize_degree(values.get("degree", ""))
        school = values.get("school", "")
        major = values.get("major", "")

        if not any([school, degree, major]):
            return None

        return {
            "school": school or "未知学校",
            "degree": degree or values.get("degree", ""),
            "major": major,
            "start_date": None,
            "end_date": None
        }

    def _extract_education_section_lines(self, text: str) -> list[str]:
        lines = self._meaningful_lines(text)
        section_lines: list[str] = []
        in_education_section = False

        start_pattern = re.compile(
            r"^(?:[一二三四五六七八九十0-9]+[、.．]\s*)?"
            r"(教育背景|教育经历|学历背景|Education)\s*[:：]?\s*(?P<inline>.*)$",
            re.I
        )
        stop_pattern = re.compile(
            r"^(?:[一二三四五六七八九十0-9]+[、.．]\s*)?"
            r"(工作经历|工作经验|职业经历|项目经历|项目经验|专业技能|技能清单|核心技能|技能|"
            r"专业证书|证书|社会职业|社会经历|获奖|语言能力|自我评价|个人评价|"
            r"基本信息|个人信息|求职意向|Work Experience|Experience|Projects|Skills|Certificates)\b",
            re.I
        )

        for line in lines:
            start_match = start_pattern.match(line)
            if start_match and not in_education_section:
                in_education_section = True
                inline = start_match.group("inline").strip()
                if inline:
                    section_lines.append(inline)
                continue

            if not in_education_section:
                continue

            if stop_pattern.match(line):
                break

            section_lines.append(line)

            if len(section_lines) >= 20:
                break

        return section_lines

    def _parse_education_line(self, line: str) -> Optional[dict]:
        normalized = re.sub(r"\s+", " ", line).strip(" -•*：:")
        if not normalized:
            return None
        if self._is_certificate_line(normalized):
            return None

        degree = self._normalize_degree(normalized)
        has_school_hint = bool(re.search(r"大学|学院|学校|University|College|Institute", normalized, re.I))
        if not degree and not has_school_hint:
            return None

        date_match = re.search(
            r"(?P<start>\d{4}(?:[./年-]\d{1,2}月?)?)\s*(?:-|~|～|—|至)\s*"
            r"(?P<end>至今|现在|\d{4}(?:[./年-]\d{1,2}月?)?)",
            normalized
        )
        start_date = date_match.group("start") if date_match else None
        end_date = date_match.group("end") if date_match else None

        cleaned = re.sub(r"\d{4}(?:[./年-]\d{1,2}月?)?\s*(?:-|~|～|—|至)\s*(?:至今|现在|\d{4}(?:[./年-]\d{1,2}月?)?)", " ", normalized)
        cleaned = re.sub(r"(教育背景|教育经历|学历背景|Education)", " ", cleaned, flags=re.I)
        tokens = [
            token.strip(" ：:;；,，|")
            for token in re.split(r"\s+|[|｜,，;；]", cleaned)
            if token.strip(" ：:;；,，|")
        ]

        school = ""
        for token in tokens:
            if re.search(r"大学|学院|学校|University|College|Institute", token, re.I):
                school = token
                break

        if not school and degree and tokens:
            first_token = tokens[0]
            if not self._normalize_degree(first_token) and not re.search(r"证书|认证", first_token):
                school = first_token

        major_tokens = []
        school_seen = False
        degree_seen = False
        for token in tokens:
            if token == school:
                school_seen = True
                continue
            if self._normalize_degree(token):
                degree_seen = True
                continue
            if re.search(r"^\d{4}", token) or token in {"院校名称", "毕业院校", "学校", "专业", "学历", "学位"}:
                continue
            if school_seen or degree_seen:
                major_tokens.append(token)

        if not school and not degree:
            return None

        return {
            "school": school or "未知学校",
            "degree": degree or "",
            "major": " ".join(major_tokens[:4]),
            "start_date": start_date,
            "end_date": end_date
        }

    def _normalize_degree(self, value: str) -> str:
        if not value:
            return ""
        if re.search(r"博士|PhD|Doctor", value, re.I):
            return "博士"
        if re.search(r"硕士|研究生|Master", value, re.I):
            return "硕士"
        if re.search(r"本科|学士|Bachelor", value, re.I):
            return "本科"
        if re.search(r"大专|专科|Associate", value, re.I):
            return "大专"
        if re.search(r"高中|中专", value):
            return "高中"
        return ""

    def _is_certificate_line(self, line: str) -> bool:
        return bool(re.search(r"证书|认证|PMP|CSPM|PRINCE|软考|资格证", line, re.I))

    def _dedupe_education(self, education: list[dict]) -> list[dict]:
        deduped: list[dict] = []
        seen: set[tuple[str, str, str]] = set()

        for item in education:
            key = (
                str(item.get("school", "")),
                str(item.get("degree", "")),
                str(item.get("major", "")),
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)

        return deduped[:5]

    def _extract_work_experience(self, text: str) -> list[dict]:
        """Extract work experience."""
        lines = [
            re.sub(r"\s+", " ", line).strip()
            for line in text.split("\n")
            if line.strip() and not re.fullmatch(r"\d+", line.strip())
        ]

        start_index = -1
        for idx, line in enumerate(lines):
            if re.search(r"工作经历|工作经验|职业经历|Work Experience|Experience", line, re.I):
                start_index = idx + 1
                break

        if start_index == -1:
            return []

        section_lines = []
        stop_pattern = re.compile(
            r"^(教育背景|教育经历|项目经历|项目经验|技能|专业技能|证书|专业证书|"
            r"自我评价|个人评价|社会职业|社会经历|获奖|语言能力|[一二三四五六七八九十]、)"
        )
        for line in lines[start_index:]:
            if stop_pattern.search(line) and not re.search(r"工作经历|工作经验|职业经历", line):
                break
            section_lines.append(line)

        def is_date_range_line(line: str) -> bool:
            return bool(re.search(
                r"(\d{4}\s*年?\s*\d{0,2}\s*月?|\d{4}[./-]\d{1,2}).{0,24}"
                r"(至今|现在|\d{4}|[-~～—])",
                line
            ))

        def is_likely_work_title(line: str) -> bool:
            if not line or len(line) < 4 or len(line) > 80:
                return False
            if line.endswith((":", "：")) or line.startswith(("-", "•", "*")):
                return False
            return bool(re.search(
                r"公司|集团|科技|信息|研究院|研究所|银行|大学|学院|部门|事业部|中心|"
                r"工作室|有限公司|研发部|产品部|技术部",
                line
            ))

        def split_title(title: str) -> tuple[str, str]:
            for separator in [" - ", "-", "—", "｜", "|", "/"]:
                if separator in title:
                    left, right = title.split(separator, 1)
                    return left.strip() or title, right.strip()
            return title, ""

        def split_period(period: str) -> tuple[str, str | None]:
            normalized = re.sub(r"\s+", " ", period).strip()
            match = re.match(
                r"^(?P<start>\d{4}\s*年?\s*\d{0,2}\s*月?|\d{4}[./-]\d{1,2})"
                r"\s*(?:-|~|～|—|至)\s*(?P<end>至今|现在|\d{4}\s*年?\s*\d{0,2}\s*月?|\d{4}[./-]\d{1,2})?$",
                normalized
            )
            if not match:
                return normalized, None

            start = match.group("start").strip()
            end = (match.group("end") or "").strip()
            return start, end or None

        def split_inline_work_header(line: str) -> tuple[str, str] | None:
            match = re.search(
                r"(?P<period>(?:\d{4}\s*年?\s*\d{1,2}\s*月?|\d{4}[./-]\d{1,2})"
                r"\s*(?:-|~|～|—|至)\s*(?:至今|现在|\d{4}\s*年?\s*\d{1,2}\s*月?|\d{4}[./-]\d{1,2}))",
                line
            )
            if not match:
                return None

            title = line[:match.start()].strip()
            period = match.group("period").strip()
            if not title or not is_likely_work_title(title):
                return None

            return title, period

        def clean_description_line(line: str) -> str:
            return re.sub(r"^[-•*]\s*", "", line).strip()

        def is_sentence_complete(line: str) -> bool:
            return bool(re.search(r"[。！？；;.!?]$", line))

        def is_standalone_title(line: str) -> bool:
            return (
                len(line) <= 60
                and bool(re.search(r"[（(].+[）)]", line))
                and not bool(re.search(r"[，。；]", line))
            )

        def merge_wrapped_lines(raw_lines: list[str]) -> list[str]:
            merged: list[str] = []
            for raw_line in raw_lines:
                line = clean_description_line(raw_line)
                if not line or line.endswith((":", "：")):
                    continue

                previous = merged[-1] if merged else ""
                should_merge = (
                    bool(previous)
                    and not is_sentence_complete(previous)
                    and not is_standalone_title(previous)
                    and not is_standalone_title(line)
                )
                if should_merge:
                    merged[-1] = f"{previous}{line}"
                else:
                    merged.append(line)

            deduped = []
            for line in merged:
                if line not in deduped:
                    deduped.append(line)
            return deduped

        def parse_undated_work_line(line: str) -> Optional[dict]:
            clean_line = clean_description_line(line)
            if not clean_line or len(clean_line) > 160:
                return None
            if clean_line.endswith((":", "：")):
                return None
            if re.search(r"项目经历|教育背景|专业技能|技能清单", clean_line):
                return None

            match = re.match(
                r"^(?P<company>.+?)\s+"
                r"(?P<position>[^\s，,。]{0,20}"
                r"(?:工程师|经理|总监|负责人|开发|设计师|架构师|分析师|顾问|专家|CEO|CTO|后端|前端|产品|运营)"
                r"[^\s，,。]{0,10})"
                r"\s*(?P<description>.*)$",
                clean_line,
                re.I
            )
            if not match:
                return None

            company = match.group("company").strip(" -—|")
            position = match.group("position").strip(" -—|")
            description = match.group("description").strip()

            if len(company) < 2 or len(company) > 80 or len(position) < 2:
                return None

            return {
                "company": company,
                "position": position,
                "start_date": None,
                "end_date": None,
                "description": description
            }

        entry_starts = []
        for index, line in enumerate(section_lines):
            inline_header = split_inline_work_header(line)
            if inline_header:
                title, period = inline_header
                entry_starts.append({
                    "title_index": index,
                    "body_start_index": index + 1,
                    "title": title,
                    "period": period,
                })
                continue

            if index > 0 and is_date_range_line(line) and is_likely_work_title(section_lines[index - 1]):
                entry_starts.append({
                    "title_index": index - 1,
                    "body_start_index": index + 1,
                    "title": section_lines[index - 1],
                    "period": line,
                })

        experiences = []
        for entry_index, entry in enumerate(entry_starts):
            next_title_index = (
                entry_starts[entry_index + 1]["title_index"]
                if entry_index + 1 < len(entry_starts)
                else len(section_lines)
            )
            body_lines = merge_wrapped_lines(section_lines[entry["body_start_index"]:next_title_index])
            company, position = split_title(entry["title"])
            start_date, end_date = split_period(entry["period"])
            experiences.append({
                "company": company,
                "position": position,
                "start_date": start_date,
                "end_date": end_date,
                "description": "\n".join(body_lines[:12])
            })

        if not experiences:
            for line in section_lines[:12]:
                fallback_entry = parse_undated_work_line(line)
                if fallback_entry:
                    experiences.append(fallback_entry)

        return experiences

    def _extract_skills(self, text: str) -> list[str]:
        """Extract skills from text."""
        skill_lines = self._extract_skill_section_lines(text)
        source_text = "\n".join(skill_lines) if skill_lines else text
        skills = self._extract_known_skill_terms(source_text)

        if skill_lines:
            for line in skill_lines:
                for phrase in self._extract_skill_phrases_from_line(line):
                    existing = {skill.lower() for skill in skills}
                    if phrase.lower() not in existing:
                        skills.append(phrase)

        return skills[:40]

    def _extract_skill_section_lines(self, text: str) -> list[str]:
        """Return only the skill section, stopping at the next resume section."""
        lines = self._meaningful_lines(text)
        section_lines: list[str] = []
        in_skill_section = False

        start_pattern = re.compile(
            r"^(?:[一二三四五六七八九十0-9]+[、.．]\s*)?"
            r"(专业技能|技能清单|核心技能|技能|技术栈|Skills|Technologies)\s*[:：]?\s*(?P<inline>.*)$",
            re.I
        )
        stop_pattern = re.compile(
            r"^(?:[一二三四五六七八九十0-9]+[、.．]\s*)?"
            r"(工作经历|工作经验|职业经历|项目经历|项目经验|教育背景|教育经历|"
            r"专业证书|证书|社会职业|社会经历|获奖|语言能力|自我评价|个人评价|"
            r"基本信息|个人信息|求职意向|Work Experience|Experience|Projects|Education|Certificates)\b",
            re.I
        )

        for line in lines:
            start_match = start_pattern.match(line)
            if start_match and not in_skill_section:
                in_skill_section = True
                inline = start_match.group("inline").strip()
                if inline:
                    section_lines.append(inline)
                continue

            if not in_skill_section:
                continue

            if stop_pattern.match(line):
                break
            if start_pattern.match(line):
                continue

            section_lines.append(line)

            if len(section_lines) >= 40:
                break

        return section_lines

    def _extract_known_skill_terms(self, text: str) -> list[str]:
        found: list[tuple[int, str]] = []
        for pattern, label in self.SKILL_PATTERNS:
            match = re.search(pattern, text, re.I)
            if match:
                found.append((match.start(), label))

        ordered = []
        for _, label in sorted(found, key=lambda item: item[0]):
            if label == "Qwen" and any(item.startswith("Qwen") for item in ordered):
                continue
            if label not in ordered:
                ordered.append(label)
        return ordered

    def _extract_skill_phrases_from_line(self, line: str) -> list[str]:
        """Extract short skill phrases from natural-language skill bullets."""
        phrases: list[str] = []
        normalized = re.sub(r"\s+", " ", line).strip()
        normalized = normalized.strip("-•* ")
        if not normalized:
            return phrases

        segments = re.split(r"[，,；;。]|、(?=[\u4e00-\u9fa5A-Za-z])", normalized)
        for segment in segments:
            segment = segment.strip(" ：:;；,，。 ")
            segment = re.sub(
                r"^(具备|熟悉|擅长|掌握|熟练使用|主导落地过|主导|推动|负责|能|可)\s*",
                "",
                segment
            )
            segment = re.sub(r"(等工具.*|等AI平台.*|等专业认证.*|等AI项目.*)$", "", segment).strip()

            if not segment or len(segment) > 24 or len(segment) < 2:
                continue
            if "等" in segment:
                continue
            if re.search(r"[（(][^）)]*$", segment):
                continue
            if re.search(r"(技术体系|技术原理|行业趋势|可行性|投入产出|全生命周期|完整经验)", segment):
                continue
            if re.search(r"(方法|能力)$", segment):
                continue
            if re.search(r"(经验|从0到1|实现|提升|负责|主导|推动|项目|公司|赛道|用户需求出发|赋能|业务提效)", segment):
                continue
            if re.search(r"^(驱动|制定|设计|规划).*(落地|路线图|功能)$", segment):
                continue
            if re.search(r"[与和]", segment):
                continue
            if re.search(r"\d{2,}|https?://|@|[\t\n]", segment):
                continue

            if segment not in phrases:
                phrases.append(segment)

        return phrases[:12]

    def _extract_projects(self, text: str) -> list[dict]:
        """Extract project experience."""
        lines = self._meaningful_lines(text)
        section_lines: list[str] = []
        in_project_section = False

        start_pattern = re.compile(
            r"^(?:[一二三四五六七八九十0-9]+[、.．]\s*)?"
            r"(项目经历|项目经验|Projects|Project Experience)\s*[:：]?\s*(?P<inline>.*)$",
            re.I
        )
        stop_pattern = re.compile(
            r"^(?:[一二三四五六七八九十0-9]+[、.．]\s*)?"
            r"(教育背景|教育经历|专业证书|证书|社会职业|社会经历|获奖|语言能力|"
            r"自我评价|个人评价|专业技能|技能清单|工作经历|工作经验|Work Experience|Education|Certificates)\b",
            re.I
        )

        for line in lines:
            start_match = start_pattern.match(line)
            if start_match and not in_project_section:
                in_project_section = True
                inline = start_match.group("inline").strip()
                if inline:
                    section_lines.append(inline)
                continue

            if not in_project_section:
                continue

            if stop_pattern.match(line):
                break

            section_lines.append(line)

            if len(section_lines) >= 80:
                break

        projects: list[dict] = []
        current_project: Optional[dict] = None

        def split_project_line(line: str) -> tuple[str, str]:
            cleaned = re.sub(r"^[-•*]\s*", "", line).strip()
            if len(cleaned) > 32 and re.search(r"\s", cleaned):
                name, description = cleaned.split(maxsplit=1)
                if 2 <= len(name) <= 24:
                    return name, description
            return cleaned, ""

        def is_project_meta_line(line: str) -> bool:
            return bool(re.match(
                r"^(项目背景|背景|核心成果|主要成果|技术方案|项目职责|职责|挑战|解决方案|成果|"
                r"描述|项目描述|负责内容|Role|Description)\s*[:：]",
                line,
                re.I
            ))

        def is_project_title(line: str) -> bool:
            cleaned = re.sub(r"^[-•*]\s*", "", line).strip()
            if not cleaned:
                return False
            if is_project_meta_line(cleaned):
                return False
            if current_project is None:
                return True
            return len(cleaned) <= 60 and not re.search(r"[。！？；;.!?]$", cleaned)

        for line in section_lines:
            cleaned_line = re.sub(r"^[-•*]\s*", "", line).strip()
            if not cleaned_line:
                continue

            if is_project_title(cleaned_line):
                if current_project:
                    projects.append(current_project)
                name, description = split_project_line(cleaned_line)
                current_project = {
                    "name": name,
                    "role": "",
                    "description": description
                }
                continue

            if current_project:
                current_project["description"] = "\n".join(
                    part for part in [current_project.get("description", ""), cleaned_line] if part
                )

        if current_project:
            projects.append(current_project)

        return projects[:10]
