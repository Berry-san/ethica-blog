import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { FileUploadValidator } from '../validators/file-upload.validator';
import toStream = require('streamifier');

@Injectable()
export class CloudinaryService {
  private readonly fileValidator: FileUploadValidator;

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    this.fileValidator = new FileUploadValidator();
  }

  async uploadImage(file: Express.Multer.File): Promise<any> {
    // Validate file before upload
    await this.fileValidator.validateFile(file);

    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { 
          folder: 'ethica-blog',
          resource_type: 'image',
          // Security: Strip metadata
          transformation: [{ flags: 'strip_profile' }],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
      toStream.createReadStream(file.buffer).pipe(upload);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      console.log(`🗑️ Deleted image from Cloudinary: ${publicId}`);
    } catch (error) {
      console.error(`❌ Failed to delete image from Cloudinary: ${publicId}`, error);
      // Don't throw - allow post deletion to proceed even if Cloudinary delete fails
    }
  }
}
