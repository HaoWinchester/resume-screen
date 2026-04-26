import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import UploadFile, HTTPException

from app.config import get_settings

settings = get_settings()


class StorageService:
    """Local file storage service for resume uploads."""

    ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"}
    ALLOWED_MIME_TYPES = {
        "application/pdf": ".pdf",
        "application/msword": ".doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "image/jpeg": ".jpg",
        "image/png": ".png"
    }
    MAX_FILE_SIZE = settings.MAX_FILE_SIZE_MB * 1024 * 1024  # Convert to bytes

    def __init__(self):
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def _get_file_extension(self, filename: str) -> Optional[str]:
        """Get file extension from filename."""
        return Path(filename).suffix.lower()

    def _get_mime_type_extension(self, content_type: str) -> Optional[str]:
        """Get file extension from MIME type."""
        return self.ALLOWED_MIME_TYPES.get(content_type)

    def validate_file(self, file: UploadFile) -> tuple[bool, Optional[str], Optional[str]]:
        """
        Validate uploaded file.

        Returns:
            tuple: (is_valid, file_extension, error_message)
        """
        # Check filename
        if not file.filename:
            return False, None, "文件名不能为空"

        # Get extension from filename
        ext = self._get_file_extension(file.filename)

        # If extension is not recognized, try MIME type
        if ext not in self.ALLOWED_EXTENSIONS:
            mime_ext = self._get_mime_type_extension(file.content_type) if file.content_type else None
            if mime_ext:
                ext = mime_ext
            else:
                return False, None, f"不支持的文件类型，仅支持: {', '.join(self.ALLOWED_EXTENSIONS)}"

        return True, ext, None

    async def save_file(
        self,
        file: UploadFile,
        company_id: uuid.UUID,
        job_requirement_id: uuid.UUID,
        resume_id: uuid.UUID
    ) -> tuple[str, str, int]:
        """
        Save file to local storage.

        Returns:
            tuple: (file_path, file_extension, file_size)
        """
        # Validate file
        is_valid, ext, error_msg = self.validate_file(file)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

        # Create directory structure: uploads/{company_id}/{job_requirement_id}/
        target_dir = self.upload_dir / str(company_id) / str(job_requirement_id)
        target_dir.mkdir(parents=True, exist_ok=True)

        # Generate filename: {resume_id}.{ext}
        filename = f"{resume_id}{ext}"
        file_path = target_dir / filename

        # Read and save file
        content = await file.read()
        file_size = len(content)

        # Check file size
        if file_size > self.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"文件过大，最大支持 {settings.MAX_FILE_SIZE_MB}MB"
            )

        # Write file
        with open(file_path, "wb") as f:
            f.write(content)

        return str(file_path), ext, file_size

    def delete_file(self, file_path: str) -> bool:
        """Delete file from storage."""
        try:
            path = Path(file_path)
            if path.exists() and path.is_file():
                path.unlink()
                return True
            return False
        except Exception:
            return False

    def get_file_path(self, company_id: uuid.UUID, job_requirement_id: uuid.UUID, resume_id: uuid.UUID, ext: str) -> str:
        """Get the expected file path for a resume."""
        return str(self.upload_dir / str(company_id) / str(job_requirement_id) / f"{resume_id}{ext}")
