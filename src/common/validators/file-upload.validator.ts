import { BadRequestException, Injectable } from '@nestjs/common';
import { fromBuffer } from 'file-type';

export interface FileValidationOptions {
  maxSizeInBytes?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

@Injectable()
export class FileUploadValidator {
  private readonly DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly DEFAULT_ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];
  private readonly DEFAULT_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

  /**
   * Validates uploaded file for security and compliance
   * @param file - The uploaded file from multer
   * @param options - Optional validation configuration
   * @throws BadRequestException if validation fails
   */
  async validateFile(
    file: Express.Multer.File,
    options?: FileValidationOptions,
  ): Promise<void> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const maxSize = options?.maxSizeInBytes || this.DEFAULT_MAX_SIZE;
    const allowedMimeTypes = options?.allowedMimeTypes || this.DEFAULT_ALLOWED_MIME_TYPES;
    const allowedExtensions = options?.allowedExtensions || this.DEFAULT_ALLOWED_EXTENSIONS;

    // 1. File size validation
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.formatBytes(maxSize)}`,
      );
    }

    // 2. Sanitize filename (prevent path traversal)
    const sanitizedFilename = this.sanitizeFilename(file.originalname);
    if (!sanitizedFilename) {
      throw new BadRequestException('Invalid filename');
    }

    // 3. File extension validation
    const fileExtension = this.getFileExtension(sanitizedFilename);
    if (!allowedExtensions.includes(fileExtension.toLowerCase())) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`,
      );
    }

    // 4. MIME type validation (from multer)
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `MIME type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }

    // 5. Magic number validation (prevent MIME type spoofing)
    await this.validateMagicNumber(file.buffer, allowedMimeTypes);
  }

  /**
   * Validates file magic number to prevent MIME type spoofing
   */
  private async validateMagicNumber(
    buffer: Buffer,
    allowedMimeTypes: string[],
  ): Promise<void> {
    try {
      const fileTypeResult = await fromBuffer(buffer);
      
      if (!fileTypeResult) {
        throw new BadRequestException('Unable to determine file type');
      }

      if (!allowedMimeTypes.includes(fileTypeResult.mime)) {
        throw new BadRequestException(
          `File content does not match declared type. Actual type: ${fileTypeResult.mime}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid file format');
    }
  }

  /**
   * Sanitizes filename to prevent path traversal and other attacks
   */
  private sanitizeFilename(filename: string): string {
    // Remove path separators and null bytes
    let sanitized = filename.replace(/[\/\\:\0]/g, '');
    
    // Remove leading dots (hidden files)
    sanitized = sanitized.replace(/^\.+/, '');
    
    // Limit length
    if (sanitized.length > 255) {
      sanitized = sanitized.substring(0, 255);
    }
    
    return sanitized;
  }

  /**
   * Extracts file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  /**
   * Formats bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}
