import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authController } from '@/controllers/authController';
import { asyncHandler } from '@/middleware/errorHandler';
import { rateLimiter } from '@/middleware/rateLimiter';

const router = Router();

// Validation rules
const loginValidation = [
  body('address')
    .notEmpty()
    .withMessage('Wallet address is required')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum address'),
  body('signature')
    .notEmpty()
    .withMessage('Signature is required')
    .isLength({ min: 130, max: 132 })
    .withMessage('Invalid signature format'),
  body('nonce')
    .notEmpty()
    .withMessage('Nonce is required')
    .isNumeric()
    .withMessage('Nonce must be numeric')
];

const registerValidation = [
  body('address')
    .notEmpty()
    .withMessage('Wallet address is required')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum address'),
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('fullName')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('role')
    .isIn(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'])
    .withMessage('Invalid role'),
  body('adminSignature')
    .notEmpty()
    .withMessage('Admin signature is required')
    .isLength({ min: 130, max: 132 })
    .withMessage('Invalid signature format')
];

// Middleware to handle validation errors
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Routes
router.post(
  '/nonce',
  rateLimiter.nonce,
  asyncHandler(authController.getNonce)
);

router.post(
  '/login',
  rateLimiter.auth,
  loginValidation,
  handleValidationErrors,
  asyncHandler(authController.login)
);

router.post(
  '/logout',
  rateLimiter.auth,
  asyncHandler(authController.logout)
);

router.post(
  '/refresh',
  rateLimiter.auth,
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
  ],
  handleValidationErrors,
  asyncHandler(authController.refreshToken)
);

router.post(
  '/register',
  rateLimiter.auth,
  registerValidation,
  handleValidationErrors,
  asyncHandler(authController.register)
);

router.post(
  '/verify-signature',
  rateLimiter.auth,
  [
    body('message')
      .notEmpty()
      .withMessage('Message is required'),
    body('signature')
      .notEmpty()
      .withMessage('Signature is required'),
    body('address')
      .isEthereumAddress()
      .withMessage('Invalid Ethereum address')
  ],
  handleValidationErrors,
  asyncHandler(authController.verifySignature)
);

router.get(
  '/me',
  asyncHandler(authController.getProfile)
);

export default router;