import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { FileUploadValidator } from '../validators/file-upload.validator';
import toStream = require('streamifier');

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
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
    
    this.logger.log(`Uploading image to Cloudinary: ${file.originalname}`);

    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { 
          folder: 'ethica-blog',
          resource_type: 'image',
          // Security: Strip metadata
          transformation: [{ flags: 'strip_profile' }],
        },
        (error, result) => {
          if (error) {
            this.logger.error(`Failed to upload image: ${file.originalname}`, error.stack);
            return reject(error);
          }
          if (result) {
            this.logger.log(`Image uploaded successfully: ${result.public_id}`);
          }
          resolve(result);
        },
      );
      toStream.createReadStream(file.buffer).pipe(upload);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      this.logger.log(`Deleted image from Cloudinary: ${publicId}`);
    } catch (error) {
      this.logger.error(`Failed to delete image from Cloudinary: ${publicId}`, error.stack);
      // Don't throw - allow post deletion to proceed even if Cloudinary delete fails
    }
  }
}
