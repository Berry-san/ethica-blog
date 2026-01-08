import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Server
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(5500),

  // Database
  DATABASE_URL: Joi.string().required(),

  // JWT
  JWT_SECRET: Joi.string().required().min(32),
  JWT_EXPIRATION: Joi.string().default('15m'),
  REFRESH_TOKEN_SECRET: Joi.string().required().min(32),
  REFRESH_TOKEN_EXPIRATION: Joi.string().default('7d'),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),

  // CORS
  CORS_ORIGINS: Joi.string()
    .default('http://localhost:3000,http://localhost:3001,https://ethicamfb.com'),
});
